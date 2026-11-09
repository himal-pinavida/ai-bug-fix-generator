import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CreateFixDto } from './dto/create-fix.dto';
import { FixResponseDto } from './dto/fix-response.dto';
import { FixService } from './fix.service';

/** Thin HTTP edge: bind/validate the DTO, delegate, return 201. No business logic lives here. */
@Controller('api/fix')
export class FixController {
  constructor(private readonly service: FixService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  fix(@Body() body: CreateFixDto): Promise<FixResponseDto> {
    return this.service.fix(body.code_snippet, body.error_message);
  }
}
