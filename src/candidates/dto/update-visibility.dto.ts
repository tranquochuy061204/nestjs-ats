import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

const UpdateVisibilitySchema = z.object({
  isPublic: z.boolean(),
});

export class UpdateVisibilityDto extends createZodDto(UpdateVisibilitySchema) {
  @ApiProperty({
    description: 'Bật/Tắt trạng thái public hồ sơ',
    example: true,
  })
  isPublic: boolean;
}
