import { AUTH_CONFIG } from '../constants/auth.constant';

/**
 * Tạo ngẫu nhiên verification token (hex string 64 ký tự).
 * Dùng cho email verification và các flow tương tự.
 * Extract ra util để tránh duplicate code giữa AuthService và EmployersService.
 */
export function generateVerificationToken(): string {
  const array = new Uint8Array(AUTH_CONFIG.VERIFICATION_TOKEN_BYTES);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
