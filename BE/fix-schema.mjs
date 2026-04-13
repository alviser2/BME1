import { neon } from '@neondatabase/serverless';

const DATABASE_URL = 'postgresql://neondb_owner:npg_XksGgW24HhmU@ep-little-paper-a188c8ix-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(DATABASE_URL);

async function fixSchema() {
  console.log('🔌 Kiểm tra và fix schema...\n');
  
  try {
    // 1. Kiểm tra schema bag_logs
    console.log('📋 Schema bag_logs:');
    const columns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'bag_logs'
      ORDER BY ordinal_position
    `;
    columns.forEach(c => {
      console.log(`  ${c.column_name}: ${c.data_type} ${c.is_nullable === 'YES' ? '(nullable)' : '(NOT NULL)'} default=${c.column_default}`);
    });

    // 2. Fix: Thêm default cho cột time
    console.log('\n🛠️ Fix cột time trong bag_logs...');
    await sql`ALTER TABLE bag_logs ALTER COLUMN time SET DEFAULT NOW()`;
    console.log('✅ Đã set default cho time');

    // 3. Test insert
    console.log('\n🧪 Test insert...');
    const testId = `b_fix_${Date.now()}`;
    
    // Insert bag
    await sql`
      INSERT INTO iv_bags (id, patient_id, type, initial_volume, current_volume, flow_rate, start_time, status)
      VALUES (${testId}, 'p001', 'Test drip', 500, 500, 40, NOW(), 'running')
    `;
    console.log('✅ Insert bag thành công');

    // Insert log
    await sql`
      INSERT INTO bag_logs (bag_id, volume, flow_rate, time)
      VALUES (${testId}, 500, 40, NOW())
    `;
    console.log('✅ Insert log thành công');

    console.log('\n🎉 Schema đã được fix!');
    
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
  }
}

fixSchema();