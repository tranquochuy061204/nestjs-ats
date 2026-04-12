import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

const UpdateApplicationNoteSchema = z.object({
  content: z.string().min(1, 'Nội dung ghi chú không được để trống').max(2000),
});

export class UpdateApplicationNoteDto extends createZodDto(
  UpdateApplicationNoteSchema,
) {
  @ApiProperty({
    description: 'Cập nhật nội dung ghi chú',
    minLength: 1,
    maxLength: 2000,
  })
  content: string;
}
