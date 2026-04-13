-- =====================================================
-- BME1 PostgreSQL Schema - Neon (Production)
-- Chạy file này trên Neon để khởi tạo DB
-- =====================================================

-- =====================================================
-- TABLE: patients
-- =====================================================
CREATE TABLE IF NOT EXISTS patients (
    id          VARCHAR(50) PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    room        VARCHAR(50),
    bed         VARCHAR(20),
    age         INTEGER,
    condition   VARCHAR(255),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TABLE: iv_bags
-- =====================================================
CREATE TABLE IF NOT EXISTS iv_bags (
    id              VARCHAR(50) PRIMARY KEY,
    patient_id      VARCHAR(50) REFERENCES patients(id) ON DELETE SET NULL,
    esp32_id        VARCHAR(100),
    type            VARCHAR(100) NOT NULL,
    initial_volume  DECIMAL(10, 2) NOT NULL,
    current_volume  DECIMAL(10, 2) NOT NULL,
    flow_rate       DECIMAL(10, 4) DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'running',   -- running | stopped | empty | completed
    anomaly         VARCHAR(50),                      -- NULL | FAST_DRAIN
    empty_timestamp TIMESTAMP NULL,
    start_time      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bags_patient_id ON iv_bags(patient_id);
CREATE INDEX IF NOT EXISTS idx_bags_esp32_id   ON iv_bags(esp32_id);
CREATE INDEX IF NOT EXISTS idx_bags_status     ON iv_bags(status);
CREATE INDEX IF NOT EXISTS idx_bags_updated    ON iv_bags(updated_at DESC);

-- =====================================================
-- TABLE: bag_logs  (time-series cho chart)
-- =====================================================
CREATE TABLE IF NOT EXISTS bag_logs (
    id         SERIAL PRIMARY KEY,
    bag_id     VARCHAR(50) NOT NULL REFERENCES iv_bags(id) ON DELETE CASCADE,
    time       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- thời điểm ghi log (= thời điểm đo)
    volume     DECIMAL(10, 2) NOT NULL,
    flow_rate  DECIMAL(10, 4) DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_logs_bag_id ON bag_logs(bag_id);
CREATE INDEX IF NOT EXISTS idx_logs_time   ON bag_logs(time);

-- =====================================================
-- TABLE: esp32_devices
-- =====================================================
CREATE TABLE IF NOT EXISTS esp32_devices (
    id              VARCHAR(100) PRIMARY KEY,
    status          VARCHAR(20) DEFAULT 'online',     -- online | busy | offline
    current_bag_id  VARCHAR(50),                      -- bag đang theo dõi (NULL nếu rảnh)
    registered_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_devices_status ON esp32_devices(status);

-- =====================================================
-- TABLE: reported_machines  (thiết bị cần bảo trì)
-- =====================================================
CREATE TABLE IF NOT EXISTS reported_machines (
    id          SERIAL PRIMARY KEY,
    esp32_id    VARCHAR(100) NOT NULL,
    room_bed    VARCHAR(100),
    status      VARCHAR(20) DEFAULT 'pending',        -- pending | resolved
    reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_machines_esp32_id ON reported_machines(esp32_id);
CREATE INDEX IF NOT EXISTS idx_machines_status   ON reported_machines(status);
