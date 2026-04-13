import { neon } from '@neondatabase/serverless';

const DATABASE_URL = 'postgresql://neondb_owner:npg_XksGgW24HhmU@ep-little-paper-a188c8ix-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(DATABASE_URL);

async function fixAndTest() {
  console.log('🔌 Kiểm tra schema và test...\n');
  
  // 1. Kiểm tra cấu trúc bảng iv_bags
  console.log('📋 Schema iv_bags:');
  const columns = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'iv_bags'
    ORDER BY ordinal_position
  `;
  columns.forEach(c => {
    console.log(`  ${c.column_name}: ${c.data_type} ${c.is_nullable === 'YES' ? '(nullable)' : '(NOT NULL)'} default=${c.column_default}`);
  });

  // 2. Kiểm tra triggers
  console.log('\n🔧 Triggers:');
  const triggers = await sql`
    SELECT trigger_name, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'iv_bags'
  `;
  if (triggers.length === 0) {
    console.log('  Không có trigger nào');
  } else {
    triggers.forEach(t => console.log(`  ${t.trigger_name}: ${t.event_manipulation}`));
  }

  // 3. Test insert trực tiếp
  console.log('\n🧪 Test insert trực tiếp:');
  try {
    const testId = `b_test_${Date.now()}`;
    const result = await sql`
      INSERT INTO iv_bags (id, patient_id, type, initial_volume, current_volume, flow_rate, start_time, status)
      VALUES (${testId}, 'p001', 'Test drip', 500, 500, 40, NOW(), 'running')
      RETURNING *
    `;
    console.log('✅ Insert thành công:', result[0].id);
  } catch (error) {
    console.log('❌ Lỗi insert:', error.message);
  }
}

fixAndTest();