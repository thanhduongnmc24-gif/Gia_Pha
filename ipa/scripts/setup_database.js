// ipa/scripts/setup_database.js
const { Client } = require('pg');

// Anh hai nhớ thay chuỗi này bằng Connection String của dự án mới nhé!
const connectionString = 'postgresql://postgres.vgoymfsyzdjgvhiddxum:Nguyenthanhduong1511@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres';

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

const setupQuery = `
  -- 0. Dọn dẹp mặt bằng (Xóa bảng cũ nếu có để làm lại từ đầu)
  DROP TABLE IF EXISTS members CASCADE;

  -- 1. Xây móng: Tạo bảng members với đầy đủ các cột thiết yếu
  CREATE TABLE members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID DEFAULT auth.uid(), -- Cột quan trọng để phân biệt data của ai
      full_name TEXT NOT NULL,
      gender TEXT CHECK (gender IN ('Nam', 'Nữ')),
      birth_date TEXT,
      bio TEXT,
      father_id UUID,
      mother_id UUID,
      wife_husband_id UUID,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- 2. Nối dây tơ hồng: Thiết lập khóa ngoại để đảm bảo tính toàn vẹn của gia phả
  ALTER TABLE members
      ADD CONSTRAINT fk_father FOREIGN KEY (father_id) REFERENCES members(id) ON DELETE SET NULL,
      ADD CONSTRAINT fk_mother FOREIGN KEY (mother_id) REFERENCES members(id) ON DELETE SET NULL,
      ADD CONSTRAINT fk_spouse FOREIGN KEY (wife_husband_id) REFERENCES members(id) ON DELETE SET NULL;

  -- 3. Bật hàng rào bảo mật (Row Level Security)
  ALTER TABLE members ENABLE ROW LEVEL SECURITY;

  -- 4. Ban hành luật "Nhà nào ở nhà nấy"
  -- Luật XEM: Chỉ được xem người nhà mình
  CREATE POLICY "Chủ tài khoản được xem" ON members 
      FOR SELECT USING (auth.uid() = user_id);

  -- Luật THÊM: Chỉ được thêm người vào nhà mình
  CREATE POLICY "Chủ tài khoản được thêm" ON members 
      FOR INSERT WITH CHECK (auth.uid() = user_id);

  -- Luật SỬA: Chỉ được sửa thông tin người nhà mình
  CREATE POLICY "Chủ tài khoản được sửa" ON members 
      FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

  -- Luật XÓA: Chỉ được xóa người nhà mình
  CREATE POLICY "Chủ tài khoản được xóa" ON members 
      FOR DELETE USING (auth.uid() = user_id);
`;

async function setupDatabase() {
  try {
    console.log("⏳ Tèo đang đào móng, đổ bê tông xây bảng cơ sở dữ liệu mới...");
    await client.connect();
    
    await client.query(setupQuery);
    
    console.log("✅ Xây xong rồi anh hai ơi! Bảng 'members' đã sẵn sàng, bảo mật RLS cũng đã được kích hoạt.");
    console.log("👉 Giờ anh hai có thể quay lại app để tiếp tục gắn chức năng Đăng Nhập / Đăng Ký rồi nhé!");
  } catch (err) {
    console.error("❌ Ây da, có lỗi xây dựng rồi:", err);
  } finally {
    await client.end();
  }
}

setupDatabase();