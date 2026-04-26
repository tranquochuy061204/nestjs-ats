import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Seed data — cấu hình phí Credit khi employer proceed ứng viên sang trạng thái mới.
 * isFree = true nghĩa là không tính phí (rejected / withdrawn / hired).
 */
@Entity('pipeline_fee_config')
export class PipelineFeeConfigEntity {
  @PrimaryGeneratedColumn()
  id: number;

  /** Trạng thái đích: shortlisted | skill_test | interview | offer | hired | rejected | withdrawn */
  @Column({ name: 'to_status', type: 'varchar', length: 30, unique: true })
  toStatus: string;

  /** Phí Credit cho Free user */
  @Column({ name: 'credit_cost', type: 'int', default: 0 })
  creditCost: number;

  /** Phí Credit cho VIP sau khi hết monthly_free_proceeds */
  @Column({ name: 'vip_credit_cost', type: 'int', default: 0 })
  vipCreditCost: number;

  /** true = miễn phí hoàn toàn (rejected, withdrawn, hired) */
  @Column({ name: 'is_free', type: 'boolean', default: false })
  isFree: boolean;
}
