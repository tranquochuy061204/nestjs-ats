import { UserEntity } from '../../users/entities/user.entity';
import { CompanyEntity } from '../../companies/entities/company.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum EmployerStatus {
  ACTIVE = 'active',
  LOCKED = 'locked',
}

@Entity('employer')
export class EmployerEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', unique: true })
  userId: number;

  @Index()
  @Column({ name: 'company_id', nullable: true })
  companyId: number | null;

  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  fullName: string;

  @Column({
    name: 'phone_contact',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  phoneContact: string;

  @Column({ name: 'avatar_url', type: 'varchar', length: 255, nullable: true })
  avatarUrl: string;

  @Column({ name: 'is_admin_company', default: false })
  isAdminCompany: boolean;

  @Column({ type: 'varchar', length: 20, default: EmployerStatus.ACTIVE })
  status: EmployerStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne('CompanyEntity', (company: any) => company.employers, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'company_id' })
  company: CompanyEntity;
}
