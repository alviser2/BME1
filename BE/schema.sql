-- ==========================================
-- BME1 IV Bag Monitoring System - Database Schema
-- PostgreSQL
-- ==========================================

-- Xóa tables nếu tồn tại (để reset)
DROP TABLE IF EXISTS bag_logs CASCADE;
DROP TABLE IF EXISTS iv_bags CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS esp32_devices CASCADE;
DROP TABLE IF EXISTS reported_machines CASCADE;

-- ==========================================
-- 1. Bảng Bệnh nhân
-- ==========================================
CREATE TABLE patients (
    id          VARCHAR(50) PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    room        VARCHAR(20) NOT NULL,
    bed         VARCHAR(20) NOT NULL,
    age         INT,
    condition   VARCHAR(200),
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- 2. Bảng Bình truyền
-- ==========================================
CREATE TABLE iv_bags (
    id              VARCHAR(50) PRIMARY KEY,
    patient_id      VARCHAR(50) NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    esp32_id        VARCHAR(50),
    type            VARCHAR(100) NOT NULL,
    initial_volume  INT NOT NULL,
    current_volume  INT NOT NULL,
    flow_rate       DECIMAL(10,2) NOT NULL,
    start_time      TIMESTAMP NOT NULL,
    status          VARCHAR(20) DEFAULT 'running',
    empty_timestamp TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- 3. Bảng Lịch sử Log (tần suất ghi 5s)
-- ==========================================
CREATE TABLE bag_logs (
    id          BIGSERIAL PRIMARY KEY,
    bag_id      VARCHAR(50) NOT NULL REFERENCES iv_bags(id) ON DELETE CASCADE,
    time        TIMESTAMP NOT NULL,
    volume      DECIMAL(10,2) NOT NULL,
    flow_rate   DECIMAL(10,2) NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Index để query nhanh cho chart
CREATE INDEX idx_bag_logs_bag_id ON bag_logs(bag_id);
CREATE INDEX idx_bag_logs_bag_time ON bag_logs(bag_id, time DESC);

-- ==========================================
-- 4. Bảng ESP32 Devices
-- ==========================================
CREATE TABLE esp32_devices (
    id              VARCHAR(50) PRIMARY KEY,
    status          VARCHAR(20) DEFAULT 'offline',  -- offline | online | busy
    current_bag_id  VARCHAR(50),                     -- bag đang theo dõi (nếu busy)
    registered_at   TIMESTAMP DEFAULT NOW(),
    last_seen_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_esp32_devices_status ON esp32_devices(status);

-- ==========================================
-- 5. Bảng Máy báo lỗi
-- ==========================================
CREATE TABLE reported_machines (
    id          BIGSERIAL PRIMARY KEY,
    esp32_id    VARCHAR(50) NOT NULL,
    room_bed    VARCHAR(50) NOT NULL,
    reported_at TIMESTAMP NOT NULL,
    status      VARCHAR(20) DEFAULT 'pending',
    resolved_at TIMESTAMP,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Index cho truy vấn nhanh
CREATE INDEX idx_reported_machines_status ON reported_machines(status);
CREATE INDEX idx_reported_machines_esp32 ON reported_machines(esp32_id);

-- ==========================================
-- INSERT MOCK DATA
-- ==========================================

-- Thêm bệnh nhân
INSERT INTO patients (id, name, room, bed, age, condition) VALUES
    ('p1', 'Nguyễn Văn A', '101', '1', 45, 'Sốt xuất huyết'),
    ('p2', 'Trần Thị B', '102', '3', 60, 'Tiêu chảy cấp'),
    ('p3', 'Lê Văn C', '205', '2', 32, 'Mất nước');

-- Thêm bình truyền
INSERT INTO iv_bags (id, patient_id, esp32_id, type, initial_volume, current_volume, flow_rate, start_time, status) VALUES
    ('b1', 'p1', 'ESP32_001', 'Nước muối sinh lý 0.9%', 500, 350, 40, NOW() - INTERVAL '1 hour', 'running'),
    ('b2', 'p2', 'ESP32_002', 'Glucose 5%', 1000, 900, 60, NOW() - INTERVAL '15 minutes', 'running'),
    ('b3', 'p3', NULL, 'Ringer Lactate', 500, 0, 30, NOW() - INTERVAL '4 hours', 'completed');

-- Thêm log data cho bình b1 (một số entry mẫu)
INSERT INTO bag_logs (bag_id, time, volume, flow_rate) VALUES
    ('b1', NOW() - INTERVAL '55 minutes', 450, 40.2),
    ('b1', NOW() - INTERVAL '50 minutes', 420, 39.8),
    ('b1', NOW() - OFFSET '45 minutes', 390, 40.5),
    ('b1', NOW() - INTERVAL '40 minutes', 360, 39.5),
    ('b1', NOW() - INTERVAL '35 minutes', 330, 40.1),
    ('b1', NOW() - INTERVAL '30 minutes', 300, 39.9),
    ('b1', NOW() - INTERVAL '25 minutes', 270, 40.3),
    ('b1', NOW() - INTERVAL '20 minutes', 240, 39.7),
    ('b1', NOW() - INTERVAL '15 minutes', 210, 40.0),
    ('b1', NOW() - INTERVAL '10 minutes', 180, 40.2),
    ('b1', NOW() - INTERVAL '5 minutes', 150, 39.8),
    ('b1', NOW(), 120, 40.1);

-- ==========================================
-- FUNCTIONS & TRIGGERS
-- ==========================================

-- Auto update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_patients_updated_at
    BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_iv_bags_updated_at
    BEFORE UPDATE ON iv_bags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- VIEWS
-- ==========================================

-- View để lấy bags kèm patient info (dùng trong API)
CREATE OR REPLACE VIEW v_bags_with_patients AS
SELECT
    b.*,
    p.name as patient_name,
    p.room as room,
    p.bed as bed,
    p.condition
FROM iv_bags b
JOIN patients p ON b.patient_id = p.id
ORDER BY b.start_time DESC;

-- ==========================================
-- PERMISSIONS (nếu cần)
-- ==========================================
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
