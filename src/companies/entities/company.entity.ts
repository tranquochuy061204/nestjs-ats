import { EmployerEntity } from '../../employers/entities/employer.entity';
import { CompanyImageEntity } from './company-image.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('company')
export class CompanyEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_creator_id', unique: true })
  userCreatorId: number;

  @Column({ name: 'category_id' })
  categoryId: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    name: 'email_contact',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  emailContact: string;

  @Column({
    name: 'phone_contact',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  phoneContact: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ name: 'province_id', nullable: true })
  provinceId: number;

  @Column({ name: 'logo_url', type: 'varchar', length: 255, nullable: true })
  logoUrl: string;

  @Column({ name: 'banner_url', type: 'varchar', length: 255, nullable: true })
  bannerUrl: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ name: 'company_size', type: 'varchar', length: 50, nullable: true })
  companySize: string;

  @Column({ name: 'website_url', type: 'varchar', length: 255, nullable: true })
  websiteUrl: string;

  @Column({
    name: 'facebook_url',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  facebookUrl: string;

  @Column({
    name: 'linkedin_url',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  linkedinUrl: string;

  @Column({
    name: 'business_license_url',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  businessLicenseUrl: string;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ name: 'verified_at', type: 'timestamp', nullable: true })
  verifiedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => EmployerEntity, (employer) => employer.company)
  employers: EmployerEntity[];

  @OneToMany(
    () => CompanyImageEntity,
    (img: CompanyImageEntity) => img.company,
    {
      cascade: true,
    },
  )
  images: CompanyImageEntity[];
}
