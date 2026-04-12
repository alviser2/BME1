-- =====================================================
-- BME1 PostgreSQL Schema - Neon Database
-- Healthcare IV Bag Monitoring System
-- =====================================================

-- =====================================================
-- TABLE: patients
-- =====================================================
CREATE TABLE IF NOT EXISTS patients (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    room VARCHAR(50),
    bed VARCHAR(20),
    age INTEGER,
    condition VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TABLE: iv_bags
-- =====================================================
CREATE TABLE IF NOT EXISTS iv_bags (
    id VARCHAR(50) PRIMARY KEY,
    patient_id VARCHAR(50) REFERENCES patients(id) ON DELETE SET NULL,
    esp32_id VARCHAR(100),
    type VARCHAR(50) NOT NULL,
    initial_volume DECIMAL(10, 2) NOT NULL,
    current_volume DECIMAL(10, 2) NOT NULL,
    flow_rate DECIMAL(10, 4) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'running',
    empty_timestamp TIMESTAMP NULL,
    anomaly VARCHAR(50),
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bags_patient_id ON iv_bags(patient_id);
CREATE INDEX idx_bags_esp32_id ON iv_bags(esp32_id);
CREATE INDEX idx_bags_status ON iv_bags(status);

-- =====================================================
-- TABLE: bag_logs
-- =====================================================
CREATE TABLE IF NOT EXISTS bag_logs (
    id SERIAL PRIMARY KEY,
    bag_id VARCHAR(50) NOT NULL REFERENCES iv_bags(id) ON DELETE CASCADE,
    time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    volume DECIMAL(10, 2) NOT NULL,
    flow_rate DECIMAL(10, 4) DEFAULT 0
);

CREATE INDEX idx_logs_bag_id ON bag_logs(bag_id);
CREATE INDEX idx_logs_time ON bag_logs(time);

-- =====================================================
-- TABLE: reported_machines
-- =====================================================
CREATE TABLE IF NOT EXISTS reported_machines (
    id SERIAL PRIMARY KEY,
    esp32_id VARCHAR(100) NOT NULL,
    room_bed VARCHAR(100),
    reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    status VARCHAR(20) DEFAULT 'pending'
);

CREATE INDEX idx_machines_esp32_id ON reported_machines(esp32_id);
CREATE INDEX idx_machines_status ON reported_machines(status);

-- =====================================================
-- TABLE: esp32_devices
-- =====================================================
CREATE TABLE IF NOT EXISTS esp32_devices (
    id VARCHAR(100) PRIMARY KEY,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'online'
);

CREATE INDEX idx_devices_status ON esp32_devices(status);

-- =====================================================
-- Sample data (optional)
-- =====================================================
-- INSERT INTO patients (id, name, room, bed, age, condition) VALUES
-- ('p1', 'Nguyễn Văn A', '101', 'A1', 65, 'Hậu phẫu'),
-- ('p2', 'Trần Thị B', '102', 'B2', 45, 'Truyền kháng sinh'),
-- ('p3', 'Lê Văn C', '103', 'C1', 72, 'Hóa trị');

-- INSERT INTO iv_bags (id, patient_id, esp32_id, type, initial_volume, current_volume, flow_rate, status) VALUES
-- ('b1', 'p1', 'ESP32_001', 'Nước muối', 500, 350, 5.5, 'running'),
-- ('b2', 'p2', 'ESP32_002', 'Glucose 5%', 1000, 800, 10.0, 'running'),
-- ('b3', 'p3', 'ESP32_003', 'Tranexamic', 250, 50, 2.0, 'running');