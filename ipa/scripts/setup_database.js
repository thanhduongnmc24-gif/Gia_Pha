// ipa/scripts/update_security.js
const { Client } = require('pg');

// Anh nhớ thay [YOUR-PASSWORD] bằng mật khẩu hôm qua nhé
const connectionString = 'postgresql://postgres.fkrhyhuactxbmvherqhg:Nguyenthanhduong1511@aws-1-us-east-1.pooler.supabase.com:6543/postgres';

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

const updateQuery = `
  -- 1. Thêm cột user_id để biết thành viên này thuộc về tài khoản nào
  -- (Tạm thời cho null để không lỗi dữ liệu cũ, sau này nhập mới sẽ bắt buộc có)
  ALTER TABLE members ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();

  -- 2. Xóa cái luật "mở cửa xả láng" hôm qua đi
  DROP POLICY IF EXISTS "Cho phep tat ca" ON members;

  -- 3. Tạo luật mới: "Nhà nào ở nhà nấy"
  -- Chỉ được XEM/SỬA/XÓA nếu user_id trùng với ID người đang đăng nhập
  CREATE POLICY "Rieng tu tuyet doi" ON members
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

  -- 4. Bật lại RLS cho chắc chắn
  ALTER TABLE members ENABLE ROW LEVEL SECURITY;
`;

async function update() {
  try {
    console.log("⏳ Tèo đang nâng cấp hệ thống bảo mật...");
    await client.connect();
    
    await client.query(updateQuery);
    
    console.log("🔒 Xong rồi anh hai! Giờ data của ai người nấy giữ. Người lạ không xem được nữa.");
    console.log("⚠️ LƯU Ý: Vì đã bật bảo mật, giờ anh vào App sẽ KHÔNG THẤY dữ liệu gì đâu (vì chưa đăng nhập).");
    console.log("👉 Bước tiếp theo: Chúng ta cần làm màn hình Đăng Nhập/Đăng Ký.");
  } catch (err) {
    console.error("❌ Có lỗi rồi:", err);
  } finally {
    await client.end();
  }
}

update();