import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export const STANDARD_AI_DISCLAIMER =
  'AI-generated suggestion — review and test before applying.';

/** Validated provider payload. Property names intentionally match the JSON wire contract. */
export class AiFixPayload {
  @IsString()
  @IsNotEmpty()
  fixed_code!: string;

  @IsString()
  @IsNotEmpty()
  explanation!: string;

  @IsString()
  @IsNotEmpty()
  root_cause!: string;

  @IsArray()
  @IsString({ each: true })
  similar_issues!: string[];

  @IsArray()
  @IsString({ each: true })
  test_suggestions!: string[];

  @IsOptional()
  @IsString()
  disclaimer?: string;
}
