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
