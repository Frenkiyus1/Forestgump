#include "net-log.h"
#include "config.h"
#include <WiFi.h>
#include <ArduinoOTA.h>

// Telnet: 1 client tại một thời điểm là đủ để dev xem log.
static WiFiServer telnetServer(23);
static WiFiClient telnetClient;
static bool wifiUp = false;

// --- Ring buffer: lưu ~8KB log gần nhất trong RAM để đọc lại log CŨ khi telnet vào
// trễ (kể cả log boot). LƯU Ý: nằm trong RAM nên MẤT khi reset/mất điện - muốn giữ
// qua lần khởi động thì cần lưu ra flash/SD (xem ghi chú trong reply).
static const size_t LOG_BUF_SIZE = 8192;
static char logBuf[LOG_BUF_SIZE];
static size_t logHead = 0;      // vị trí sẽ ghi byte kế tiếp
static bool logWrapped = false; // đã ghi vòng qua hết buffer chưa

static inline void logBufPush(uint8_t c) {
	logBuf[logHead++] = static_cast<char>(c);
	if (logHead >= LOG_BUF_SIZE) {
		logHead = 0;
		logWrapped = true;
	}
}

// Xổ toàn bộ log đang có trong buffer (cũ -> mới) ra client vừa kết nối.
static void dumpBacklog(WiFiClient& c) {
	if (logWrapped) {
		c.write(reinterpret_cast<const uint8_t*>(logBuf + logHead), LOG_BUF_SIZE - logHead);
	}
	c.write(reinterpret_cast<const uint8_t*>(logBuf), logHead);
}

NetLog LOG;

size_t NetLog::write(uint8_t c) {
	Serial.write(c);  // luôn giữ log qua USB
	logBufPush(c);    // lưu vào ring buffer để đọc lại sau
	if (telnetClient && telnetClient.connected()) {
		telnetClient.write(c);
	}
	return 1;
}

size_t NetLog::write(const uint8_t* buffer, size_t size) {
	Serial.write(buffer, size);
	for (size_t i = 0; i < size; i++) logBufPush(buffer[i]);
	if (telnetClient && telnetClient.connected()) {
		telnetClient.write(buffer, size);
	}
	return size;
}

void netLogBegin() {
	// SSID rỗng -> người dùng chưa cấu hình WiFi, chỉ dùng USB.
	if (strlen(SECRET_WIFI_SSID) == 0) {
		Serial.println(F("[NETLOG] Chưa đặt SECRET_WIFI_SSID - bỏ qua WiFi, chỉ log qua USB."));
		return;
	}

	Serial.print(F("[NETLOG] Kết nối WiFi "));
	Serial.print(SECRET_WIFI_SSID);
	WiFi.mode(WIFI_STA);
	WiFi.begin(SECRET_WIFI_SSID, SECRET_WIFI_PASS);

	const uint32_t start = millis();
	while (WiFi.status() != WL_CONNECTED && millis() - start < 15000UL) {
		delay(500);
		Serial.print('.');
	}
	Serial.println();

	if (WiFi.status() != WL_CONNECTED) {
		Serial.println(F("[NETLOG] WiFi thất bại - chỉ log qua USB."));
		return;
	}
	wifiUp = true;

	Serial.print(F("[NETLOG] WiFi OK. Xem log:  telnet "));
	Serial.print(WiFi.localIP());
	Serial.println(F("  23"));

	telnetServer.begin();
	telnetServer.setNoDelay(true);

	// OTA: nạp firmware qua WiFi (Upload OTA trong PlatformIO), khỏi cắm USB.
	ArduinoOTA.setHostname("forestgump-" SECRET_STATION_ID);
	ArduinoOTA.onStart([]() { Serial.println(F("[OTA] Bắt đầu nạp qua WiFi...")); });
	ArduinoOTA.onEnd([]()   { Serial.println(F("[OTA] Xong, khởi động lại.")); });
	ArduinoOTA.begin();
	Serial.print(F("[NETLOG] OTA sẵn sàng tại IP trên (hostname forestgump-" SECRET_STATION_ID ")."));
	Serial.println();
}

void netLogLoop() {
	if (!wifiUp) return;

	ArduinoOTA.handle();

	// Có client telnet mới muốn kết nối?
	if (telnetServer.hasClient()) {
		if (telnetClient && telnetClient.connected()) {
			telnetServer.available().stop();  // đã có 1 client -> từ chối client thứ 2
		} else {
			telnetClient = telnetServer.available();
			telnetClient.setNoDelay(true);
			telnetClient.println(F("=== ForestGump log (Telnet) - station " SECRET_STATION_ID " ==="));
			telnetClient.println(F("--- LOG CŨ (từ ring buffer) ---"));
			dumpBacklog(telnetClient);
			telnetClient.println(F("--- HẾT LOG CŨ, từ đây là log mới ---"));
		}
	}
}
