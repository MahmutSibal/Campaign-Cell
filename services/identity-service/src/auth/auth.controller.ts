import { Controller, Post, Body, Req, UseGuards, Get, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * İstemci IP'sini güvenilir şekilde çıkarır (gateway arkasında x-forwarded-for).
 */
function clientIp(req: any): string | undefined {
  const xff = req.headers?.['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('send-otp')
  @ApiOperation({ summary: 'GSM numarasına OTP gönder (simülasyon)' })
  async sendOtp(@Body() body: { gsmNumber: string }, @Req() req: any) {
    return this.authService.sendOtp(body.gsmNumber, clientIp(req));
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'OTP doğrula ve token üret (abone girişi)' })
  async verifyOtp(@Body() body: { gsmNumber: string; otpCode: string }, @Req() req: any) {
    return this.authService.verifyOtp(body.gsmNumber, body.otpCode, clientIp(req));
  }

  @Post('login')
  @ApiOperation({ summary: 'E-posta + şifre ile personel girişi' })
  async login(@Body() body: any, @Req() req: any) {
    const ip = clientIp(req);
    const user = await this.authService.validateUser(body.identifier, body.password, ip);
    if (!user) {
      throw new UnauthorizedException('E-posta veya parola hatalı');
    }
    return this.authService.login(user, ip);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh token ile yeni access/refresh üret (rotation + theft koruması)' })
  async refresh(@Body() body: { refresh_token?: string; refreshToken?: string }, @Req() req: any) {
    const token = body.refresh_token || body.refreshToken || '';
    return this.authService.refresh(token, clientIp(req));
  }

  @Post('logout')
  @ApiOperation({ summary: 'Oturumu sonlandır (refresh token geçersiz kılınır)' })
  async logout(@Body() body: { refresh_token?: string; refreshToken?: string }, @Req() req: any) {
    const token = body.refresh_token || body.refreshToken || '';
    return this.authService.logout(token, clientIp(req));
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('profile')
  @ApiOperation({ summary: 'Oturum sahibi kullanıcı profili' })
  getProfile(@Req() req: any) {
    return req.user;
  }
}
