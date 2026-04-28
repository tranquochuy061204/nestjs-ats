import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CompanyEntity } from '../../companies/entities/company.entity';
import { SubscriptionPackageEntity } from './subscription-package.entity';

export enum SubscriptionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

@Entity('company_subscription')
export class CompanySubscriptionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'company_id' })
  companyId: number;

  @Column({ name: 'package_id' })
  packageId: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: SubscriptionStatus.ACTIVE,
  })
  status: string;

  @Column({ name: 'start_date', type: 'timestamptz' })
  startDate: Date;

  /** NULL cho Free (vĩnh viễn) */
  @Column({ name: 'end_date', type: 'timestamptz', nullable: true })
  endDate: Date | null;

  // ── Usage Tracking ────────────────────────────────────────

  @Column({ name: 'used_bump_post_quota', type: 'int', default: 0 })
  usedBumpPostQuota: number;

  /** Số đơn đã xử lý hôm nay */
  @Column({ name: 'daily_processed_count', type: 'int', default: 0 })
  dailyProcessedCount: number;

  /** Ngày của counter trên, dùng để biết khi nào reset */
  @Column({ name: 'daily_processed_date', type: 'date', nullable: true })
  dailyProcessedDate: string | null;

  /** Timestamp đăng tin gần nhất — để enforce lock 7 ngày cho Free */
  @Column({
    name: 'last_job_published_at',
    type: 'timestamptz',
    nullable: true,
  })
  lastJobPublishedAt: Date | null;

  // ── Headhunting Usage ─────────────────────────────────────

  @Column({ name: 'headhunting_views_used', type: 'int', default: 0 })
  headhuntingViewsUsed: number;

  @Column({
    name: 'headhunting_views_reset_at',
    type: 'timestamptz',
    nullable: true,
  })
  headhuntingViewsResetAt: Date | null;

  // ── Pipeline Proceed Usage ────────────────────────────────

  /** Số lượt proceed miễn phí đã dùng tháng này (VIP) */
  @Column({ name: 'used_free_proceeds', type: 'int', default: 0 })
  usedFreeProceeds: number;

  /** Thời điểm reset proceed counter (đầu mỗi tháng) */
  @Column({ name: 'proceeds_reset_at', type: 'timestamptz', nullable: true })
  proceedsResetAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // ── Relations ─────────────────────────────────────────────

  @ManyToOne(() => CompanyEntity)
  @JoinColumn({ name: 'company_id' })
  company: CompanyEntity;

  @ManyToOne(() => SubscriptionPackageEntity, (pkg) => pkg.subscriptions)
  @JoinColumn({ name: 'package_id' })
  package: SubscriptionPackageEntity;
}
