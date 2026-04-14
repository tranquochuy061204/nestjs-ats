/**
 * Type definitions for the AI CV parsing response.
 * Used by CandidateCvParserService to type-check Gemini output.
 */

export interface ParsedWorkExperience {
  /** Tên công ty (bắt buộc) */
  companyName: string;
  /** Chức danh tại công ty đó (bắt buộc) */
  position: string;
  /** Ngày bắt đầu — định dạng YYYY-MM-DD hoặc YYYY-MM-01 */
  startDate?: string | null;
  /** Ngày kết thúc — null nếu isWorkingHere = true */
  endDate?: string | null;
  /** Đang làm việc tại đây không? */
  isWorkingHere?: boolean;
  /** Mô tả công việc / thành tích (bullet points, newline-separated) */
  description?: string | null;
}

export interface ParsedEducation {
  /** Tên trường (bắt buộc) */
  schoolName: string;
  /** Chuyên ngành */
  major?: string | null;
  /** Bằng cấp: Bachelor, Master, PhD, High School... */
  degree?: string | null;
  /** Ngày bắt đầu */
  startDate?: string | null;
  /** Ngày tốt nghiệp — null nếu isStillStudying = true */
  endDate?: string | null;
  /** Đang theo học? */
  isStillStudying?: boolean;
  /** GPA, danh hiệu, hoạt động ngoại khoá */
  description?: string | null;
}

export interface ParsedProject {
  /** Tên dự án (bắt buộc) */
  name: string;
  /** Ngày bắt đầu */
  startDate?: string | null;
  /** Ngày kết thúc */
  endDate?: string | null;
  /** Vai trò, tech stack, kết quả đạt được */
  description?: string | null;
}

export interface CvFullParseResult {
  // ─── Thông tin cá nhân ───────────────────────────────────────
  fullName?: string | null;
  phone?: string | null;
  /** Vị trí hiện tại hoặc gần nhất */
  position?: string | null;
  /** 2-3 câu tóm tắt chuyên nghiệp */
  bio?: string | null;
  /** Tổng số năm kinh nghiệm (tính từ work history) */
  yearWorkingExperience?: number | null;

  // ─── Danh sách có cấu trúc ───────────────────────────────────
  workExperiences: ParsedWorkExperience[];
  educations: ParsedEducation[];
  projects: ParsedProject[];
  /** Chỉ lấy tên chứng chỉ / giải thưởng */
  certificates: string[];
  /** Flat list tất cả kỹ năng trích xuất được */
  skills: string[];
}
