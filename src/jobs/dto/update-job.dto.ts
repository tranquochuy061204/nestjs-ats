import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BaseJobSchema } from './create-job.dto';
import { JobStatus } from '../entities/job.entity';

export const UpdateJobSchema = BaseJobSchema.partial().extend({
  status: z.enum(JobStatus).optional(),
});

export class UpdateJobDto extends createZodDto(UpdateJobSchema) {
  @ApiPropertyOptional({
    description: 'Trạng thái bài vêt: draft | published | closed',
    enum: JobStatus,
  })
  status?: JobStatus;

  // other properties are inherited correctly from CreateJobDto and Swagger will show them as optional
}
