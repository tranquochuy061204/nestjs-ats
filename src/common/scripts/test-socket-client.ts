import { io } from 'socket.io-client';

/**
 * MÔ TẢ:
 * Script này giả lập một Client kết nối tới server Webhook để kiểm tra tính năng Real-time.
 * 
 * CÁCH CHẠY:
 * 1. Đảm bảo Backend đang chạy (npm run start:dev)
 * 2. Thay đổi biến TOKEN bên dưới bằng một JWT hợp lệ (lấy từ API login)
 * 3. Chạy lệnh: npx ts-node src/common/scripts/test-socket-client.ts
 */

const SERVER_URL = 'http://localhost:3000'; // Thường là cổng của NestJS
const TOKEN = 'YOUR_JWT_TOKEN_HERE'; // CẦN THAY THẾ BẰNG TOKEN THẬT

const socket = io(SERVER_URL, {
  auth: {
    token: TOKEN,
  },
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('✅ Đã kết nối tới Server socket.io!');
  console.log('ID Kết nối:', socket.id);

  // 1. Tham gia phòng Kanban của một Job (ví dụ jobId: 1)
  const jobId = 1;
  socket.emit('subscribe_job_kanban', { jobId });
  console.log(`📡 Đang nghe cập nhật Kanban cho Job #${jobId}...`);

  // 2. Tham gia phòng chi tiết hồ sơ (ví dụ applicationId: 1)
  const applicationId = 1;
  socket.emit('subscribe_application_detail', { applicationId });
  console.log(`📡 Đang nghe cập nhật chi tiết hồ sơ #${applicationId}...`);
});

// Lắng nghe thông báo cá nhân
socket.on('notification', (data) => {
  console.log('🔔 THÔNG BÁO MỚI:', data);
});

// Lắng nghe cập nhật Kanban
socket.on('kanban_update', (data) => {
  console.log('📊 CẬP NHẬT KANBAN:', data);
});

// Lắng nghe ghi chú mới
socket.on('new_note', (data) => {
  console.log('📝 GHI CHÚ MỚI:', data);
});

// Lắng nghe trạng thái hồ sơ thay đổi (cho ứng viên)
socket.on('APPLICATION_STATUS', (data) => {
  console.log('💼 TRẠNG THÁI ỨNG TUYỂN THAY ĐỔI:', data);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Đã ngắt kết nối:', reason);
});

socket.on('connect_error', (error) => {
  console.error('⚠️ Lỗi kết nối:', error.message);
});
