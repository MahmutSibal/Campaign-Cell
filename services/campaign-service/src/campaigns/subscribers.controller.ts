import { Controller, Get, Param, ForbiddenException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UserPayload } from '../auth/current-user.decorator.js';
import { RoleEnum } from '../auth/roles.enum.js';

/**
 * Case §8.2: Aboneye özel teklifler. GET /api/v1/subscribers/:id/offers
 * Güvenlik (IDOR koruması): Abone yalnızca KENDİ tekliflerini görebilir; farklı bir id istenirse 403.
 * Süpervizör/Admin herhangi bir abonenin tekliflerini görebilir.
 */
@ApiTags('Subscriber Offers')
@Controller('api/v1/subscribers')
export class SubscribersController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get(':id/offers')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Aboneye özel, AI ile skorlanmış kişisel teklifler (skor >= 0.60)' })
  getOffers(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    this.assertOwnership(id, user);
    return this.campaignsService.getOffersForSubscriber(id);
  }

  @Get(':id/history')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Abonenin gerçek teklif geçmişi (kabul/ret + puanlar)' })
  getHistory(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    this.assertOwnership(id, user);
    return this.campaignsService.getSubscriberHistory(id);
  }

  // IDOR koruması: abone yalnızca kendi verisine erişir; süpervizör/admin hepsine.
  private assertOwnership(id: string, user: UserPayload) {
    const isPrivileged = user.role === RoleEnum.SUPERVISOR || user.role === RoleEnum.ADMIN;
    if (!isPrivileged && user.userId !== id) {
      throw new ForbiddenException('Yalnızca kendi verilerinizi görüntüleyebilirsiniz (IDOR koruması).');
    }
  }
}
