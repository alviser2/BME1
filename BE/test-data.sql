-- ==========================================
-- BME1 Test Data - SQL Editor Scripts
-- Chạy trên Neon SQL Editor
-- ==========================================

-- ==============================
-- STEP 1: Xóa dữ liệu cũ (reset)
-- ==============================
DELETE FROM bag_logs;
DELETE FROM iv_bags;
DELETE FROM esp32_devices;
DELETE FROM patients;
DELETE FROM reported_machines;

-- ==============================
-- STEP 2: Insert bệnh nhân test
-- ==============================

INSERT INTO patients (id, name, room, bed, age, condition) VALUES
    ('p001', 'Nguyễn Văn A', '101', '1', 45, 'Sốt xuất huyết'),
    ('p002', 'Trần Thị B', '102', '3', 60, 'Tiêu chảy cấp'),
    ('p003', 'Lê Văn C', '205', '2', 32, 'Mất nước'),
    ('p004', 'Phạm Thị D', '301', '1', 28, 'Viêm ruột'),
    ('p005', 'Hoàng Văn E', '302', '4', 55, 'Suy dinh dưỡng');

-- ==============================
-- STEP 3: Insert ESP32 devices
-- ==============================

INSERT INTO esp32_devices (id, status, registered_at, last_seen_at) VALUES
    ('ESP001', 'online', NOW(), NOW()),
    ('ESP002', 'online', NOW(), NOW()),
    ('ESP003', 'online', NOW(), NOW()),
    ('ESP004', 'offline', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
    ('ESP005', 'busy', NOW() - INTERVAL '30 minutes', NOW(), 'b001');

-- ==============================
-- STEP 4: Insert bình truyền
-- ==============================

INSERT INTO iv_bags (id, patient_id, esp32_id, type, initial_volume, current_volume, flow_rate, start_time, status) VALUES
    ('b001', 'p001', 'ESP005', 'Nước muối sinh lý 0.9%', 500, 350, 40, NOW() - INTERVAL '1 hour', 'running'),
    ('b002', 'p002', 'ESP002', 'Glucose 5%', 1000, 900, 60, NOW() - INTERVAL '15 minutes', 'running'),
    ('b003', 'p003', NULL, 'Ringer Lactate', 500, 250, 30, NOW() - INTERVAL '2 hours', 'running'),
    ('b004', 'p004', NULL, 'Amino Acid', 500, 50, 25, NOW() - INTERVAL '3 hours', 'running'),
    ('b005', 'p005', NULL, 'Nước muối sinh lý 0.9%', 500, 0, 40, NOW() - INTERVAL '4 hours', 'completed');

-- ==============================
-- STEP 5: Insert bag logs
-- ==============================

-- Logs cho b001 (ESP005 đang theo dõi)
INSERT INTO bag_logs (bag_id, time, volume, flow_rate, created_at) VALUES
    ('b001', NOW() - INTERVAL '55 minutes', 480, 40.2, NOW() - INTERVAL '55 minutes'),
    ('b001', NOW() - INTERVAL '50 minutes', 460, 39.8, NOW() - INTERVAL '50 minutes'),
    ('b001', NOW() - INTERVAL '45 minutes', 440, 40.5, NOW() - INTERVAL '45 minutes'),
    ('b001', NOW() - INTERVAL '40 minutes', 420, 39.5, NOW() - INTERVAL '40 minutes'),
    ('b001', NOW() - INTERVAL '35 minutes', 400, 40.1, NOW() - INTERVAL '35 minutes'),
    ('b001', NOW() - INTERVAL '30 minutes', 380, 39.9, NOW() - INTERVAL '30 minutes'),
    ('b001', NOW() - INTERVAL '25 minutes', 360, 40.3, NOW() - INTERVAL '25 minutes'),
    ('b001', NOW() - INTERVAL '20 minutes', 350, 40.0, NOW() - INTERVAL '20 minutes');

-- Logs cho b002
INSERT INTO bag_logs (bag_id, time, volume, flow_rate, created_at) VALUES
    ('b002', NOW() - INTERVAL '10 minutes', 980, 60.2, NOW() - INTERVAL '10 minutes'),
    ('b002', NOW() - INTERVAL '5 minutes', 960, 59.8, NOW() - INTERVAL '5 minutes'),
    ('b002', NOW(), 940, 60.0, NOW());

-- ==============================
-- STEP 6: Insert reported machines
-- ==============================

INSERT INTO reported_machines (esp32_id, room_bed, reported_at, status) VALUES
    ('ESP003', 'P203 G1', NOW() - INTERVAL '10 minutes', 'pending');

-- ==============================
-- STEP 7: Query để verify
-- ==============================

-- Xem tất cả ESP32
SELECT '=== ESP32 Devices ===' as info;
SELECT * FROM esp32_devices;

-- Xem ESP32 rảnh
SELECT '=== ESP32 Available ===' as info;
SELECT * FROM esp32_devices WHERE status = 'online';

-- Xem tất cả bags với patient
SELECT '=== Bags with Patients ===' as info;
SELECT 
    b.id, b.type, b.current_volume, b.flow_rate, b.status,
    p.name as patient_name, p.room, p.bed,
    e.id as esp32_id, e.status as esp32_status
FROM iv_bags b
LEFT JOIN patients p ON b.patient_id = p.id
LEFT JOIN esp32_devices e ON b.esp32_id = e.id
ORDER BY b.status, b.start_time DESC;

-- Xem bệnh nhân
SELECT '=== Patients ===' as info;
SELECT * FROM patients;

-- ==============================
-- HÀNH ĐỘNG TEST
-- ==============================

-- TEST 1: Gán ESP001 vào b003 (b003 chưa có ESP32)
UPDATE iv_bags SET esp32_id = 'ESP001' WHERE id = 'b003';
UPDATE esp32_devices SET status = 'busy', current_bag_id = 'b003' WHERE id = 'ESP001';

-- TEST 2: Hoàn thành b005 (ESP005 sẽ trở về online)
UPDATE iv_bags SET status = 'completed' WHERE id = 'b005';
UPDATE esp32_devices SET status = 'online', current_bag_id = NULL WHERE id = 'ESP005';

-- Xem kết quả sau test
SELECT '=== Sau khi test ===' as info;
SELECT * FROM esp32_devices;
SELECT * FROM iv_bags;