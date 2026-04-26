import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CompanyEntity } from '../../companies/entities/company.entity';
import { CreditProductEntity } from './credit-product.entity';
import { JobEntity } from '../../jobs/entities/job.entity';

@Entity('credit_purchase_log')
export class CreditPurchaseLogEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'company_id' })
  companyId: number;

  @Column({ name: 'product_id' })
  productId: number;

  @Column({ name: 'credit_spent', type: 'int' })
  creditSpent: number;

  /** null nếu scope = 'company' */
  @Column({ name: 'target_job_id', type: 'int', nullable: true })
  targetJobId: number | null;

  @Column({ name: 'activated_at', type: 'timestamp', default: () => 'now()' })
  activatedAt: Date;

  /** null = không hết hạn */
  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => CompanyEntity)
  @JoinColumn({ name: 'company_id' })
  company: CompanyEntity;

  @ManyToOne(() => CreditProductEntity)
  @JoinColumn({ name: 'product_id' })
  product: CreditProductEntity;

  @ManyToOne(() => JobEntity, { nullable: true })
  @JoinColumn({ name: 'target_job_id' })
  targetJob: JobEntity | null;
}
