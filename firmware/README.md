# SaliGuard Firmware (ESP32 DevKit V1)

Khối `/firmware`: đọc cảm biến nước, gửi telemetry qua **4G/MQTT** về backend, log **microSD**,
và giữ sẵn khung điều khiển **2 trục pin mặt trời** (2×DRV8825 / NEMA17).

## Luồng dữ liệu
```
DS18B20 + TDS  ──►  ESP32  ──► JSON {temp, ec, level}  ──► MQTT (4G)
                      │                                     topic: waterqa/ST001/telemetry
                      └──► microSD (telemetry.csv, lưu cục bộ khi mất sóng)
```
Payload khớp hợp đồng backend (`CLAUDE.md` mục 5.2). `level = 0` vì mực nước được lấy
realtime từ web Việt Nam ở tầng khác — trạm không gắn cảm biến mực nước.

## Pin map (khớp "Sơ đồ nối dây đầy đủ")
| Khối | Tín hiệu | GPIO |
|------|----------|------|
| DS18B20 | DATA | 4 |
| TDS Meter | AO | 35 |
| Voltage 0–25V | S | 34 |
| microSD (VSPI) | CS / SCK / MOSI / MISO | 5 / 18 / 23 / 19 |
| 4G TDM-4G-V2 | RX2 / TX2 / PEN | 16 / 17 / 27 |
| DRV8825 nghiêng | STEP / DIR / EN | 32 / 33 / 25 |
| DRV8825 quay | STEP / DIR / EN | 26 / 14 / 12 |

> RESET & SLEEP của mỗi DRV8825 nối chung kéo lên 3V3 (theo sơ đồ) nên ESP32 chỉ điều
> khiển STEP/DIR/EN. Nếu bạn nối khác, sửa lại trong `include/config.h`.

## Build & nạp
```bash
cd firmware
cp include/secrets.example.h include/secrets.h   # rồi điền APN + broker thật
pio run                # biên dịch
pio run -t upload      # nạp ESP32
pio device monitor     # xem log 115200 baud
```

## Ghi chú phần cứng (theo sơ đồ)
- Module 4G bật/tắt bằng chân **PEN** (không dùng MOSFET nguồn) — đã xử lý trong `modemBegin()`.
- A7680/A7682 dùng hồ sơ **SIM7600** của TinyGSM (đặt ở `platformio.ini`).
- **Không cắm/rút motor khi DRV8825 đang có điện.** Chỉnh dòng VREF trên driver trước.
- Tất cả GND nối chung; XL4015 chỉnh đúng **5.0V** trước khi cấp cho ESP32 & 4G.

## MQTT over TLS (cổng 8883)
Firmware dùng `TinyGsmClientSecure` → kết nối tới broker production được **mã hoá**
(cổng 8883, khớp `docker-compose.prod.yml`). Đặt `SECRET_MQTT_PORT 8883` + user/pass
trong `secrets.h`. Kết nối mã hoá bảo vệ mật khẩu khi đi qua Internet.

> Muốn **CA pinning** (xác thực chứng chỉ broker chặt chẽ) thì phải nạp CA của
> Let's Encrypt vào A7680 bằng lệnh `AT+CCERTDOWN` / `AT+CSSLCFG`. Làm bước này sau
> khi kết nối TLS cơ bản đã chạy ổn — báo mình hỗ trợ nếu cần.

## Việc còn lại (TODO)
- [ ] Tracking 2 trục tự động: hiện là **stub** (gọi `trackerMoveSteps()` thủ công). Cần thêm
      4×LDR hoặc tính vị trí mặt trời theo giờ (NTP qua 4G) để dò nắng vòng kín.
- [ ] RTC/NTP để log SD có mốc thời gian thật thay cho `millis()`.
- [ ] CA pinning cho MQTT TLS (nạp chứng chỉ vào modem).
