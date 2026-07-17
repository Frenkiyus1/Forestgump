#include "sensors.h"
#include "config.h"
#include <OneWire.h>
#include <DallasTemperature.h>

static OneWire oneWire(PIN_DS18B20);
static DallasTemperature ds18b20(&oneWire);

void sensorsBegin() {
	ds18b20.begin();
	// ADC1 (GPIO34/35): 12-bit, dải đầy đủ ~0–3.3V cho cảm biến chia áp.
	analogReadResolution(12);
	analogSetPinAttenuation(PIN_TDS, ADC_11db);
	// PIN_VBAT (GPIO34) hiện TRÙNG với PIN_SD_MISO - KHÔNG cấu hình ADC ở đây nữa,
	// xem lý do ở readBatteryVoltage().
}

// Đọc DS18B20; trả NAN nếu cảm biến mất kết nối để tầng trên xử lý.
static float readTemperature() {
	ds18b20.requestTemperatures();
	const float t = ds18b20.getTempCByIndex(0);
	return (t == DEVICE_DISCONNECTED_C) ? NAN : t;
}

// Trung bình ADC nhiều mẫu -> giảm nhiễu cho tín hiệu analog chậm.
static float averageAdcVoltage(uint8_t pin) {
	uint32_t sum = 0;
	for (uint8_t i = 0; i < TDS_SAMPLES; i++) {
		sum += analogRead(pin);
		delay(2);
	}
	const float raw = static_cast<float>(sum) / TDS_SAMPLES;
	return raw / 4095.0f * TDS_VREF;
}

// TDS Meter V1.0 -> độ mặn (g/L). Bù nhiệt rồi NỘI SUY TUYẾN TÍNH giữa 2 điểm
// hiệu chuẩn thực tế (SALINITY_CAL_* trong config.h) - xem README mục Hiệu chuẩn.
// `vRawOut` (nếu khác nullptr) trả điện áp thô CHƯA bù nhiệt, dùng lúc hiệu chuẩn.
static float readSalinity(float temp, float* vRawOut = nullptr) {
	const float voltage = averageAdcVoltage(PIN_TDS);
	if (vRawOut) *vRawOut = voltage;

	const float comp = 1.0f + 0.02f * ((isnan(temp) ? 25.0f : temp) - 25.0f);
	const float v = voltage / comp;

	const float slope = (SALINITY_CAL_GL_HIGH - SALINITY_CAL_GL_LOW) /
	                     (SALINITY_CAL_V_HIGH - SALINITY_CAL_V_LOW);
	const float salinity = SALINITY_CAL_GL_LOW + (v - SALINITY_CAL_V_LOW) * slope;
	return salinity < 0.0f ? 0.0f : salinity;
}

// Voltage Sensor 0–25V: nhân lại tỉ lệ cầu chia để ra điện áp pin thực.
// TẮT TẠM: PIN_VBAT (GPIO34) hiện trùng với PIN_SD_MISO (đã đổi dây SD sang
// 32/33/34/25). Nếu analogRead ở đây, nó sẽ phá giao tiếp SPI với thẻ SD mỗi
// chu kỳ. Trả về 0 cho tới khi VBAT được đấu sang chân khác không xung đột.
static float readBatteryVoltage() {
	return 0.0f;
}

SensorReading sensorsRead() {
	SensorReading r;
	r.temp = readTemperature();
	r.ec = readSalinity(r.temp, &r.tdsRawV);
	r.level = 0.0f;  // mực nước lấy từ web VN, không đo tại trạm
	r.vbat = readBatteryVoltage();
	return r;
}
