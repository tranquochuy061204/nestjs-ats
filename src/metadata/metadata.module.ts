import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkillMetadataEntity } from './skills/skill-metadata.entity';
import { SkillsMetadataService } from './skills/skills-metadata.service';
import { SkillsMetadataController } from './skills/skills-metadata.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SkillMetadataEntity])],
  controllers: [SkillsMetadataController],
  providers: [SkillsMetadataService],
  exports: [SkillsMetadataService],
})
export class MetadataModule {}
