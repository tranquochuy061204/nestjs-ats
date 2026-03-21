import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkillMetadataEntity } from './skills/skill-metadata.entity';
import { SkillsMetadataService } from './skills/skills-metadata.service';
import { SkillsMetadataController } from './skills/skills-metadata.controller';
import { ProvinceMetadataEntity } from './provinces/province.entity';
import { ProvincesService } from './provinces/provinces.service';
import { ProvincesController } from './provinces/provinces.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([SkillMetadataEntity, ProvinceMetadataEntity]),
  ],
  controllers: [SkillsMetadataController, ProvincesController],
  providers: [SkillsMetadataService, ProvincesService],
  exports: [SkillsMetadataService, ProvincesService],
})
export class MetadataModule {}
