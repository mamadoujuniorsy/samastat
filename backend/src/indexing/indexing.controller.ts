import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StaffGuard } from '../auth/staff.guard.js';
import { IndexingService } from './indexing.service.js';

/** Administration de l'index sémantique, réservée au personnel ANSD connecté. */
@ApiTags('Administration')
@Controller('admin')
export class IndexingController {
  constructor(private readonly indexing: IndexingService) {}

  @Get('index')
  @ApiOperation({ summary: "État de l'index sémantique" })
  status() {
    return this.indexing.status();
  }

  @Post('reindex')
  @UseGuards(StaffGuard)
  @ApiBearerAuth('staff')
  @ApiOperation({ summary: 'Relancer l’indexation (personnel ANSD connecté)' })
  async reindex(@Body() body: { all?: unknown }) {
    return this.indexing.enqueue({ all: body?.all === true, reason: 'demande administrateur' });
  }
}
