import { AiFixPayload, STANDARD_AI_DISCLAIMER } from '../../ai/ai-fix-payload';

/** Exactly the six public response fields — no provider metadata or raw model content leaks out. */
export class FixResponseDto {
  fixed_code!: string;
  explanation!: string;
  root_cause!: string;
  similar_issues!: string[];
  test_suggestions!: string[];
  disclaimer!: string;

  static from(payload: AiFixPayload): FixResponseDto {
    const response = new FixResponseDto();
    response.fixed_code = payload.fixed_code;
    response.explanation = payload.explanation;
    response.root_cause = payload.root_cause;
    response.similar_issues = [...payload.similar_issues];
    response.test_suggestions = [...payload.test_suggestions];
    response.disclaimer = payload.disclaimer?.trim() || STANDARD_AI_DISCLAIMER;
    return response;
  }
}
