import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CompanyEntity, CompanyStatus } from './company.entity';

@Entity('company_status_history')
export class CompanyStatusHistoryEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'company_id' })
  companyId: number;

  @Column({ name: 'old_status', type: 'varchar', length: 20, nullable: true })
  oldStatus: CompanyStatus | string;

  @Column({ name: 'new_status', type: 'varchar', length: 20 })
  newStatus: CompanyStatus | string;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ name: 'changed_by_id', nullable: true })
  changedById: number; // ID của Admin thực hiện

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => CompanyEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: CompanyEntity;
}
