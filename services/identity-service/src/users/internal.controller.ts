import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';

/**
 * Servisler arası (internal) uç noktalar — yalnızca Docker ağı içinden servisler tarafından çağrılır.
 * Gateway üzerinden dışarıya açık DEĞİLDİR ve hassas veri döndürmez.
 */
@ApiTags('Internal')
@Controller('internal')
export class InternalController {
  constructor(private readonly usersService: UsersService) {}

  @Get('experts')
  @ApiOperation({ summary: 'AI Service akıllı atama için uzman listesi (hassas veri içermez)' })
  async listExperts() {
    const experts = await this.usersService.findExpertsForAssignment();
    return { success: true, data: experts };
  }
}
