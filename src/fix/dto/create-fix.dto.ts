import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { MAX_FIELD_LENGTH } from '../fix.constants';

/** Public request contract for POST /api/fix (snake_case by design). */
export class CreateFixDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'code_snippet must contain non-whitespace characters' })
  @MaxLength(MAX_FIELD_LENGTH)
  code_snippet!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'error_message must contain non-whitespace characters' })
  @MaxLength(MAX_FIELD_LENGTH)
  error_message!: string;
}
