import { Module, forwardRef } from '@nestjs/common';
import { PointsService } from './points.service.js';
import { PointsController } from './points.controller.js';
import { BadgesModule } from '../badges/badges.module.js';

@Module({
  imports: [forwardRef(() => BadgesModule)],
  controllers: [PointsController],
  providers: [PointsService],
  exports: [PointsService],
})
export class PointsModule {}
