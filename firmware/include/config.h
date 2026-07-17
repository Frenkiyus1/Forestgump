#pragma once
// Cấu hình tĩnh: pin map + hằng số. Bí mật (APN, broker, mật khẩu) nằm ở secrets.h.
// Pin map khớp chính xác "Sơ đồ nối dây đầy đủ" (khối 8–15).

#include "secrets.h"

// ---------- Khối 10A: DS18B20 (nhiệt độ nước) ----------
#define PIN_DS18B20        4      // DATA -> GPIO4 (trở kéo 4.7kΩ DATA->3V3 nếu dùng cảm biến trần)

// ---------- Khối 10B: TDS Meter V1.0 (độ mặn) ----------
#define PIN_TDS            35     // AO -> GPIO35 (input-only ADC1)
#define TDS_VREF           3.3f   // điện áp tham chiếu ADC
#define TDS_SAMPLES        30     // số mẫu lấy trung bình để khử nhiễu

// --- Hiệu chuẩn 2 điểm (BẮT BUỘC làm để đo đúng, xem README mục Hiệu chuẩn) ---
// Đo điện áp thô (in ra ở log [SENS] "vRaw=...") khi nhúng cảm biến vào 2 dung
// dịch biết trước nồng độ, rồi điền lại 4 hằng số dưới đây. Nội suy TUYẾN TÍNH
// giữa 2 điểm - không dùng công thức bậc 3 đoán mò như trước nữa.
#define SALINITY_CAL_V_LOW    0.0f   // vRaw đo được ở dung dịch THẤP (vd nước máy/cất)
#define SALINITY_CAL_GL_LOW   0.0f   // độ mặn (g/L) thật của dung dịch THẤP
#define SALINITY_CAL_V_HIGH   2.3f   // vRaw đo được ở dung dịch CAO (vd pha 4g muối/1L nước)
#define SALINITY_CAL_GL_HIGH  4.0f   // độ mặn (g/L) thật của dung dịch CAO

// ---------- Khối 10C: Voltage Sensor 0–25V (điện áp pin BMS) ----------
// TRÙNG CHÂN với PIN_SD_MISO (xem khối 10D) - đang TẮT trong sensors.cpp
// (readBatteryVoltage() trả về 0) để không phá giao tiếp SPI với thẻ SD.
// Đấu VBAT sang chân ADC1 khác (vd GPIO39) rồi bật lại nếu cần dùng.
#define PIN_VBAT           34     // S -> GPIO34 (input-only ADC1)
#define VBAT_DIVIDER       5.0f   // module 0–25V dùng cầu chia tỉ lệ 5:1

// ---------- Khối 10D: microSD (VSPI) ----------
// ĐÃ ĐỔI sang 32/33/34/25 theo dây đấu thật (khác sơ đồ gốc 5/18/23/19).
// LƯU Ý: trùng chân với trục NGHIÊNG (PIN_TILT_*) và PIN_VBAT bên dưới -> trục
// nghiêng + cảm biến pin KHÔNG dùng được cho tới khi đấu lại sang chân khác.
#define PIN_SD_CS          32
#define PIN_SD_SCK         33
#define PIN_SD_MISO        34
#define PIN_SD_MOSI        25
#define SD_LOG_PATH        "/telemetry.csv"

// ---------- Transport telemetry: 4G (mặc định) hay WiFi (test/demo) ----------
// Bỏ comment dòng dưới để gửi MQTT qua WiFi thay vì modem 4G. Dùng khi module 4G
// hỏng/chưa có, muốn test cả pipeline bằng WiFi hoặc hotspot điện thoại.
// CHỈ để kiểm thử: bản chạy ngoài hiện trường (ven biển, không WiFi) vẫn cần 4G.
// Khi bật, phải điền SECRET_WIFI_SSID/PASS trong secrets.h (WiFi bắt buộc).
// ĐANG BẬT: module 4G hiện chưa dùng được -> tạm dùng WiFi để đẩy telemetry lên
// VPS. Comment lại dòng #define bên dưới khi nào 4G chạy lại được.
#define USE_WIFI_TRANSPORT

// ---------- Khối 11: Module 4G TDM-4G-V2 (A7680/A7682) trên Serial2 ----------
#define PIN_MODEM_RX       16     // ESP32 RX2 <- modem TXD
#define PIN_MODEM_TX       17     // ESP32 TX2 -> modem RXD
#define PIN_MODEM_PEN      27     // PEN: bật/tắt module (không dùng MOSFET nguồn)
#define MODEM_BAUD         115200

// ---------- Khối 12: DRV8825 trục NGHIÊNG (vít me T8) ----------
// RESET & SLEEP nối chung kéo lên 3V3 (theo sơ đồ) -> chỉ cần STEP/DIR/EN từ ESP32.
// TRÙNG CHÂN với PIN_SD_CS/SCK/MOSI (xem khối 10D) - trục nghiêng KHÔNG dùng được
// cho tới khi đấu lại sang GPIO khác (trục quay ở khối 14 không bị ảnh hưởng).
#define PIN_TILT_STEP      32
#define PIN_TILT_DIR       33
#define PIN_TILT_EN        25     // active-LOW: LOW = cấp dòng, HIGH = nhả

// ---------- Khối 14: DRV8825 trục QUAY (mâm xoay) ----------
// Lưu ý: GPIO12 là chân strapping (MTDI) - phải LOW lúc boot, EN có pulldown nên an toàn.
#define PIN_ROT_STEP       26
#define PIN_ROT_DIR        14
#define PIN_ROT_EN         12     // active-LOW

// ---------- Chu kỳ & ngưỡng ----------
#define TELEMETRY_PERIOD_MS   3000UL    // gửi telemetry mỗi 3s (demo)
#define MQTT_KEEPALIVE_S      60
#define RED_THRESHOLD_GL      4.0f      // độ mặn cảnh báo đỏ (chỉ để log tại chỗ)

// Topic MQTT khớp backend: waterqa/<station_id>/telemetry
#define MQTT_TOPIC_PREFIX  "waterqa/"
#define MQTT_TOPIC_SUFFIX  "/telemetry"
