import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { CompanyEntity } from '../../companies/entities/company.entity';
import { EmployerEntity } from '../../employers/entities/employer.entity';
import { ProvinceMetadataEntity } from '../../metadata/provinces/province.entity';
import { JobCategoryMetadataEntity } from '../../metadata/job-categories/job-category.entity';
import { JobTypeMetadataEntity } from '../../metadata/job-types/job-type.entity';
import { JobSkillTagEntity } from './job-skill-tag.entity';

export enum JobStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  CLOSED = 'closed',
}

@Entity('job')
export class JobEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'company_id' })
  companyId: number;

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

  @Column({ name: 'salary_min', type: 'int', nullable: true })
  salaryMin: number;

  @Column({ name: 'salary_max', type: 'int', nullable: true })
  salaryMax: number;

  @Column({ type: 'varchar', length: 10, default: 'VND' })
  currency: string;

  @Column({ name: 'years_of_experience', type: 'int', nullable: true })
  yearsOfExperience: number;

  @Column({ name: 'province_id', nullable: true })
  provinceId: number;

  @Column({ name: 'category_id', nullable: true })
  categoryId: number;

  @Column({ name: 'job_type_id', nullable: true })
  jobTypeId: number;

  @Column({ type: 'varchar', length: 20, default: JobStatus.DRAFT })
  status: string;

  @Column({ type: 'int', nullable: true })
  slots: number;

  @Column({ type: 'timestamp', nullable: true })
  deadline: Date;

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

  @OneToMany(() => JobSkillTagEntity, (skillTag) => skillTag.job, {
    cascade: ['insert', 'update', 'remove'],
  })
  skills: JobSkillTagEntity[];
}
