import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkillMetadataEntity } from './skills/skill-metadata.entity';
import { SkillsMetadataService } from './skills/skills-metadata.service';
import { SkillsMetadataController } from './skills/skills-metadata.controller';
import { ProvinceMetadataEntity } from './provinces/province.entity';
import { ProvincesService } from './provinces/provinces.service';
import { ProvincesController } from './provinces/provinces.controller';
import { JobCategoryMetadataEntity } from './job-categories/job-category.entity';
import { JobCategoriesService } from './job-categories/job-categories.service';
import { JobCategoriesController } from './job-categories/job-categories.controller';
import { JobTypeMetadataEntity } from './job-types/job-type.entity';
import { JobTypesService } from './job-types/job-types.service';
import { JobTypesController } from './job-types/job-types.controller';
import { JobLevelMetadataEntity } from './job-levels/job-level.entity';
import { JobLevelsService } from './job-levels/job-levels.service';
import { JobLevelsController } from './job-levels/job-levels.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SkillMetadataEntity,
      ProvinceMetadataEntity,
      JobCategoryMetadataEntity,
      JobTypeMetadataEntity,
      JobLevelMetadataEntity,
    ]),
  ],
  controllers: [
    SkillsMetadataController,
    ProvincesController,
    JobCategoriesController,
    JobTypesController,
    JobLevelsController,
  ],
  providers: [
    SkillsMetadataService,
    ProvincesService,
    JobCategoriesService,
    JobTypesService,
    JobLevelsService,
  ],
  exports: [
    SkillsMetadataService,
    ProvincesService,
    JobCategoriesService,
    JobTypesService,
    JobLevelsService,
  ],
})
export class MetadataModule {}
