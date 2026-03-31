import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const RejectJobSchema = z.object({
  reason: z.string().min(1, 'Lý do từ chối là bắt buộc').max(1000),
});

export class RejectJobDto extends createZodDto(RejectJobSchema) {
  @ApiProperty({ description: 'Lý do bài đăng bị từ chối' })
  reason: string;
}
