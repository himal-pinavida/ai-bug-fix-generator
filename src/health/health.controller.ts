import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { HealthResponse } from './health-response';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly service: HealthService) {}

  @Get()
  health(@Res({ passthrough: true }) response: Response): HealthResponse {
    const result = this.service.check();
    response.status(result.statusCode);
    return result.body;
  }
}
