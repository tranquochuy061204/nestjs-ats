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
import { CandidateEntity } from '../../candidates/entities/candidate.entity';

@Entity('contact_unlock_log')
export class ContactUnlockLogEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'company_id' })
  companyId: number;

  @Index()
  @Column({ name: 'candidate_id' })
  candidateId: number;

  /** 0 nếu VIP (miễn phí) */
  @Column({ name: 'credit_spent', type: 'int', default: 0 })
  creditSpent: number;

  @CreateDateColumn({ name: 'unlocked_at' })
  unlockedAt: Date;

  @ManyToOne(() => CompanyEntity)
  @JoinColumn({ name: 'company_id' })
  company: CompanyEntity;

  @ManyToOne(() => CandidateEntity)
  @JoinColumn({ name: 'candidate_id' })
  candidate: CandidateEntity;
}
