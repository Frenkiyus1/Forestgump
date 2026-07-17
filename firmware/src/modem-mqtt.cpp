#include "modem-mqtt.h"
#include "config.h"
#include "net-log.h"
#include <PubSubClient.h>

// modem/gsmClient/mqtt được khai báo riêng trong từng nhánh #if/#else bên dưới
// (mỗi transport dùng 1 loại Client khác nhau) - KHÔNG khai báo lại ở đây, tránh
// lỗi "redefinition" khi biên dịch.

// Client-id duy nhất theo trạm để broker không từ chối phiên trùng.
static const char* MQTT_CLIENT_ID = "saliguard-" SECRET_STATION_ID;
static const char* TOPIC = MQTT_TOPIC_PREFIX SECRET_STATION_ID MQTT_TOPIC_SUFFIX;

#if defined(USE_WIFI_TRANSPORT)
// =========================================================================
// TRANSPORT: WiFi (ĐANG DÙNG THỰC TẾ - module 4G hiện chưa hoạt động được).
// WiFi đã được netLogBegin() kết nối trong setup() trước khi gọi modemBegin().
//
// TẠM: dùng WiFiClient THƯỜNG (không TLS) tới listener 1884 - vì cert Let's
// Encrypt cho 8883 chưa xin được (DNS mqtt.saliguard.com chưa cấu hình, xem
// DEPLOY.md mục A.3). Đổi lại thành WiFiClientSecure + cổng 8883 khi cert xong.
// =========================================================================
#include <WiFi.h>

static WiFiClient netClient;
static PubSubClient mqtt(netClient);

void modemBegin() {
	LOG.println(F("[NET] Transport = WiFi (4G tạm chưa dùng được, MQTT KHÔNG mã hoá - demo tạm)"));
	if (strlen(SECRET_WIFI_SSID) == 0) {
		LOG.println(F("[NET] ❌ USE_WIFI_TRANSPORT bật nhưng chưa đặt SECRET_WIFI_SSID!"));
	}
	mqtt.setServer(SECRET_MQTT_HOST, SECRET_MQTT_PORT);
	mqtt.setKeepAlive(MQTT_KEEPALIVE_S);
}

// Đảm bảo có WiFi. Trả true nếu đã kết nối.
static bool ensureNetwork() {
	if (WiFi.status() == WL_CONNECTED) return true;

	LOG.println(F("[WIFI] Mất kết nối - thử lại..."));
	WiFi.reconnect();
	const uint32_t start = millis();
	while (WiFi.status() != WL_CONNECTED && millis() - start < 10000UL) {
		delay(250);
	}
	if (WiFi.status() != WL_CONNECTED) {
		LOG.println(F("[WIFI] Vẫn chưa kết nối được"));
		return false;
	}
	LOG.print(F("[WIFI] OK, IP: "));
	LOG.println(WiFi.localIP().toString());
	return true;
}

#else
// =========================================================================
// TRANSPORT: modem 4G (MẶC ĐỊNH - dùng ngoài hiện trường).
// TINY_GSM_MODEM_A7672X khai báo ở platformio.ini (họ A76xx của A7680/A7682).
// =========================================================================
#include <TinyGsmClient.h>

static TinyGsm modem(Serial2);
// MQTT over TLS: dùng client bảo mật của modem (cổng 8883, khớp broker production).
static TinyGsmClientSecure netClient(modem);
static PubSubClient mqtt(netClient);

void modemBegin() {
	// Bật module qua chân PEN (theo sơ đồ: không dùng MOSFET nguồn).
	pinMode(PIN_MODEM_PEN, OUTPUT);
	digitalWrite(PIN_MODEM_PEN, HIGH);
	delay(1500);  // chờ module ổn định nguồn trước khi nói AT

	Serial2.begin(MODEM_BAUD, SERIAL_8N1, PIN_MODEM_RX, PIN_MODEM_TX);
	delay(3000);

	LOG.println(F("[MODEM] Khởi tạo..."));

	// Chờ modem phản hồi AT ở MODEM_BAUD (boot có thể mất 5-15s).
	bool atOk = false;
	for (uint8_t i = 1; i <= 10; i++) {
		LOG.printf("[MODEM] Test AT lần %u/10 (baud=%d)...\n", i, MODEM_BAUD);
		if (modem.testAT(2000)) {
			atOk = true;
			break;
		}
	}

	// Vẫn im lặng ở baud cấu hình -> tự dò qua các baud phổ biến khác để loại trừ
	// khả năng modem đang chạy baud khác MODEM_BAUD, trước khi kết luận lỗi dây.
	if (!atOk) {
		LOG.println(F("[MODEM] Chưa thấy phản hồi - tự dò các baud rate khác..."));
		const uint32_t altBauds[] = {9600, 19200, 38400, 57600, 230400, 460800};
		for (uint32_t baud : altBauds) {
			LOG.printf("[MODEM] Thử baud=%d...\n", baud);
			Serial2.updateBaudRate(baud);
			delay(100);
			if (modem.testAT(800) || modem.testAT(800) || modem.testAT(800)) {
				atOk = true;
				LOG.printf("[MODEM] ✅ Modem phản hồi Ở BAUD KHÁC: %d!\n", baud);
				LOG.printf("[MODEM]    -> Sửa MODEM_BAUD trong config.h thành %d rồi nạp lại.\n", baud);
				break;
			}
		}
	}

	if (!atOk) {
		LOG.println(F("[MODEM] ❌ Modem KHÔNG phản hồi AT ở BẤT KỲ baud nào đã thử!"));
		LOG.println(F("[MODEM]   -> Đã loại trừ baud rate. Nguyên nhân còn lại gần như chắc"));
		LOG.println(F("[MODEM]   chắn là DÂY/TIẾP XÚC: đo thông mạch GPIO16<->TXD modem và"));
		LOG.println(F("[MODEM]   GPIO17<->RXD modem bằng đồng hồ vạn năng (tắt nguồn khi đo)."));
		mqtt.setServer(SECRET_MQTT_HOST, SECRET_MQTT_PORT);
		mqtt.setKeepAlive(MQTT_KEEPALIVE_S);
		return;  // bỏ qua phần còn lại, không có modem thì hỏi SIM vô nghĩa
	}
	LOG.println(F("[MODEM] ✅ Modem phản hồi AT - UART OK"));

	modem.restart();
	LOG.print(F("[MODEM] Info: "));
	LOG.println(modem.getModemInfo());

	// --- Kiểm tra SIM ---
	const SimStatus sim = modem.getSimStatus();
	LOG.print(F("[SIM] Trạng thái: "));
	LOG.println(
		sim == SIM_READY      ? F("READY (SIM tốt, không khóa PIN)") :
		sim == SIM_LOCKED     ? F("LOCKED (SIM bị khóa PIN!)") :
		sim == SIM_ANTITHEFT_LOCKED ? F("ANTITHEFT_LOCKED") :
		F("ERROR (không nhận SIM - kiểm tra khe cắm/chiều SIM)"));

	const String ccid = modem.getSimCCID();
	if (ccid.length() > 0) {
		LOG.print(F("[SIM] CCID: "));
		LOG.println(ccid);
	}

	// CSQ 0-31 (càng cao càng khỏe); 99 = chưa có sóng.
	LOG.print(F("[SIM] Cường độ sóng (CSQ): "));
	LOG.println(modem.getSignalQuality());

	mqtt.setServer(SECRET_MQTT_HOST, SECRET_MQTT_PORT);
	mqtt.setKeepAlive(MQTT_KEEPALIVE_S);
}

// Kết nối lớp mạng (SIM + GPRS/LTE). Trả true nếu có IP.
static bool ensureNetwork() {
	if (modem.isGprsConnected()) return true;

	// Probe AT nhanh trước: nếu modem không phản hồi (chưa gắn / lỗi UART) thì
	// bỏ qua ngay, tránh kẹt 60s ở waitForNetwork mỗi chu kỳ. Modem sống lại sau
	// sẽ tự qua được ở chu kỳ kế (testAT đậu lại).
	if (!modem.testAT(1000)) {
		Serial.println(F("[MODEM] Không phản hồi AT - bỏ qua chu kỳ mạng"));
		return false;
	}

	Serial.println(F("[MODEM] Chờ sóng mạng..."));
	if (!modem.waitForNetwork(60000L)) {
		LOG.println(F("[MODEM] Không bắt được sóng"));
		return false;
	}

	LOG.print(F("[MODEM] Kết nối APN "));
	LOG.println(SECRET_APN);
	if (!modem.gprsConnect(SECRET_APN, SECRET_APN_USER, SECRET_APN_PASS)) {
		LOG.println(F("[MODEM] GPRS thất bại"));
		return false;
	}
	LOG.print(F("[MODEM] Đã có IP: "));
	LOG.println(modem.localIP().toString());
	LOG.print(F("[MODEM] Nhà mạng: "));
	LOG.println(modem.getOperator());
	return true;
}

#endif  // USE_WIFI_TRANSPORT

// =========================================================================
// Phần chung cho cả 2 transport (MQTT chạy trên `netClient` đã chọn ở trên).
// =========================================================================

// Kết nối phiên MQTT tới broker. Trả true nếu đã connected.
static bool ensureMqtt() {
	if (mqtt.connected()) return true;

	LOG.print(F("[MQTT] Kết nối broker..."));
	bool ok = (strlen(SECRET_MQTT_USER) > 0)
		? mqtt.connect(MQTT_CLIENT_ID, SECRET_MQTT_USER, SECRET_MQTT_PASS)
		: mqtt.connect(MQTT_CLIENT_ID);

	if (ok) {
		LOG.println(F(" OK"));
	} else {
		LOG.print(F(" lỗi, rc="));
		LOG.println(mqtt.state());
	}
	return ok;
}

bool modemEnsureConnected() {
	return ensureNetwork() && ensureMqtt();
}

bool mqttPublishTelemetry(const char* json) {
	if (!mqtt.connected()) return false;
	const bool ok = mqtt.publish(TOPIC, json);
	LOG.print(F("[MQTT] publish "));
	LOG.print(TOPIC);
	LOG.print(F(" => "));
	LOG.println(ok ? json : "FAILED");
	return ok;
}

void mqttLoop() {
	mqtt.loop();
}
