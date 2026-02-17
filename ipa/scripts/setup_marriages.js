// ipa/scripts/setup_marriages.js
const { Client } = require('pg');

// Anh hai nhớ thay [YOUR-PASSWORD] bằng mật khẩu database nhé
const connectionString = 'postgresql://postgres.fkrhyhuactxbmvherqhg:Nguyenthanhduong1511@aws-1-us-east-1.pooler.supabase.com:6543/postgres';

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

const query = `
  -- 1. Tạo bảng Hôn Nhân
  CREATE TABLE IF NOT EXISTS marriages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    husband_id UUID REFERENCES members(id) ON DELETE CASCADE,
    wife_id UUID REFERENCES members(id) ON DELETE CASCADE,
    is_current BOOLEAN DEFAULT TRUE, -- Đang là vợ chồng hay đã ly hôn
    marriage_date DATE,
    divorce_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
  );

  -- 2. Chuyển dữ liệu cũ sang bảng mới (Migration)
  -- Tìm tất cả cặp đôi đang kết nối bằng wife_husband_id và đưa vào bảng marriages
  INSERT INTO marriages (husband_id, wife_id, is_current)
  SELECT m.id, m.wife_husband_id, TRUE
  FROM members m
  WHERE m.gender = 'Nam' AND m.wife_husband_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  -- 3. Sau khi chuyển xong, ta không cần cột wife_husband_id ở bảng members nữa
  -- Nhưng tạm thời cứ để đó, ta chỉ cần không dùng đến nó trong code mới thôi.
  
  -- 4. Bật bảo mật
  ALTER TABLE marriages ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Public Access" ON marriages FOR ALL USING (true) WITH CHECK (true);
`;

async function run() {
  try {
    await client.connect();
    console.log("💍 Đang xây dựng Sổ Đăng Ký Kết Hôn...");
    await client.query(query);
    console.log("✅ Xong! Giờ anh có thể cưới nhiều lần, ly hôn không mất dấu vết.");
  } catch (e) { console.error(e); } 
  finally { await client.end(); }
}
run();