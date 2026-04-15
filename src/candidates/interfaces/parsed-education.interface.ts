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
