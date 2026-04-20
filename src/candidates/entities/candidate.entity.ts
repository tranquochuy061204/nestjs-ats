import { UserEntity } from '../../users/entities/user.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CertificateEntity } from './certificate.entity';
import { CandidateJobCategoryEntity } from './candidate-job-category.entity';
import { JobTypeMetadataEntity } from '../../metadata/job-types/job-type.entity';
import { WorkExperienceEntity } from './work-experience.entity';
import { EducationEntity } from './education.entity';
import { ProjectEntity } from './project.entity';
import { CandidateSkillTagEntity } from './candidate-skill-tag.entity';
import { JobApplicationEntity } from '../../applications/entities/job-application.entity';

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

  @Index()
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

  @Index()
  @Column({ name: 'job_type_id', type: 'int', nullable: true })
  jobTypeId: number;

  @ManyToOne(() => JobTypeMetadataEntity)
  @JoinColumn({ name: 'job_type_id' })
  jobType: JobTypeMetadataEntity;

  @Index()
  @Column({ name: 'year_working_experience', type: 'int', nullable: true })
  yearWorkingExperience: number;

  @Index()
  @Column({ name: 'is_public', type: 'boolean', default: false })
  isPublic: boolean;

  @Column({
    name: 'linkedin_url',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  linkedinUrl: string;

  @Column({ name: 'github_url', type: 'varchar', length: 255, nullable: true })
  githubUrl: string;

  @Column({
    name: 'portfolio_url',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  portfolioUrl: string;

  @OneToOne(() => UserEntity, (user) => user.candidate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @OneToMany(() => CertificateEntity, (cert) => cert.candidate)
  certificates: CertificateEntity[];

  @OneToMany(() => CandidateJobCategoryEntity, (cjc) => cjc.candidate)
  jobCategories: CandidateJobCategoryEntity[];

  @OneToMany(() => WorkExperienceEntity, (we) => we.candidate)
  workExperiences: WorkExperienceEntity[];

  @OneToMany(() => EducationEntity, (edu) => edu.candidate)
  educations: EducationEntity[];

  @OneToMany(() => ProjectEntity, (proj) => proj.candidate)
  projects: ProjectEntity[];

  @OneToMany(() => CandidateSkillTagEntity, (skill) => skill.candidate)
  skills: CandidateSkillTagEntity[];

  @OneToMany(() => JobApplicationEntity, (app) => app.candidate)
  applications: JobApplicationEntity[];
}
