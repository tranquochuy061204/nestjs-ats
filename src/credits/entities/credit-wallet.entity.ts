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

@Entity('credit_wallet')
export class CreditWalletEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'company_id', unique: true })
  companyId: number;

  @Column({ type: 'int', default: 0 })
  balance: number;

  /** Tổng Credit đã nạp (bao gồm bonus) */
  @Column({ name: 'total_earned', type: 'int', default: 0 })
  totalEarned: number;

  /** Tổng Credit đã tiêu */
  @Column({ name: 'total_spent', type: 'int', default: 0 })
  totalSpent: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => CompanyEntity)
  @JoinColumn({ name: 'company_id' })
  company: CompanyEntity;
}
