#pragma once
#include <Arduino.h>
#include <Print.h>

// Xem log ESP32 KHÔNG cần cáp USB: in log ra CẢ Serial (USB) LẪN Telnet (WiFi).
// Dùng LOG.print/println/printf thay cho Serial.print/... ở toàn bộ code.
// WiFi chạy song song, độc lập với modem 4G (khác phần cứng) - không ảnh hưởng telemetry.
class NetLog : public Print {
public:
	size_t write(uint8_t c) override;
	size_t write(const uint8_t* buffer, size_t size) override;
};

// Đối tượng log toàn cục (khai báo thực thể ở net-log.cpp).
extern NetLog LOG;

// Kết nối WiFi (nếu SECRET_WIFI_SSID khác rỗng) + mở Telnet server (cổng 23) + bật OTA.
// Gọi 1 lần trong setup(), sau Serial.begin().
void netLogBegin();

// Nhận client Telnet mới + xử lý OTA. Gọi thường xuyên trong loop().
void netLogLoop();
