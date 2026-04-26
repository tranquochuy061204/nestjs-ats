/** Raw buffer + metadata của file CV đã fetch từ Supabase */
export interface CvFileData {
  base64: string;
  mimeType: string;
  buffer: Buffer;
}

/** Kết quả tổng hợp sau khi apply CV vào profile */
export interface ParseAndApplyResult {
  message: string;
  summary: {
    profileFieldsUpdated: string[];
    workExperiencesAdded: number;
    educationsAdded: number;
    projectsAdded: number;
    certificatesAdded: number;
    skillsAdded: number;
  };
}
