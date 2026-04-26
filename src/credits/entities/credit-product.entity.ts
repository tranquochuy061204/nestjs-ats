import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('credit_product')
export class CreditProductEntity {
  @PrimaryGeneratedColumn()
  id: number;

  /** bump_post | headhunt_job | ai_filter_job | extra_profile_views | extra_job_slot | extend_job | export_report | ai_scoring | ai_scoring_batch_10 */
  @Column({ type: 'varchar', length: 50, unique: true })
  slug: string;

  @Column({ name: 'display_name', type: 'varchar', length: 255 })
  displayName: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'credit_cost', type: 'int' })
  creditCost: number;

  /** Số ngày hiệu lực. NULL = không hết hạn trong scope */
  @Column({ name: 'duration_days', type: 'int', nullable: true })
  durationDays: number | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** 'job' | 'company' */
  @Column({ type: 'varchar', length: 20, default: 'job' })
  scope: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
