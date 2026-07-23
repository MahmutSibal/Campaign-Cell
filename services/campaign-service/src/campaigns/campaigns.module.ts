import { Module } from '@nestjs/common';
import { CampaignsService } from './campaigns.service.js';
import { CampaignsController } from './campaigns.controller.js';
import { SubscribersController } from './subscribers.controller.js';

@Module({
  controllers: [CampaignsController, SubscribersController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
