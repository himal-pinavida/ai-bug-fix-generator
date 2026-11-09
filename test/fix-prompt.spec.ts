import { buildFixPrompt } from '../src/ai/fix-prompt';

describe('buildFixPrompt', () => {
  it('enumerates every required JSON key and marks user content as untrusted data', () => {
    const prompt = buildFixPrompt('const x = 1;', 'ReferenceError: x is not defined');

    for (const key of [
      'fixed_code',
      'explanation',
      'root_cause',
      'similar_issues',
      'test_suggestions',
      'disclaimer',
    ]) {
      expect(prompt.system).toContain(key);
    }
    expect(prompt.system).toContain('untrusted');
    expect(prompt.system).toContain('JSON');
  });

  it('encodes both values as JSON so quotes and newlines cannot break the delimiter', () => {
    const code = 'if (a) {\n  throw new Error("boom");\n}';
    const error = 'Error: "quoted" } {"ignore": true';
    const prompt = buildFixPrompt(code, error);

    expect(JSON.parse(prompt.user)).toEqual({ code_snippet: code, error_message: error });
    // If the user content were interpolated as prose, a crafted string could forge a JSON key.
    expect(prompt.user).toBe(JSON.stringify({ code_snippet: code, error_message: error }));
  });
});
