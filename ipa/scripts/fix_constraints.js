// ipa/scripts/fix_constraints.js
const { Client } = require('pg');

// Anh hai nhớ thay [YOUR-PASSWORD] bằng mật khẩu database của anh nhé
const connectionString = 'postgresql://postgres.fkrhyhuactxbmvherqhg:Nguyenthanhduong1511@aws-1-us-east-1.pooler.supabase.com:6543/postgres';

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

const fixQuery = `
  -- 1. Gỡ bỏ các luật cũ (đang chặn anh hai xóa)
  ALTER TABLE members DROP CONSTRAINT IF EXISTS members_father_id_fkey;
  ALTER TABLE members DROP CONSTRAINT IF EXISTS members_mother_id_fkey;
  ALTER TABLE members DROP CONSTRAINT IF EXISTS members_wife_husband_id_fkey;

  -- 2. Thiết lập luật mới: Nếu xóa người bị trỏ tới, hãy đặt ô đó thành NULL (trống)
  -- Luật cho Cha
  ALTER TABLE members ADD CONSTRAINT members_father_id_fkey 
    FOREIGN KEY (father_id) REFERENCES members(id) ON DELETE SET NULL;

  -- Luật cho Mẹ
  ALTER TABLE members ADD CONSTRAINT members_mother_id_fkey 
    FOREIGN KEY (mother_id) REFERENCES members(id) ON DELETE SET NULL;

  -- Luật cho Vợ/Chồng
  ALTER TABLE members ADD CONSTRAINT members_wife_husband_id_fkey 
    FOREIGN KEY (wife_husband_id) REFERENCES members(id) ON DELETE SET NULL;
`;

async function fix() {
  try {
    console.log("⏳ Tèo đang đi 'nói chuyện' lại với Database...");
    await client.connect();
    
    await client.query(fixQuery);
    
    console.log("✅ Xong rồi anh hai ơi! Database đã 'dễ tính' hơn rồi đó.");
    console.log("👉 Giờ anh có thể vào App để Xóa hoặc Gỡ quan hệ thoải mái mà không sợ bị chặn nữa.");
  } catch (err) {
    console.error("❌ Có lỗi rồi anh hai:", err);
  } finally {
    await client.end();
  }
}

fix();