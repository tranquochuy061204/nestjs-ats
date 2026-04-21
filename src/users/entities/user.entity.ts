import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  BeforeInsert,
  OneToOne,
  Index,
} from 'typeorm';
import * as bcrypt from 'bcrypt';

import { CandidateEntity } from '../../candidates/entities/candidate.entity';
import { EmployerEntity } from '../../employers/entities/employer.entity';

export const BCRYPT_SALT_ROUNDS = 10;

export enum UserRole {
  ADMIN = 'admin',
  EMPLOYER = 'employer',
  CANDIDATE = 'candidate',
}

export enum UserStatus {
  ACTIVE = 'active',
  LOCKED = 'locked',
}

@Entity('user')
export class UserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Index()
  @Column({ type: 'varchar', length: 20, default: UserRole.CANDIDATE })
  role: UserRole;

  @Index()
  @Column({ type: 'varchar', length: 20, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ name: 'is_email_verified', type: 'boolean', default: false })
  isEmailVerified: boolean;

  @Column({
    name: 'email_verification_token',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  emailVerificationToken: string | null;

  @Column({
    name: 'reset_password_token',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  resetPasswordToken: string | null;

  @Column({
    name: 'reset_password_expires',
    type: 'timestamp',
    nullable: true,
  })
  resetPasswordExpires: Date | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'now()' })
  created_at: Date;

  @OneToOne(() => CandidateEntity, (candidate) => candidate.user)
  candidate: CandidateEntity;

  @OneToOne(() => EmployerEntity, (employer) => employer.user)
  employer: EmployerEntity;

  @BeforeInsert()
  async hashPassword() {
    this.password = await bcrypt.hash(this.password, BCRYPT_SALT_ROUNDS);
  }
}
