import { ParsedWorkExperience } from './parsed-work-experience.interface';
import { ParsedEducation } from './parsed-education.interface';
import { ParsedProject } from './parsed-project.interface';

/**
 * Type definitions for the AI CV parsing response.
 * Used by CandidateCvParserService to type-check Gemini output.
 */
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
