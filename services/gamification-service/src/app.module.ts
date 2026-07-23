import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module.js';
import { PointsModule } from './points/points.module.js';
import { BadgesModule } from './badges/badges.module.js';
import { LeaderboardModule } from './leaderboard/leaderboard.module.js';
import { EventConsumerService } from './events/event-consumer.service.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    RabbitMQModule,
    PointsModule,
    BadgesModule,
    LeaderboardModule,
  ],
  controllers: [AppController],
  providers: [EventConsumerService],
})
export class AppModule {}
