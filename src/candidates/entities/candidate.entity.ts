import { UserEntity } from '../../users/entities/user.entity';
import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('candidate')
export class CandidateEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', unique: true })
  userId: number;

  @Column({ name: 'full_name', type: 'varchar', length: 255, nullable: true })
  fullName: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  gender: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ name: 'avatar_url', type: 'varchar', length: 255, nullable: true })
  avatarUrl: string;

  @Column({ name: 'cv_url', type: 'varchar', length: 255, nullable: true })
  cvUrl: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ name: 'province_id', type: 'int', nullable: true })
  provinceId: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  position: string;

  @Column({
    name: 'salary_min',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  salaryMin: number;

  @Column({
    name: 'salary_max',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  salaryMax: number;

  @Column({ name: 'job_type_id', type: 'int', nullable: true })
  jobTypeId: number;

  @Column({ name: 'year_working_experience', type: 'int', nullable: true })
  yearWorkingExperience: number;

  @OneToOne(() => UserEntity, (user) => user.candidate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
