import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('candidate')
export class CandidateEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', unique: true })
  user_id: number;

  @OneToOne(() => UserEntity, (user) => user.candidate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'varchar', length: 255, nullable: true })
  full_name: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  gender: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  avatar_url: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  cv_url: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  // Tạm thời dùng int do chưa implement bảng province
  @Column({ type: 'int', nullable: true })
  province_id: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  position: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  salary_min: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  salary_max: number;

  // Tạm thời dùng int do chưa implement bảng job_type
  @Column({ type: 'int', nullable: true })
  job_type_id: number;

  @Column({ type: 'int', nullable: true })
  year_working_experience: number;
}
