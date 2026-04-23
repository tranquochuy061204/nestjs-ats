import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('job_level_metadata')
export class JobLevelMetadataEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Index()
  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;
}
