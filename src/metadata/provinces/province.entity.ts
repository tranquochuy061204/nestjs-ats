import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('province_metadata')
export class ProvinceMetadataEntity {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
