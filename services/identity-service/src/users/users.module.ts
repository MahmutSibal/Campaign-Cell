import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { AdminController } from './admin.controller';
import { InternalController } from './internal.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdminController, InternalController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
