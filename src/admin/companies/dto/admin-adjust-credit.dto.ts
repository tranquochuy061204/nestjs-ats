import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

const AdminAdjustCreditSchema = z.object({
  amount: z.coerce.number().int().describe('Số credit điều chỉnh. Số dương = thêm, số âm = trừ'),
  reason: z.string().min(1, 'Lý do bắt buộc phải nhập').describe('Lý do điều chỉnh'),
});

export class AdminAdjustCreditDto extends createZodDto(AdminAdjustCreditSchema) {
  @ApiProperty({
    description: 'Số credit điều chỉnh. Số dương = thêm, số âm = trừ',
    example: 100,
  })
  amount: number;

  @ApiProperty({
    description: 'Lý do điều chỉnh (bắt buộc, hiển thị trong lịch sử giao dịch)',
    example: 'Hoàn tiền do lỗi hệ thống',
  })
  reason: string;
}
