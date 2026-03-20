import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('job_type_metadata')
export class JobTypeMetadataEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;
}
