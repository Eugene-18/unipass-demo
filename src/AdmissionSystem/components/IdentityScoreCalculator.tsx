import { useMemo, useState } from 'react';
import {
  type CandidateIdentity,
  IDENTITY_SCORE_CONFIG,
} from '../config/identityScoreConfig';
import { calculateScoreByFormula } from '../lib/scoreCalculator';

interface ScoreInputState {
  chinese: number;
  english: number;
  document: number;
  interview: number;
  special_bonus: number;
}

const INITIAL_INPUTS: ScoreInputState = {
  chinese: 0,
  english: 0,
  document: 0,
  interview: 0,
  special_bonus: 0,
};

export default function IdentityScoreCalculator() {
  const [identity, setIdentity] = useState<CandidateIdentity>('general');
  const [inputs, setInputs] = useState<ScoreInputState>(INITIAL_INPUTS);

  const activeFormula = useMemo(
    () => IDENTITY_SCORE_CONFIG.identities.find((item) => item.id === identity),
    [identity]
  );

  const calculation = useMemo(() => {
    if (!activeFormula) {
      return {
        ok: false,
        error: '找不到對應身分公式。',
      };
    }

    const scope: Record<string, number> = {};
    activeFormula.variables.forEach((variable) => {
      scope[variable] = inputs[variable as keyof ScoreInputState] ?? 0;
    });

    return calculateScoreByFormula(activeFormula.formula, scope);
  }, [activeFormula, inputs]);

  const handleInputChange = (key: keyof ScoreInputState, value: string) => {
    const numeric = Number(value);
    setInputs((prev) => ({
      ...prev,
      [key]: Number.isFinite(numeric) ? numeric : 0,
    }));
  };

  return (
    <div className="relative bg-white border border-slate-200 rounded-xl p-3 space-y-3 overflow-visible z-[1400]">
      <div className="relative z-[1500] flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-slate-600">考生身分</span>
        <select
          value={identity}
          onChange={(event) => setIdentity(event.target.value as CandidateIdentity)}
          className="relative z-[1600] w-full max-w-[120px] px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
        >
          {IDENTITY_SCORE_CONFIG.identities.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-0.5">
          <span className="text-[11px] text-slate-600">國文</span>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={inputs.chinese}
            onChange={(event) => handleInputChange('chinese', event.target.value)}
            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs"
          />
        </label>

        <label className="space-y-0.5">
          <span className="text-[11px] text-slate-600">英文</span>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={inputs.english}
            onChange={(event) => handleInputChange('english', event.target.value)}
            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs"
          />
        </label>

        <label className="space-y-0.5">
          <span className="text-[11px] text-slate-600">書審</span>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={inputs.document}
            onChange={(event) => handleInputChange('document', event.target.value)}
            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs"
          />
        </label>

        <label className="space-y-0.5">
          <span className="text-[11px] text-slate-600">面試</span>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={inputs.interview}
            onChange={(event) => handleInputChange('interview', event.target.value)}
            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs"
          />
        </label>

        {identity === 'special' && (
          <label className="space-y-0.5 col-span-2">
            <span className="text-[11px] text-slate-600">特種生加分比例 (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={Math.round(inputs.special_bonus * 100)}
              onChange={(event) => {
                const percent = Number(event.target.value);
                setInputs((prev) => ({
                  ...prev,
                  special_bonus: Number.isFinite(percent) ? percent / 100 : 0,
                }));
              }}
              className="w-full max-w-[120px] px-2 py-1.5 rounded-lg border border-slate-200 text-xs"
            />
            <p className="text-[10px] text-slate-500">輸入 35 代表 35%</p>
          </label>
        )}
      </div>

      <div className="rounded-lg p-2.5 bg-indigo-50 border border-indigo-100">
        <p className="text-[11px] text-slate-600">總分</p>
        <p className="text-xl font-black text-indigo-bloom leading-none mt-0.5">
          {calculation.ok ? (calculation.value ?? 0).toFixed(2) : '--'}
        </p>
      </div>
    </div>
  );
}
