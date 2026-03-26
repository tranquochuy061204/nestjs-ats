import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JobTypesService } from './job-types.service';

@ApiTags('Metadata')
@Controller('metadata/job-types')
export class JobTypesController {
  constructor(private readonly service: JobTypesService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách hình thức làm việc (Job Types)' })
  findAll() {
    return this.service.findAll();
  }
}
