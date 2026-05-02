import { CandidateEntity } from '../entities/candidate.entity';

/**
 * Fields nhạy cảm ẩn trực tiếp trên CandidateEntity.
 * NOTE: email KHÔNG có cột trực tiếp trên candidate — nó nằm ở UserEntity.
 *       Xem USER_SENSITIVE_FIELDS bên dưới để mask nested user object.
 */
export const HIDDEN_FIELDS: Array<keyof CandidateEntity> = [
  'phone',
  'cvUrl',
  'linkedinUrl',
  'githubUrl',
  'portfolioUrl',
];

/**
 * Fields nhạy cảm cần strip khỏi nested UserEntity nếu relation `user` được load.
 * Đây là lớp bảo vệ thứ hai — buildBaseQuery() cố tình KHÔNG join user.
 * Nếu sau này có ai thêm join user, sanitizer này sẽ tự động ngăn data leak.
 */
export const USER_SENSITIVE_FIELDS = [
  'email',
  'password',
  'refreshToken',
  'role',
] as const;
