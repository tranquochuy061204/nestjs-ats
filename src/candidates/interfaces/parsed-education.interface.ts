import { Degree } from '../../common/enums/degree.enum';

export interface ParsedEducation {
  /** Tên trường (bắt buộc) */
  schoolName: string;
  /** Chuyên ngành */
  major?: string | null;
  /** Bằng cấp chuẩn hoá theo Enum Degree */
  degree?: Degree | null;
  /** Ngày bắt đầu */
  startDate?: string | null;
  /** Ngày tốt nghiệp — null nếu isStillStudying = true */
  endDate?: string | null;
  /** Đang theo học? */
  isStillStudying?: boolean;
  /** GPA, danh hiệu, hoạt động ngoại khoá */
  description?: string | null;
}
