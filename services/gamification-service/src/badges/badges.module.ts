import { Module, forwardRef } from '@nestjs/common';
import { BadgesService } from './badges.service.js';
import { BadgesController } from './badges.controller.js';
import { PointsModule } from '../points/points.module.js';

@Module({
  imports: [forwardRef(() => PointsModule)],
  controllers: [BadgesController],
  providers: [BadgesService],
  exports: [BadgesService],
})
export class BadgesModule {}
