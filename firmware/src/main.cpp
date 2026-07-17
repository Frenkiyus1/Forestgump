// SaliGuard - Firmware ESP32 DevKit V1 (khối 9 trong sơ đồ).
// Luồng: đọc DS18B20 + TDS -> tạo JSON {temp, ec, level} -> gửi MQTT qua WiFi
// (USE_WIFI_TRANSPORT ở config.h - 4G tạm chưa dùng được). Đã BỎ log microSD
// (module SD hiện không gắn) - khung điều khiển 2 DRV8825 sẵn sàng (chưa auto-track).
//
// Payload khớp backend (CLAUDE.md, mục 5.2): topic waterqa/<station_id>/telemetry.

#include <Arduino.h>
#include <ArduinoJson.h>
#include "config.h"
#include "sensors.h"
#include "modem-mqtt.h"
#include "solar-tracker.h"
#include "net-log.h"

static uint32_t lastTelemetryMs = 0;

// Dựng JSON telemetry vào buffer. Chỉ gồm temp/ec/level đúng hợp đồng backend;
// vbat không đẩy lên broker (chỉ in ra log để theo dõi).
// DS18B20 mất kết nối -> temp = 0 (thay vì bỏ cả chu kỳ) để EC/level vẫn lên VPS.
static void buildTelemetryJson(const SensorReading& r, char* out, size_t len) {
	const float temp = isnan(r.temp) ? 0.0f : r.temp;
	JsonDocument doc;
	doc["temp"] = round(temp * 10) / 10.0;     // 1 chữ số thập phân
	doc["ec"] = round(r.ec * 1000) / 1000.0;   // g/L, 3 chữ số
	doc["level"] = r.level;                     // = 0 (mực nước lấy từ web VN)
	serializeJson(doc, out, len);
}

// --- Tự test motor khi cấp điện (KHÔNG cần gõ terminal) ---
// Mỗi lần board khởi động: nghiêng đi rồi về, xoay đi rồi về. Quay CHẬM và NHIỀU
// bước (≈3 vòng/lượt ở full-step) để mắt thường thấy rõ chuyển động khi bring-up
// phần cứng - xoá lời gọi ở setup() khi xong test.
static void motorSelfTestOnBoot() {
	const int32_t TEST_STEPS = 600;       // ≈3 vòng nếu driver ở full-step (200 bước/vòng)
	const uint16_t TEST_DELAY_US = 2000;  // chậm hơn mặc định (800us) để dễ quan sát

	Serial.println(F("[TEST] Tự test motor lúc khởi động (quay chậm để dễ quan sát)..."));

	Serial.println(F("[TEST] Trục NGHIÊNG quay thuận..."));
	trackerMoveSteps(Axis::Tilt, TEST_STEPS, TEST_DELAY_US);
	delay(800);
	Serial.println(F("[TEST] Trục NGHIÊNG quay ngược (về lại)..."));
	trackerMoveSteps(Axis::Tilt, -TEST_STEPS, TEST_DELAY_US);
	delay(800);

	Serial.println(F("[TEST] Trục XOAY quay thuận..."));
	trackerMoveSteps(Axis::Rotate, TEST_STEPS, TEST_DELAY_US);
	delay(800);
	Serial.println(F("[TEST] Trục XOAY quay ngược (về lại)..."));
	trackerMoveSteps(Axis::Rotate, -TEST_STEPS, TEST_DELAY_US);

	Serial.println(F("[TEST] Xong tự test motor."));
}

// --- Test motor thủ công qua Serial Monitor (tuỳ chọn, không bắt buộc) ---
// Gõ trong monitor: "t <steps>" quay trục NGHIÊNG, "r <steps>" quay trục XOAY.
// steps âm = chiều ngược. Vd: t 200 | t -200 | r 100.
static void handleMotorTestSerial() {
	if (!Serial.available()) return;

	String line = Serial.readStringUntil('\n');
	line.trim();
	if (line.length() < 2) return;

	const char axisChar = line.charAt(0);
	const int32_t steps = line.substring(1).toInt();

	if (axisChar == 't' || axisChar == 'T') {
		Serial.printf("[TEST] Trục NGHIÊNG quay %ld bước...\n", (long)steps);
		trackerMoveSteps(Axis::Tilt, steps);
		Serial.println(F("[TEST] Xong."));
	} else if (axisChar == 'r' || axisChar == 'R') {
		Serial.printf("[TEST] Trục XOAY quay %ld bước...\n", (long)steps);
		trackerMoveSteps(Axis::Rotate, steps);
		Serial.println(F("[TEST] Xong."));
	} else {
		Serial.println(F("[TEST] Sai cú pháp. Dùng: t <steps> | r <steps>  (vd: t 200, r -100)"));
	}
}

static void publishCycle() {
	const SensorReading r = sensorsRead();

	// In giá trị đo được ra Serial Monitor để kiểm tra cảm biến.
	// vRaw = điện áp thô của TDS - dùng số này để điền SALINITY_CAL_* trong
	// config.h khi hiệu chuẩn (xem README mục Hiệu chuẩn).
	LOG.printf("[SENS] temp=%.2f C | ec=%.3f g/L | vRaw=%.4f V | level=%.2f m | vbat=%.2f V\n",
	              r.temp, r.ec, r.tdsRawV, r.level, r.vbat);

	if (isnan(r.temp)) {
		LOG.println(F("[SENS] DS18B20 mất kết nối - gửi temp=0 tạm thời"));
	}

	char json[128];
	buildTelemetryJson(r, json, sizeof(json));

	if (r.ec > RED_THRESHOLD_GL) {
		LOG.printf("[ALERT] 🔴 Độ mặn %.2f g/L > %.1f g/L\n", r.ec, RED_THRESHOLD_GL);
	}

	if (modemEnsureConnected()) {
		mqttPublishTelemetry(json);
	} else {
		LOG.println(F("[NET] Không kết nối được - bỏ chu kỳ này"));
	}
}

void setup() {
	Serial.begin(115200);
	delay(200);
	LOG.println(F("\n=== SaliGuard firmware - station " SECRET_STATION_ID " ==="));

	netLogBegin();   // bật WiFi Telnet + OTA để xem log / nạp không cần cáp USB

	sensorsBegin();
	trackerBegin();
	modemBegin();

	// motorSelfTestOnBoot();  // TẮT TẠM: đang treo máy ở bước quay ngược trục
	// NGHIÊNG (kiểm tra lại dây/driver DRV8825 trục Tilt) - chặn luôn publishCycle()
	// đầu tiên nên data không lên được VPS. Bật lại khi đã sửa xong phần cứng.

	publishCycle();          // gửi ngay 1 lần lúc khởi động
	lastTelemetryMs = millis();
}

void loop() {
	netLogLoop();  // nhận client Telnet + xử lý OTA
	mqttLoop();  // giữ phiên MQTT sống giữa các chu kỳ

	handleMotorTestSerial();  // cho phép test motor bằng lệnh serial (t/r <steps>)

	if (millis() - lastTelemetryMs >= TELEMETRY_PERIOD_MS) {
		publishCycle();
		lastTelemetryMs = millis();
	}
}
