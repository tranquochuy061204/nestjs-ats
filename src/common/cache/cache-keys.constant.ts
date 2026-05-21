/**
 * Cache key constants — tập trung tất cả key patterns vào đây
 * để tránh typo và dễ maintain.
 */
export const CACHE_KEYS = {
  /** Subscription đang active của một công ty */
  SUB_ACTIVE: (companyId: number) => `sub:active:${companyId}`,

  /** Profile của employer (bao gồm company relation) */
  EMPLOYER_PROFILE: (userId: number) => `employer:profile:${userId}`,

  /** Toàn bộ hồ sơ ứng viên */
  CANDIDATE_PROFILE: (userId: number) => `candidate:profile:${userId}`,

  /** Danh sách job của employer với filter hash */
  EMPLOYER_JOBS: (companyId: number, hash: string) =>
    `employer:jobs:${companyId}:${hash}`,

  /** Pattern để xóa tất cả filter variants của employer jobs */
  EMPLOYER_JOBS_PATTERN: (companyId: number) =>
    `employer:jobs:${companyId}:*`,

  /** Danh sách credit packages (gần tĩnh) */
  CREDIT_PACKAGES: 'credit:packages',

  /** Metadata (tĩnh, rất hiếm khi thay đổi) */
  METADATA_PROVINCES: 'metadata:provinces',
  METADATA_JOB_CATEGORIES: 'metadata:job_categories',
  METADATA_JOB_TYPES: 'metadata:job_types',

  /** Danh sách Admin Companies với filter hash */
  ADMIN_COMPANIES: (hash: string) => `admin:companies:${hash}`,
  /** Admin company stats (tĩnh hoặc đếm count) */
  ADMIN_COMPANIES_STATS: 'admin:companies:stats',

  /** Admin overview stats với filter hash */
  ADMIN_OVERVIEW: (hash: string) => `admin:overview:${hash}`,

  /** Admin revenue chart */
  ADMIN_REVENUE_CHART: (hash: string) => `admin:revenue:${hash}`,

  /** Admin user growth chart */
  ADMIN_USER_GROWTH: (hash: string) => `admin:usergrowth:${hash}`,
} as const;

/** TTL constants (giây) */
export const CACHE_TTL = {
  SUBSCRIPTION: 300,
  EMPLOYER_PROFILE: 600,
  CANDIDATE_PROFILE: 300,
  EMPLOYER_JOBS: 120,
  CREDIT_PACKAGES: 1800,
  ADMIN_COMPANIES: 300,
  ADMIN_STATS: 600,
  METADATA: 86400, // 24 hours
} as const;
