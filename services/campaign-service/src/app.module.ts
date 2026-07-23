import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module.js';
import { CampaignsModule } from './campaigns/campaigns.module.js';
import { CasesModule } from './cases/cases.module.js';
import { SlaModule } from './sla/sla.module.js';
import { FeedbackModule } from './feedback/feedback.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    RabbitMQModule,
    CampaignsModule,
    CasesModule,
    SlaModule,
    FeedbackModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
