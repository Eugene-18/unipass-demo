import { evaluate } from 'mathjs';

const SAFE_FORMULA_PATTERN = /^[0-9a-zA-Z_\s+\-*/().]+$/;

export interface ScoreCalculationResult {
  ok: boolean;
  value?: number;
  error?: string;
}

export function calculateScoreByFormula(
  formula: string,
  scope: Record<string, number>
): ScoreCalculationResult {
  try {
    if (!formula.trim()) {
      return {
        ok: false,
        error: '公式不可為空。',
      };
    }

    if (!SAFE_FORMULA_PATTERN.test(formula)) {
      return {
        ok: false,
        error: '公式包含不允許字元。',
      };
    }

    const result = Number(evaluate(formula, scope));
    if (!Number.isFinite(result)) {
      return {
        ok: false,
        error: '計算結果不是有效數值。',
      };
    }

    return {
      ok: true,
      value: result,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : '計算失敗',
    };
  }
}
