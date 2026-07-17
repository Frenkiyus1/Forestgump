#pragma once
#include <Arduino.h>

// Khung điều khiển 2 trục pin mặt trời (DRV8825 ×2). Hiện ở mức STUB/thủ công:
// chưa tự động dò nắng (sơ đồ chưa có cảm biến LDR). Cung cấp sẵn moveSteps để
// gọi tay hoặc gắn thuật toán tracking sau này.

enum class Axis { Tilt, Rotate };

// Cấu hình chân DRV8825, giữ driver ở trạng thái NHẢ (EN=HIGH) để tiết kiệm điện.
void trackerBegin();

// Quay một trục `steps` bước (âm = chiều ngược). Tự cấp dòng (EN=LOW) khi chạy
// rồi nhả lại khi xong. `stepDelayUs` quyết định tốc độ (nửa chu kỳ xung STEP).
void trackerMoveSteps(Axis axis, int32_t steps, uint16_t stepDelayUs = 800);
