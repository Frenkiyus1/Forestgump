#pragma once
#include <Arduino.h>

// Một lần đo đầy đủ. `level` luôn = 0 vì mực nước lấy realtime từ web VN ở tầng khác,
// phần cứng không gắn cảm biến mực nước (giữ trường này để khớp payload backend).
struct SensorReading {
	float temp;    // nhiệt độ nước (°C) - DS18B20
	float ec;      // độ mặn (g/L) - quy đổi từ TDS qua hiệu chuẩn 2 điểm
	float level;   // mực nước (m) - placeholder = 0
	float vbat;    // điện áp pin (V) - chỉ để log/giám sát, không gửi MQTT
	float tdsRawV; // điện áp thô CHƯA bù nhiệt của cảm biến TDS - dùng để hiệu chuẩn
};

// Khởi tạo DS18B20 + ADC. Gọi 1 lần trong setup().
void sensorsBegin();

// Đọc đồng bộ tất cả cảm biến. EC được bù nhiệt theo `temp` vừa đo.
SensorReading sensorsRead();
