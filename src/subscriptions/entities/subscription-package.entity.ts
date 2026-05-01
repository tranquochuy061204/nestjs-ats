import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CompanySubscriptionEntity } from './company-subscription.entity';

@Entity('subscription_package')
export class SubscriptionPackageEntity {
  @PrimaryGeneratedColumn()
  id: number;

  /** 'free' | 'vip' */
  @Column({ type: 'varchar', length: 50, unique: true })
  name: string;

  @Column({ name: 'display_name', type: 'varchar', length: 255 })
  displayName: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  price: number;

  /** Số ngày hiệu lực. -1 = vĩnh viễn (Free) */
  @Column({ name: 'duration_days', type: 'int' })
  durationDays: number;

  // ── Quotas ────────────────────────────────────────────────

  /** Số tin đăng active cùng lúc. -1 = unlimited */
  @Column({ name: 'max_active_jobs', type: 'int' })
  maxActiveJobs: number;

  /** Thời gian tối đa mỗi tin (ngày) */
  @Column({ name: 'job_duration_days', type: 'int' })
  jobDurationDays: number;

  /** Số hồ sơ ứng viên được xem chi tiết / tin. -1 = unlimited */
  @Column({ name: 'max_profile_views_per_job', type: 'int' })
  maxProfileViewsPerJob: number;

  /** Số đơn xử lý mỗi ngày. -1 = unlimited */
  @Column({ name: 'daily_application_process_limit', type: 'int' })
  dailyApplicationProcessLimit: number;

  /** Số lượt bump post miễn phí kèm gói */
  @Column({ name: 'bump_post_quota', type: 'int', default: 0 })
  bumpPostQuota: number;

  /** Số câu hỏi sàng lọc tối đa / tin */
  @Column({ name: 'max_screening_questions', type: 'int', default: 0 })
  maxScreeningQuestions: number;

  /** Số hồ sơ headhunting được xem / tháng. -1 = unlimited */
  @Column({ name: 'monthly_headhunt_profile_views', type: 'int' })
  monthlyHeadhuntProfileViews: number;

  /** Số lượt proceed miễn phí / tháng (pipeline fee). 0 = trả full giá */
  @Column({ name: 'monthly_free_proceeds', type: 'int', default: 0 })
  monthlyFreeProceeds: number;

  // ── Feature Toggles ───────────────────────────────────────

  @Column({
    name: 'can_headhunt_save_and_invite',
    type: 'boolean',
    default: false,
  })
  canHeadhuntSaveAndInvite: boolean;

  @Column({ name: 'can_hide_salary', type: 'boolean', default: false })
  canHideSalary: boolean;

  @Column({ name: 'can_require_cv', type: 'boolean', default: false })
  canRequireCv: boolean;

  @Column({ name: 'has_vip_badge', type: 'boolean', default: false })
  hasVipBadge: boolean;

  /** VIP: unlock liên hệ ứng viên trong Headhunting miễn phí */
  @Column({ name: 'free_contact_unlock', type: 'boolean', default: false })
  freeContactUnlock: boolean;

  /** VIP: AI scoring tự động khi ứng viên apply */
  @Column({ name: 'free_ai_scoring', type: 'boolean', default: false })
  freeAiScoring: boolean;

  /** VIP: Sử dụng bộ lọc nâng cao khi tìm kiếm ứng viên (Headhunting) */
  @Column({ name: 'can_use_premium_filters', type: 'boolean', default: false })
  canUsePremiumFilters: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => CompanySubscriptionEntity, (sub) => sub.package)
  subscriptions: CompanySubscriptionEntity[];
}
