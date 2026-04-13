import { neon } from '@neondatabase/serverless';

const DATABASE_URL = 'postgresql://neondb_owner:npg_XksGgW24HhmU@ep-little-paper-a188c8ix-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(DATABASE_URL);

async function test() {
  console.log('🔌 Kết nối đến Neon...\n');

  try {
    // 1. Insert bệnh nhân
    console.log('📋 Insert bệnh nhân...');
    await sql`
      INSERT INTO patients (id, name, room, bed, age, condition)
      VALUES 
        ('p001', 'Nguyễn Văn A', '101', '1', 45, 'Sốt xuất huyết'),
        ('p002', 'Trần Thị B', '102', '3', 60, 'Tiêu chảy cấp'),
        ('p003', 'Lê Văn C', '205', '2', 32, 'Mất nước')
      ON CONFLICT (id) DO NOTHING
    `;
    console.log('✅ Đã insert bệnh nhân');

    // 2. Insert bình truyền
    console.log('\n📋 Insert bình truyền...');
    await sql`
      INSERT INTO iv_bags (id, patient_id, esp32_id, type, initial_volume, current_volume, flow_rate, start_time, status)
      VALUES 
        ('b001', 'p001', 'ESP001', 'Nước muối sinh lý 0.9%', 500, 350, 40, NOW() - INTERVAL '1 hour', 'running'),
        ('b002', 'p002', NULL, 'Glucose 5%', 1000, 900, 60, NOW() - INTERVAL '15 minutes', 'running')
      ON CONFLICT (id) DO NOTHING
    `;
    console.log('✅ Đã insert bình truyền');

    // 3. Update ESP001 thành busy
    await sql`
      UPDATE esp32_devices 
      SET status = 'busy', current_bag_id = 'b001'
      WHERE id = 'ESP001'
    `;
    console.log('✅ ESP001 đã được gán vào b001 (busy)');

    // 4. Verify
    console.log('\n========== KẾT QUẢ ==========');
    
    const patients = await sql`SELECT * FROM patients ORDER BY id`;
    console.log('\n👥 Bệnh nhân:');
    patients.forEach(p => console.log(`  ${p.id}: ${p.name} - P${p.room} G${p.bed}`));

    const bags = await sql`
      SELECT b.*, p.name as patient_name 
      FROM iv_bags b 
      LEFT JOIN patients p ON b.patient_id = p.id 
      ORDER BY b.id
    `;
    console.log('\n💉 Bình truyền:');
    bags.forEach(b => console.log(`  ${b.id}: ${b.type} | BN: ${b.patient_name} | ESP: ${b.esp32_id} | Vol: ${b.current_volume}ml | Status: ${b.status}`));

    const esp32 = await sql`SELECT * FROM esp32_devices ORDER BY id`;
    console.log('\n📡 ESP32 Devices:');
    esp32.forEach(e => console.log(`  ${e.id}: status=${e.status}, current_bag_id=${e.current_bag_id}`));

    console.log('\n✅ Tất cả test data đã sẵn sàng!');
    console.log('\nBây giờ bạn có thể test:');
    console.log('  1. FE: http://bme-1.vercel.app - Thêm bình truyền và chọn ESP32');
    console.log('  2. ESP32: Gọi POST /api/esp32/update với esp32_id=ESP001');

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    console.error(error.stack);
  }
}

test();