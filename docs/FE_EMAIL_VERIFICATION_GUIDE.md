# Tích hợp Hệ thống Xác thực Email (FE Guide)

Hệ thống Xác thực Email (Email Verification) cho dự án NestJS ATS đã được triển khai hoàn tất trên Backend. Tài liệu này cung cấp hướng dẫn từng bước để team Frontend (FE) hiểu và tích hợp luồng xác thực trên giao diện.

---

## 1. Dấu hiệu nhận biết User chưa xác thực

Khi user đăng ký thành công, trạng thái mặc định của tài khoản sẽ là **chưa xác thực** (`isEmailVerified = false`). 
User **vẫn có thể đăng nhập bình thường** và nhận được Access Token (JWT). Tuy nhiên, một số chức năng cốt lõi (như nộp CV, đăng tin) sẽ bị giới hạn.

### Phản hồi từ API `/auth/login` và `/auth/status`
Khi login hoặc lấy trạng thái user, object `user` trả về sẽ chứa thêm trường `isEmailVerified`.
```json
{
  "access_token": "eyJhb...",
  "user": {
    "id": 1,
    "email": "candidate@example.com",
    "role": "candidate",
    "isEmailVerified": false
  }
}
```

> [!TIP]
> **Action cho FE:** Lưu `isEmailVerified` vào Global State/Redux. Nếu `isEmailVerified === false`, hãy liên tục hiển thị một **Banner cảnh báo** (Màu vàng/đỏ) ở đầu ứng dụng với thông điệp: *"Vui lòng xác thực địa chỉ email của bạn để sử dụng đầy đủ các tính năng. [Gửi lại email]"*

---

## 2. API "Hard Block" & Cách xử lý Lỗi (Error Handling)

Thay vì chặn hoàn toàn, Backend xây dựng theo logic **"Hard Block"** cho từng hành động nhạy cảm.

Các API đang chặn:
- Candidate: `Nộp đơn ứng tuyển`, `Upload CV`.
- Employer: `Tạo Job mới`, `Dịch vụ Headhunting`.

Khi gọi đến các API này mà user chưa xác thực email, Backend sẽ trả về HTTP Status `403 Forbidden` (Thay vì 401).

```json
{
  "message": "Vui lòng xác thực email trước khi thực hiện hành động này.",
  "error": "Forbidden",
  "statusCode": 403
}
```

> [!IMPORTANT]
> **Action cho FE:** 
> 1. Khi call API thất bại, nếu gặp lỗi `403` có nội dung liên quan đến email, **TUYỆT ĐỐI KHÔNG logout user**. 
> 2. Hãy hiển thị một Toast Message/Modal nhắc nhở: *"Chức năng này yêu cầu xác thực email. Kiểm tra hộp thư của bạn."*

---

## 3. Luồng Xác thực trên giao diện (User Flow)

### Bước 1: Gửi lại Email (Resend Verification)
Nếu User không tìm thấy email, họ bấm vào nút **[Gửi lại email]** trên Banner.
- FE gọi API (yêu cầu gửi Header `Authorization: Bearer <Token>`):
  - **Method:** `POST`
  - **URL:** `/auth/resend-verification`
- Phản hồi: `200 OK` (Email đã được gửi) hoặc `400 Bad Request` (Nếu tài khoản đã verify rồi).

### Bước 2: User Click vào Link trong Email
Email thông báo sẽ đi kèm một nút/link dẫn hướng về Website FE. Link này chứa query params là token bảo mật.
Ví dụ Backend gửi: `https://your-domain.com/verify-email?token=abcd1234efgh...`

### Bước 3: FE gọi API Xác thực (Giao diện `/verify-email`)
Khi App load component tương ứng với route `/verify-email`, FE cần đọc ra `token` trên URL.
FE sau đó thực hiện Call API:
- **Method:** `GET`
- **URL:** `/auth/verify-email?token=abcd1234efgh...`
- **Phản hồi:**
  - `200 OK`: Xác nhận thành công.
  - `400 Bad Request`: Token không đúng định dạng.
  - `404 Not Found`: Token không tồn tại hoặc đã hết hạn/sử dụng.

> [!TIP]
> **Action cho FE khi nhận 200 OK:**
> 1. Hiển thị màn hình *"Chúc mừng, Email của bạn đã được xác thực!"*.
> 2. Tự động Cập nhật Global State: `localUser.isEmailVerified = true` hoặc gọi lại `/auth/status` để fetch state mới nhất.
> 3. Cung cấp nút `[Trở về trang chủ]` hoặc tự động Redirect.

> **Action cho FE khi nhận 404:**
> 1. Trả ra thông báo Token hết hạn. 
> 2. Cung cấp nút bấm gọi lại trực tiếp API `POST /auth/resend-verification` để cấp token mới.
