export interface FileData {
  /** Base64-encoded file content */
  base64: string;
  mimeType: string;
  /** Raw buffer — dùng cho pdf-parse khi Gemini fallback */
  buffer?: Buffer;
}
