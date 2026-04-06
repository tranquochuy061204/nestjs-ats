import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus } from '../entities/job-application.entity';

const UpdateApplicationStatusSchema = z.object({
  status: z.nativeEnum(ApplicationStatus, {
    message: `Trạng thái phải là một trong: ${Object.values(ApplicationStatus).join(', ')}`,
  }),
  reason: z.string().max(1000).optional(),
  note: z.string().max(2000).optional(),
});

export class UpdateApplicationStatusDto extends createZodDto(
  UpdateApplicationStatusSchema,
) {
  @ApiProperty({
    description: 'Trạng thái mới',
    enum: ApplicationStatus,
    example: ApplicationStatus.SHORTLISTED,
  })
  status: ApplicationStatus;

  @ApiPropertyOptional({
    description: 'Lý do (bắt buộc khi reject)',
    maxLength: 1000,
  })
  reason?: string;

  @ApiPropertyOptional({
    description: 'Ghi chú nội bộ của nhà tuyển dụng',
    maxLength: 2000,
  })
  note?: string;
}
