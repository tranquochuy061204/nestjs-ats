import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { CompanyEntity } from '../../companies/entities/company.entity';
import { EmployerEntity } from '../../employers/entities/employer.entity';
import { ProvinceMetadataEntity } from '../../metadata/provinces/province.entity';
import { JobCategoryMetadataEntity } from '../../metadata/job-categories/job-category.entity';
import { JobTypeMetadataEntity } from '../../metadata/job-types/job-type.entity';
import { JobSkillTagEntity } from './job-skill-tag.entity';
import { JobLevelMetadataEntity } from '../../metadata/job-levels/job-level.entity';
import { Degree } from '../../common/enums/degree.enum';
import { JobApplicationEntity } from '../../applications/entities/job-application.entity';

export enum JobStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  PUBLISHED = 'published',
  REJECTED = 'rejected',
  CLOSED = 'closed',
}

@Entity('job')
export class JobEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'company_id' })
  companyId: number;

  @Index()
  @Column({ name: 'employer_id' })
  employerId: number;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  requirements: string;

  @Column({ type: 'text', nullable: true })
  benefits: string;

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

  @Column({ type: 'varchar', length: 10, default: 'VND' })
  currency: string;

  @Column({ name: 'years_of_experience', type: 'int', nullable: true })
  yearsOfExperience: number;

  @Index()
  @Column({ name: 'province_id', nullable: true })
  provinceId: number;

  @Index()
  @Column({ name: 'category_id', nullable: true })
  categoryId: number;

  @Index()
  @Column({ name: 'job_type_id', nullable: true })
  jobTypeId: number;

  @Index()
  @Column({ name: 'level_id', nullable: true })
  levelId: number;

  @Column({
    name: 'required_degree',
    type: 'enum',
    enum: Degree,
    default: Degree.NONE,
  })
  requiredDegree: Degree;

  @Index()
  @Column({ type: 'varchar', length: 20, default: JobStatus.DRAFT })
  status: string;

  @Column({ type: 'int', nullable: true })
  slots: number;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  deadline: Date;

  // -- VIP & Monetization Features --

  @Column({ name: 'hide_salary', type: 'boolean', default: false })
  hideSalary: boolean;

  @Column({ name: 'require_cv', type: 'boolean', default: false })
  requireCv: boolean;

  @Column({ name: 'is_bumped', type: 'boolean', default: false })
  isBumped: boolean;

  @Column({ name: 'bumped_until', type: 'timestamp', nullable: true })
  bumpedUntil: Date | null;

  @Column({ name: 'bumped_at', type: 'timestamp', nullable: true })
  bumpedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // -- RELATIONS --

  @ManyToOne(() => CompanyEntity)
  @JoinColumn({ name: 'company_id' })
  company: CompanyEntity;

  @ManyToOne(() => EmployerEntity)
  @JoinColumn({ name: 'employer_id' })
  employer: EmployerEntity;

  @ManyToOne(() => ProvinceMetadataEntity)
  @JoinColumn({ name: 'province_id' })
  province: ProvinceMetadataEntity;

  @ManyToOne(() => JobCategoryMetadataEntity)
  @JoinColumn({ name: 'category_id' })
  category: JobCategoryMetadataEntity;

  @ManyToOne(() => JobTypeMetadataEntity)
  @JoinColumn({ name: 'job_type_id' })
  jobType: JobTypeMetadataEntity;

  @ManyToOne(() => JobLevelMetadataEntity)
  @JoinColumn({ name: 'level_id' })
  level: JobLevelMetadataEntity;

  @OneToMany(() => JobSkillTagEntity, (skillTag) => skillTag.job, {
    cascade: ['insert', 'update', 'remove'],
  })
  skills: JobSkillTagEntity[];

  @OneToMany(() => JobApplicationEntity, (app) => app.job)
  applications: JobApplicationEntity[];
}
