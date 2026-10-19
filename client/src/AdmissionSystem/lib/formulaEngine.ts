import { all, create } from 'mathjs';

const math = create(all, {});
const PLACEHOLDER_PATTERN = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
const SAFE_CHARS_PATTERN = /^[0-9a-zA-Z_\s+\-*/().,%]+$/;

interface CompileFormulaResult {
  expression: string;
  variables: string[];
}

export interface FormulaResult {
  ok: boolean;
  value?: number;
  error?: string;
}

function normalizeVariableValues(values: Record<string, unknown>): Record<string, number> {
  const scope: Record<string, number> = {};

  Object.entries(values).forEach(([key, rawValue]) => {
    const value = Number(rawValue);
    scope[key] = Number.isFinite(value) ? value : 0;
  });

  return scope;
}

function compileFormula(formula: string): CompileFormulaResult {
  const variables = new Set<string>();
  const expression = formula.replace(PLACEHOLDER_PATTERN, (_matched, key: string) => {
    variables.add(key);
    return key;
  });

  if (!SAFE_CHARS_PATTERN.test(expression)) {
    throw new Error('公式包含不允許的字元，僅可使用數字、運算符與函式。');
  }

  return {
    expression,
    variables: Array.from(variables),
  };
}

export function validateFormulaSyntax(formula: string): FormulaResult {
  try {
    const { expression } = compileFormula(formula);
    math.parse(expression);

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : '公式語法錯誤',
    };
  }
}

export function evaluateFormula(
  formula: string,
  values: Record<string, unknown>
): FormulaResult {
  try {
    const { expression, variables } = compileFormula(formula);
    const scope = normalizeVariableValues(values);

    const missing = variables.filter((variable) => !(variable in scope));
    if (missing.length > 0) {
      return {
        ok: false,
        error: `缺少公式欄位：${missing.join(', ')}`,
      };
    }

    const result = Number(math.evaluate(expression, scope));
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
      error: error instanceof Error ? error.message : '公式計算失敗',
    };
  }
}
