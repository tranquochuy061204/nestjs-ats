# FE Integration Guide: Real-time & Notifications System

Tài liệu này hướng dẫn team FE cách kết nối và xử lý dữ liệu từ hệ thống thông báo thời gian thực (Socket.io) và các API quản lý thông báo của dự án NestJS-ATS.

---

## 1. Kết nối Socket.io

Hệ thống yêu cầu xác thực JWT ngay khi kết nối.

- **URL**: `BASE_URL` của Backend (ví dụ: `http://localhost:3000`)
- **Transport**: `websocket` (Khuyến nghị)
- **Xác thực**: Gửi Token qua `auth` object hoặc Cookie.

### Mã mẫu kết nối (React/Next.js):
```javascript
import { io } from 'socket.io-client';

const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL, {
  auth: {
    token: localStorage.getItem('access_token'), // Gửi JWT token
  },
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('✅ Connected to Real-time Server as ID:', socket.id);
});

socket.on('connect_error', (err) => {
  console.error('❌ Connection failed:', err.message);
});
```

---

## 2. Quản lý Phòng (Room Subscription)

Một số dữ liệu chỉ được gửi cho những người đang xem trang cụ thể. FE cần "đăng ký" tham gia phòng khi truy cập trang và "rời phòng" khi chuyển trang.

### 2.1. Đăng ký nhận cập nhật Kanban (Trang Kanban Board)
Khi vào trang quản lý ứng viên của một tin tuyển dụng:
- **Emit**: `subscribe_job_kanban`
- **Data**: `{ jobId: number }`

```javascript
// Tham gia
socket.emit('subscribe_job_kanban', { jobId: 123 });

// Rời (khi Unmount component)
socket.emit('unsubscribe_job_kanban', { jobId: 123 });
```

### 2.2. Đăng ký nhận cập nhật chi tiết hồ sơ (Trang Detail Application)
Khi vào trang chi tiết một hồ sơ ứng viên:
- **Emit**: `subscribe_application_detail`
- **Data**: `{ applicationId: number }`

```javascript
socket.emit('subscribe_application_detail', { applicationId: 456 });
```

---

## 3. Danh sách các sự kiện lắng nghe (Event Listeners)

| Event Name | Thụ hưởng | Mô tả | Dữ liệu trả về |
| :--- | :--- | :--- | :--- |
| `notification` | Cá nhân (Personal) | Thông báo mới (lời mời, duyệt tin, v.v.) | `NotificationEntity` object |
| `kanban_update`| Employer (In Room) | Có ứng viên vừa được kéo sang cột khác | `{ applicationId, newStatus, updatedAt }` |
| `new_note` | Employer (In Room) | Có recruiter khác vừa thêm ghi chú vào hồ sơ | `ApplicationNoteEntity` object |
| `APPLICATION_STATUS` | Candidate (Personal) | Trạng thái ứng tuyển của bản thân thay đổi | `{ applicationId, status, jobTitle }` |

### Ví dụ lắng nghe thông báo:
```javascript
socket.on('notification', (notif) => {
  // Hiển thị popup thông báo (Toast)
  toast.success(notif.title); 
  // Cập nhật số lượng trên chuông thông báo (State management)
  updateUnreadCount(prev => prev + 1);
});
```

---

## 4. REST API cho Quản lý thông báo

Sử dụng Token trong Header Authorization (`Bearer <token>`).

- **Lấy danh sách thông báo (Phân trang)**:
  `GET /notifications?page=1&limit=20`
- **Lấy số lượng thông báo chưa đọc**:
  `GET /notifications/unread-count` 
  - Trả về: `{ count: number }`
- **Đánh dấu đọc tất cả**:
  `PATCH /notifications/mark-all-read`
- **Đánh dấu đọc một thông báo cụ thể**:
  `PATCH /notifications/:id/read`

---

## 5. Lưu ý quan trọng cho FE

> [!IMPORTANT]
> **Cleanup Listeners**: Luôn luôn hãy gọi `socket.off(eventName)` khi unmount component (ví dụ: trong return của `useEffect`) để tránh việc nhận trùng tin nhắn hoặc rò rỉ bộ nhớ.

> [!TIP]
> **Re-syncing**: Khi người dùng quay lại tab sau một thời gian dài (Page visibility changed) hoặc khi Socket kết nối lại, FE nên chủ động gọi lại API `unread-count` để đảm bảo dữ liệu là mới nhất.

---
*Tài liệu được cập nhật lần cuối vào: 21/04/2026*
