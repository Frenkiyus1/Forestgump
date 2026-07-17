#pragma once
#include <Arduino.h>
#include "sensors.h"

// Ghi log telemetry ra microSD (VSPI) dạng CSV để lưu trữ cục bộ khi mất 4G.

// Mount thẻ SD, tạo header CSV nếu file chưa tồn tại. Trả true nếu sẵn sàng.
bool sdBegin();

// Thêm 1 dòng: iso_time,temp,ec,level,vbat,sent. `sent` = đã gửi MQTT thành công?
void sdLog(const SensorReading& r, bool sent);
