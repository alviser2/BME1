import { neon } from '@neondatabase/serverless';

// Connection string từ Neon
const DATABASE_URL = 'postgresql://neondb_owner:npg_XksGgW24HhmU@ep-little-paper-a188c8ix-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const sql = neon(DATABASE_URL);

async function setup() {
  console.log('🔌 Kết nối đến Neon...');
  
  try {
    // 1. Kiểm tra bảng tồn tại không
    console.log('\n📋 Kiểm tra các bảng...');
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    console.log('Các bảng hiện có:', tables.map(t => t.table_name).join(', ') || 'trống');
    
    // 2. Tạo bảng esp32_devices nếu chưa có
    console.log('\n🛠️ Tạo bảng esp32_devices...');
    await sql`
      CREATE TABLE IF NOT EXISTS esp32_devices (
        id              VARCHAR(50) PRIMARY KEY,
        status          VARCHAR(20) DEFAULT 'offline',
        current_bag_id  VARCHAR(50),
        registered_at   TIMESTAMP DEFAULT NOW(),
        last_seen_at    TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ Bảng esp32_devices đã tạo/tồn tại');
    
    // 3. Thêm index nếu chưa có
    await sql`
      CREATE INDEX IF NOT EXISTS idx_esp32_devices_status ON esp32_devices(status)
    `.catch(() => console.log('Index đã tồn tại hoặc không cần tạo'));
    
    // 4. Insert test data
    console.log('\n📊 Insert test data...');
    
    // Insert ESP32 devices
    await sql`
      INSERT INTO esp32_devices (id, status, registered_at, last_seen_at)
      VALUES 
        ('ESP001', 'online', NOW(), NOW()),
        ('ESP002', 'online', NOW(), NOW()),
        ('ESP003', 'online', NOW(), NOW()),
        ('ESP004', 'offline', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day')
      ON CONFLICT (id) DO NOTHING
    `;
    console.log('✅ ESP32 devices đã insert');
    
    // Kiểm tra lại
    const esp32List = await sql`SELECT * FROM esp32_devices ORDER BY id`;
    console.log('\n📋 Danh sách ESP32:');
    esp32List.forEach(e => {
      console.log(`  - ${e.id}: status=${e.status}, current_bag_id=${e.current_bag_id}`);
    });
    
    // Kiểm tra patients
    const patients = await sql`SELECT COUNT(*) as cnt FROM patients`;
    console.log(`\n📋 Bệnh nhân: ${patients[0].cnt} người`);
    
    // Kiểm tra bags
    const bags = await sql`SELECT COUNT(*) as cnt FROM iv_bags`;
    console.log(`📋 Bình truyền: ${bags[0].cnt} cái`);
    
    console.log('\n🎉 Hoàn tất! Database đã sẵn sàng.');
    
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
  }
}

setup();