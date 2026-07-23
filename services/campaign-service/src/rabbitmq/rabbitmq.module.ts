import { Global, Module } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service.js';
import { CampaignEventConsumerService } from './campaign-event-consumer.service.js';

@Global()
@Module({
  providers: [RabbitMQService, CampaignEventConsumerService],
  exports: [RabbitMQService, CampaignEventConsumerService],
})
export class RabbitMQModule {}
