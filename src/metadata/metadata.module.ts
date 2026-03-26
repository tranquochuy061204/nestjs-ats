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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SkillMetadataEntity,
      ProvinceMetadataEntity,
      JobCategoryMetadataEntity,
      JobTypeMetadataEntity,
    ]),
  ],
  controllers: [
    SkillsMetadataController,
    ProvincesController,
    JobCategoriesController,
    JobTypesController,
  ],
  providers: [
    SkillsMetadataService,
    ProvincesService,
    JobCategoriesService,
    JobTypesService,
  ],
  exports: [
    SkillsMetadataService,
    ProvincesService,
    JobCategoriesService,
    JobTypesService,
  ],
})
export class MetadataModule {}
