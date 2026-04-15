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
