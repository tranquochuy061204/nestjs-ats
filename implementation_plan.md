# API Hồ sơ Ứng viên (Candidate Profile)

Tất cả API dưới đây đều yêu cầu **JWT Authentication** với role = `candidate`.  
Prefix: `/api/candidate`

---

## 1. GET `/api/candidate/profile` — Lấy toàn bộ hồ sơ

**Request**: Không có body (token JWT trong header)

**Response 200 OK:**
```json
{
  "id": 1,
  "full_name": "Nguyễn Văn A",
  "gender": "male",
  "phone": "0901234567",
  "avatar_url": "https://...",
  "cv_url": "https://...",
  "bio": "Mô tả ngắn về bản thân",
  "province_id": 1,
  "position": "Backend Developer",
  "salary_min": 15.00,
  "salary_max": 25.00,
  "job_type_id": 1,
  "year_working_experience": 3,
  "skills": [
    { "id": 1, "tag_name": "NestJS" },
    { "id": 2, "tag_name": "PostgreSQL" }
  ],
  "job_categories": [
    { "id": 1, "category_id": 1 }
  ],
  "work_experiences": [
    {
      "id": 1,
      "company_name": "FPT Software",
      "position": "Backend Dev",
      "start_date": "2022-01-01",
      "end_date": null,
      "is_working_here": true,
      "description": "Phát triển API..."
    }
  ],
  "educations": [
    {
      "id": 1,
      "school_name": "Đại học Bách Khoa",
      "major": "Khoa học Máy tính",
      "degree": "Cử nhân",
      "start_date": "2018-09-01",
      "end_date": "2022-06-01",
      "is_still_studying": false,
      "description": "GPA 3.5/4.0"
    }
  ],
  "certificates": [
    { "id": 1, "name": "AWS SAA", "cer_img_url": "https://..." }
  ],
  "projects": [
    {
      "id": 1,
      "name": "Hệ thống ATS",
      "start_date": "2024-01-01",
      "end_date": "2024-06-01",
      "description": "Xây dựng hệ thống tuyển dụng..."
    }
  ]
}
```

---

## 2. PUT `/api/candidate/profile` — Cập nhật thông tin cơ bản

**Request Body:**
```json
{
  "full_name": "Nguyễn Văn A",          // optional, varchar(255)
  "gender": "male",                      // optional, "male" | "female" | "other"
  "phone": "0901234567",                 // optional, varchar(20)
  "avatar_url": "https://...",           // optional, varchar(255)
  "cv_url": "https://...",               // optional, varchar(255)
  "bio": "Mô tả bản thân",              // optional, text
  "province_id": 1,                      // optional, int
  "position": "Backend Developer",       // optional, varchar(255)
  "salary_min": 15.00,                   // optional, decimal
  "salary_max": 25.00,                   // optional, decimal
  "job_type_id": 1,                      // optional, int
  "year_working_experience": 3           // optional, int
}
```

**Response 200 OK:** Trả về object candidate đã cập nhật (cùng format phần thông tin cơ bản ở GET profile, không bao gồm relations).

---

## 3. Work Experience (Kinh nghiệm làm việc)

### POST `/api/candidate/work-experiences` — Thêm mới

**Request Body:**
```json
{
  "company_name": "FPT Software",       // required, varchar(255)
  "position": "Backend Developer",       // required, varchar(255)
  "start_date": "2022-01-01",           // optional, date (YYYY-MM-DD)
  "end_date": "2024-01-01",             // optional, date
  "is_working_here": false,             // optional, boolean
  "description": "Chi tiết công việc"   // optional, text
}
```

**Response 201 Created:**
```json
{
  "id": 1,
  "candidate_id": 1,
  "company_name": "FPT Software",
  "position": "Backend Developer",
  "start_date": "2022-01-01",
  "end_date": "2024-01-01",
  "is_working_here": false,
  "description": "Chi tiết công việc"
}
```

### PUT `/api/candidate/work-experiences/:id` — Cập nhật

**Request Body:** Giống POST, tất cả fields đều optional.

**Response 200 OK:** Object đã cập nhật.

### DELETE `/api/candidate/work-experiences/:id` — Xóa

**Response 200 OK:**
```json
{ "message": "Xóa kinh nghiệm làm việc thành công" }
```

---

## 4. Education (Học vấn)

### POST `/api/candidate/educations` — Thêm mới

**Request Body:**
```json
{
  "school_name": "ĐH Bách Khoa",        // required, varchar(255)
  "major": "Khoa học Máy tính",          // optional, varchar(255)
  "degree": "Cử nhân",                   // optional, varchar(100)
  "start_date": "2018-09-01",            // optional, date
  "end_date": "2022-06-01",              // optional, date
  "is_still_studying": false,            // optional, boolean
  "description": "Thông tin thêm"        // optional, text
}
```

**Response 201 Created:** Object education đã tạo (có [id](file:///d:/Workspace/Projects/NestJs-ATS/src/users/entities/candidate.entity.ts#10-60), `candidate_id`).

### PUT `/api/candidate/educations/:id` — Cập nhật

**Request Body:** Giống POST, tất cả fields đều optional.

**Response 200 OK:** Object đã cập nhật.

### DELETE `/api/candidate/educations/:id` — Xóa

**Response 200 OK:**
```json
{ "message": "Xóa học vấn thành công" }
```

---

## 5. Certificate (Chứng chỉ)

### POST `/api/candidate/certificates` — Thêm mới

**Request Body:**
```json
{
  "name": "AWS Solutions Architect",     // required, varchar(255)
  "cer_img_url": "https://..."           // optional, varchar(255)
}
```

**Response 201 Created:** Object certificate đã tạo.

### PUT `/api/candidate/certificates/:id` — Cập nhật

**Request Body:** Giống POST, tất cả optional.

**Response 200 OK:** Object đã cập nhật.

### DELETE `/api/candidate/certificates/:id` — Xóa

**Response 200 OK:**
```json
{ "message": "Xóa chứng chỉ thành công" }
```

---

## 6. Project (Dự án)

### POST `/api/candidate/projects` — Thêm mới

**Request Body:**
```json
{
  "name": "Hệ thống ATS",               // required, varchar(255)
  "start_date": "2024-01-01",            // optional, date
  "end_date": "2024-06-01",              // optional, date
  "description": "Vai trò và kết quả"   // optional, text
}
```

**Response 201 Created:** Object project đã tạo.

### PUT `/api/candidate/projects/:id` — Cập nhật

**Request Body:** Giống POST, tất cả optional.

**Response 200 OK:** Object đã cập nhật.

### DELETE `/api/candidate/projects/:id` — Xóa

**Response 200 OK:**
```json
{ "message": "Xóa dự án thành công" }
```

---

## 7. PUT `/api/candidate/skills` — Cập nhật danh sách kỹ năng

Thay thế toàn bộ danh sách kỹ năng (xóa cũ, thêm mới).

**Request Body:**
```json
{
  "skills": ["NestJS", "PostgreSQL", "Docker", "TypeScript"]
}
```

**Response 200 OK:**
```json
[
  { "id": 10, "candidate_id": 1, "tag_name": "NestJS" },
  { "id": 11, "candidate_id": 1, "tag_name": "PostgreSQL" },
  { "id": 12, "candidate_id": 1, "tag_name": "Docker" },
  { "id": 13, "candidate_id": 1, "tag_name": "TypeScript" }
]
```

---

## 8. PUT `/api/candidate/job-categories` — Cập nhật ngành nghề quan tâm

Thay thế toàn bộ danh sách ngành nghề quan tâm (tối đa 3).

**Request Body:**
```json
{
  "category_ids": [1, 3, 5]
}
```

**Response 200 OK:**
```json
[
  { "id": 20, "candidate_id": 1, "category_id": 1 },
  { "id": 21, "candidate_id": 1, "category_id": 3 },
  { "id": 22, "candidate_id": 1, "category_id": 5 }
]
```

---

## Error Responses (chung)

| Status | Mô tả |
|--------|-------|
| 401 Unauthorized | Chưa đăng nhập hoặc token hết hạn |
| 403 Forbidden | Không phải role candidate |
| 404 Not Found | Không tìm thấy resource (sai id, hoặc resource không thuộc về user) |
| 400 Bad Request | Validation lỗi (thiếu required field, sai format...) |

**Ví dụ error response:**
```json
{
  "statusCode": 400,
  "message": ["company_name is required"],
  "error": "Bad Request"
}
```
