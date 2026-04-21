import { DataSource } from 'typeorm';
import { UserEntity } from './src/users/entities/user.entity';
import config from './typeorm.config';

const API_URL = 'http://localhost:3000/api';
const testEmail = `test.candidate.${Date.now()}@example.com`;
const testPassword = 'Password123!';

async function runTest() {
  console.log('=============================================');
  console.log('🧪 BẮT ĐẦU TEST LUỒNG XÁC THỰC EMAIL');
  console.log('=============================================\n');

  // --- BƯỚC 1: ĐĂNG KÝ MỚI ---
  console.log('👉 Kịch bản 1: Đăng ký ứng viên mới...');
  const registerRes = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      firstName: 'Test',
      lastName: 'Candidate',
      phone: '0901234567',
      provinceId: 1,
    }),
  });
  if (!registerRes.ok) {
    const errorText = await registerRes.text();
    console.error('❌ Đăng ký thất bại:', errorText);
    throw new Error('Kịch bản 1 thất bại');
  }
  console.log('✅ Đăng ký thành công!');

  // --- BƯỚC 2: ĐĂNG NHẬP (Chưa xác thực) ---
  console.log('\n👉 Kịch bản 2: Đăng nhập với tài khoản chưa xác thực...');
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  if (!loginRes.ok) {
    const errorText = await loginRes.text();
    console.error('❌ Đăng nhập thất bại:', errorText);
    throw new Error('Kịch bản 2 thất bại');
  }
  const loginData = await loginRes.json();
  const token = loginData.access_token;
  
  // Hỗ trợ cả snake_case và camelCase
  const isVerified = loginData.user.isEmailVerified ?? loginData.user.is_email_verified;
  
  console.log('✅ Đăng nhập thành công, nhận được Access Token (User ID:', loginData.user.id, ')');
  console.log('ℹ Trạng thái xác thực từ server:', isVerified === true ? 'ĐÃ XÁC THỰC' : 'CHƯA XÁC THỰC');

  // --- BƯỚC 3: TRUY CẬP TÀI NGUYÊN BỊ CHẶN ---
  console.log('\n👉 Kịch bản 3: Thử nộp đơn ứng tuyển với tài khoản chưa xác thực email...');
  const applyRes = await fetch(`${API_URL}/applications/1`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ coverLetter: 'Test' }),
  });
  const applyData = await applyRes.json();
  
  if (applyRes.status === 403 && (JSON.stringify(applyData).toLowerCase().includes('xác thực') || JSON.stringify(applyData).toLowerCase().includes('email'))) {
    console.log('✅ Mong đợi: Server ĐÃ CHẶN vì chưa xác thực email.');
    console.log('   Thông báo:', applyData.message);
  } else {
    console.error('❌ Lỗi logic: Mong đợi bị chặn (403), nhưng nhận được:', applyRes.status, applyData);
    throw new Error('Kịch bản 3 thất bại');
  }

  // --- BƯỚC 4: GỬI LẠI EMAIL ---
  console.log('\n👉 Kịch bản 4: Gọi API gửi lại Email xác thực...');
  const resendRes = await fetch(`${API_URL}/auth/resend-verification`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const resendData = await resendRes.json();
  if (!resendRes.ok) {
    console.error('❌ Gửi lại mail lỗi:', resendData);
    throw new Error('Gửi lại email thất bại');
  }
  console.log('✅ Bấm gửi lại Email thành công:', resendData.message);

  // --- BƯỚC 5: LẤY TOKEN & XÁC THỰC EMAIL ---
  console.log('\n👉 Kịch bản 5: Trích xuất token xác thực từ Database và tiến hành xác thực...');
  const ds = new DataSource(config);
  await ds.initialize();
  const userRepo = ds.getRepository(UserEntity);
  const userInDb = await userRepo.findOne({ where: { email: testEmail } });
  if (!userInDb || !userInDb.emailVerificationToken) {
    await ds.destroy();
    throw new Error('Không tìm thấy token trong DB');
  }
  
  const vToken = userInDb.emailVerificationToken;
  console.log('   Đã lấy được verification token:', vToken.substring(0, 10) + '...');

  const verifyRes = await fetch(`${API_URL}/auth/verify-email?token=${vToken}`);
  const verifyData = await verifyRes.json();
  if (!verifyRes.ok) {
    await ds.destroy();
    throw new Error('Xác thực thất bại: ' + JSON.stringify(verifyData));
  }
  console.log('✅ Xác thực email thành công:', verifyData.message);

  // --- BƯỚC 6: TRUY CẬP LẠI TÀI NGUYÊN ĐÁNG LẼ BỊ CHẶN ---
  console.log('\n👉 Kịch bản 6: Thử nộp đơn lại SAU KHI ĐÃ XÁC THỰC...');
  const applyRes2 = await fetch(`${API_URL}/applications/1`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ coverLetter: 'Test' }),
  });
  const applyData2 = await applyRes2.json();
  
  if (applyRes2.status === 403 && (JSON.stringify(applyData2).toLowerCase().includes('xác thực') || JSON.stringify(applyData2).toLowerCase().includes('email'))) {
    console.error('❌ Lỗi logic: Vẫn bị chặn xác thực email dù đã verify.');
    await ds.destroy();
    throw new Error('Kịch bản 6 thất bại');
  } else {
    console.log('✅ Mong đợi: Server KHÔNG CÒN CHẶN bằng lỗi Email Verification nữa.');
    console.log('   Kết quả API tiếp theo (Business logic):', applyRes2.status, applyData2.message || applyData2);
  }

  await ds.destroy();
  console.log('\n🎉 TEST LUỒNG EMAIL VERIFICATION HOÀN TẤT THÀNH CÔNG! 🎉');
}

runTest().catch((err) => {
  console.error('\n💥 TEST THẤT BẠI:', err.message);
  process.exit(1);
});
