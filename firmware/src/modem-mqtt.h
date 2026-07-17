#pragma once
#include <Arduino.h>

// Quản lý modem 4G (TinyGSM) + MQTT (PubSubClient). Tất cả trạng thái kết nối
// đóng gói trong file này; main.cpp chỉ gọi begin/ensureConnected/publish/loop.

// Bật nguồn modem (chân PEN) và mở Serial2. Gọi 1 lần trong setup().
void modemBegin();

// Đảm bảo đã có mạng GPRS/LTE + phiên MQTT. Tự reconnect nếu rớt.
// Trả true nếu sẵn sàng publish.
bool modemEnsureConnected();

// Publish JSON telemetry lên waterqa/<station_id>/telemetry. Trả true nếu gửi xong.
bool mqttPublishTelemetry(const char* json);

// Giữ phiên MQTT sống (gọi thường xuyên trong loop()).
void mqttLoop();
