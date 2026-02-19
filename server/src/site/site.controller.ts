import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { SiteService } from './site.service';
import type { SitePageDto } from './dto/site-page.dto';
import { ContactRequestDto } from './dto/contact-request.dto';

@Controller('site')
export class SiteController {
  constructor(private readonly siteService: SiteService) {}

  @Public()
  @Get('pages/:slug')
  async getPage(@Param('slug') slug: string): Promise<SitePageDto> {
    return this.siteService.getPage(slug);
  }

  @Public()
  @Post('contact')
  async submitContact(@Body() dto: ContactRequestDto): Promise<{ message: string }> {
    return this.siteService.createSupportRequest(dto);
  }
}
