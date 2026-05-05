// Core
import { Module } from '@nestjs/common';

// Controllers
import { UsersController } from './users.controller';

// Services
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
