-- SaliGuard - Database schema (PostgreSQL + TimescaleDB)
-- Chỉ dùng 1 bảng `telemetry` dạng hypertable.

-- Bật extension TimescaleDB (cần quyền superuser).
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Bảng danh mục các trạm đo (thông tin tĩnh: tên, toạ độ).
-- Dùng cho GET /api/stations và để Dashboard vẽ bản đồ.
CREATE TABLE IF NOT EXISTS stations (
    station_id   TEXT PRIMARY KEY,
    name         TEXT             NOT NULL,
    region       TEXT             NOT NULL DEFAULT '',
    lat          DOUBLE PRECISION NOT NULL,
    lon          DOUBLE PRECISION NOT NULL,
    river        TEXT,                             -- nhánh sông ('cam' | 'lachtray' | 'vanuc'), dùng để vẽ station-map.svelte
    is_aggregate BOOLEAN          NOT NULL DEFAULT FALSE -- true = trạm TỔNG HỢP (giá trị trung bình cả nhánh), không phải cảm biến vật lý riêng
);

-- Bảng đã tồn tại từ trước (chưa có 2 cột trên) => thêm cho an toàn khi chạy lại.
ALTER TABLE stations ADD COLUMN IF NOT EXISTS river TEXT;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS is_aggregate BOOLEAN NOT NULL DEFAULT FALSE;

-- Dữ liệu mẫu: roster trạm dọc 3 nhánh sông chính đổ ra biển ở Hải Phòng (khớp
-- dashboard/src/lib/stations-mock.ts). ON CONFLICT DO UPDATE => script này là
-- nguồn dữ liệu duy nhất cho danh mục trạm, chạy lại nhiều lần luôn đồng bộ.
-- ST001 là trạm gắn phần cứng thật (khớp REAL_STATION_ID trong .env);
-- các trạm còn lại trả dữ liệu mock.
INSERT INTO stations (station_id, name, region, lat, lon, river, is_aggregate) VALUES
    ('ST001', 'Cửa sông Văn Úc',            'Tiên Lãng',   20.6712, 106.5483, 'vanuc',    FALSE),
    ('ST002', 'Cửa sông Bạch Đằng',         'Thủy Nguyên', 20.7891, 106.7654, 'cam',      FALSE),
    ('ST003', 'Cửa sông Lạch Tray',         'Hải An',      20.8123, 106.6892, 'lachtray', FALSE),
    ('ST004', 'Cửa Cấm',                    'Hải An',      20.8550, 106.7200, 'cam',      FALSE),
    ('ST005', 'Sông Đa Độ',                 'Kiến Thụy',   20.7400, 106.6200, 'vanuc',    FALSE),
    ('ST006', 'Cửa Nam Triệu',              'Cát Hải',     20.8300, 106.8500, 'cam',      FALSE),
    ('ST007', 'Sông Thái Bình',             'Vĩnh Bảo',    20.6100, 106.4500, 'vanuc',    FALSE),
    ('ST008', 'Bến Đồ Sơn',                 'Đồ Sơn',      20.7100, 106.7800, 'lachtray', FALSE),
    ('ST009', 'Cầu Kiền',                   'Thủy Nguyên', 20.8600, 106.6200, 'cam',      FALSE),
    ('ST010', 'Cầu Rào',                    'Ngô Quyền',   20.8450, 106.7000, 'lachtray', FALSE),
    ('ST011', 'Cầu Niệm',                   'Kiến An',     20.8000, 106.6300, 'lachtray', FALSE),
    ('ST012', 'Cầu Khuể',                   'An Lão',      20.7200, 106.5800, 'vanuc',    FALSE),
    ('ST013', 'Trạm tổng hợp sông Cấm',      'Thủy Nguyên', 20.8600, 106.8000, 'cam',      TRUE),
    ('ST014', 'Trạm tổng hợp sông Lạch Tray','Kiến An',     20.8000, 106.7200, 'lachtray', TRUE),
    ('ST015', 'Trạm tổng hợp sông Văn Úc',   'Tiên Lãng',   20.6500, 106.5200, 'vanuc',    TRUE)
ON CONFLICT (station_id) DO UPDATE SET
    name = EXCLUDED.name,
    region = EXCLUDED.region,
    lat = EXCLUDED.lat,
    lon = EXCLUDED.lon,
    river = EXCLUDED.river,
    is_aggregate = EXCLUDED.is_aggregate;

-- Bảng lưu dữ liệu quan trắc từ các trạm cảm biến.
CREATE TABLE IF NOT EXISTS telemetry (
    time         TIMESTAMPTZ NOT NULL,
    station_id   TEXT        NOT NULL,
    temp         REAL,
    ec           REAL,
    level        REAL,
    forecast_24h REAL, -- dự báo độ mặn 24h do AI Engine trả về (lưu sẵn để API đọc nhanh)
    forecast_48h REAL  -- dự báo độ mặn 48h do AI Engine trả về
);

-- Bảng đã tồn tại từ trước (chưa có cột 48h) => thêm cột cho an toàn khi chạy lại.
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS forecast_48h REAL;

-- Chuyển telemetry thành hypertable, phân mảnh theo cột thời gian.
-- if_not_exists => chạy lại script nhiều lần không gây lỗi.
SELECT create_hypertable('telemetry', 'time', if_not_exists => TRUE);

-- Index hỗ trợ truy vấn dữ liệu mới nhất theo từng trạm.
CREATE INDEX IF NOT EXISTS idx_telemetry_station_time
    ON telemetry (station_id, time DESC);
