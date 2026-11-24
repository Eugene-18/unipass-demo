import type { AdmissionChannelConfig, CandidateFieldConfig } from '../types';
import { validateFormulaSyntax } from '../lib/formulaEngine';

interface AdminConfigPanelProps {
  config: AdmissionChannelConfig;
  onChange: (next: AdmissionChannelConfig) => void;
}

function toInputDate(iso: string): string {
  return iso.slice(0, 10);
}

function toIsoDateTime(localDate: string, isEnd: boolean): string {
  if (!localDate) return localDate;

  if (localDate.includes('T')) {
    if (localDate.length === 16) {
      return `${localDate}:00+08:00`;
    }
    if (localDate.endsWith('+08:00')) {
      return localDate;
    }
    return `${localDate}+08:00`;
  }

  return `${localDate}T${isEnd ? '23:59:59' : '00:00:00'}+08:00`;
}

import { useAdmissionContext } from '../contexts/AdmissionContext';

export default function AdminConfigPanel({ config, onChange }: AdminConfigPanelProps) {
  // prefer context when available for global sync
  try {
    const ctx = useAdmissionContext();
    if (!config) config = ctx.channelConfig as AdmissionChannelConfig;
    if (!onChange) onChange = ctx.setChannelConfig as (next: AdmissionChannelConfig) => void;
  } catch (e) {
    // context not provided; fall back to props
  }
  const fieldCatalog: Record<string, CandidateFieldConfig> = {
    chinese: {
      id: 'chinese',
      label: '國文',
      type: 'score',
      required: true,
      min: 0,
      max: 100,
      step: 0.5,
      placeholder: '請輸入國文成績',
    },
    english: {
      id: 'english',
      label: '英文',
      type: 'score',
      required: true,
      min: 0,
      max: 100,
      step: 0.5,
      placeholder: '請輸入英文成績',
    },
    interview: {
      id: 'interview',
      label: '面試',
      type: 'score',
      required: false,
      min: 0,
      max: 100,
      step: 0.5,
      placeholder: '若有面試請輸入分數',
    },
    special_bonus: {
      id: 'special_bonus',
      label: '加權加分比例',
      type: 'number',
      required: false,
      min: 0,
      max: 1,
      step: 0.01,
      placeholder: '例如 0.05',
      helpText: '5% 請輸入 0.05',
    },
    autobiography: {
      id: 'autobiography',
      label: '自傳',
      type: 'document',
      required: true,
      accept: ['PDF'],
    },
    study_plan: {
      id: 'study_plan',
      label: '讀書計畫',
      type: 'document',
      required: true,
      accept: ['PDF'],
    },
    transcript: {
      id: 'transcript',
      label: '歷年成績單',
      type: 'document',
      required: true,
      accept: ['PDF', 'JPG'],
    },
    competition_or_certificate: {
      id: 'competition_or_certificate',
      label: '競賽或證照證明',
      type: 'document',
      required: false,
      accept: ['PDF', 'JPG'],
    },
  };

  const scoreSyntax = validateFormulaSyntax(config.score_formula);
  const feeSyntax = validateFormulaSyntax(config.fee_formula);

  const updatePhase = (phase: 'registration' | 'payment' | 'announcement', key: 'start' | 'end', value: string) => {
    onChange({
      ...config,
      phases: {
        ...config.phases,
        [phase]: {
          ...config.phases[phase],
          [key]: toIsoDateTime(value, key === 'end'),
        },
      },
    });
  };

  const toggleField = (fieldId: string, checked: boolean) => {
    const target = fieldCatalog[fieldId as keyof typeof fieldCatalog];
    if (!target) return;

    const exists = config.candidate_fields.some((field) => field.id === fieldId);
    if (checked && exists) return;

    if (!checked) {
      onChange({
        ...config,
        candidate_fields: config.candidate_fields.filter((field) => field.id !== fieldId),
      });
      return;
    }

    onChange({
      ...config,
      candidate_fields: [...config.candidate_fields, { ...target }],
    });
  };

  const allFieldOptions = [
    { id: 'chinese', label: '統測-國文' },
    { id: 'english', label: '統測-英文' },
    { id: 'interview', label: '面試' },
    { id: 'special_bonus', label: '加分比例' },
    { id: 'autobiography', label: '書審-自傳' },
    { id: 'study_plan', label: '書審-讀書計畫' },
    { id: 'transcript', label: '書審-歷年成績單' },
    { id: 'competition_or_certificate', label: '書審-競賽/證照' },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-slate-800">管理端設定 (Schema 驅動)</h3>
        <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-slate-100 text-slate-600">Admin Demo</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <label className="space-y-1">
          <span className="text-xs text-slate-500">最大志願數</span>
          <input
            type="number"
            min={1}
            value={config.max_limit}
            onChange={(event) => onChange({ ...config, max_limit: Number(event.target.value) || 1 })}
            className="w-full px-3 py-2 rounded-xl border border-slate-200"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs text-slate-500">一般生報名費</span>
          <input
            type="number"
            min={0}
            value={config.formula_variables.base_fee ?? 0}
            onChange={(event) =>
              onChange({
                ...config,
                formula_variables: {
                  ...config.formula_variables,
                  base_fee: Number(event.target.value) || 0,
                },
              })
            }
            className="w-full px-3 py-2 rounded-xl border border-slate-200"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs text-slate-500">特別生報名費</span>
          <input
            type="number"
            min={0}
            value={config.formula_variables.special_fee ?? config.formula_variables.base_fee ?? 0}
            onChange={(event) =>
              onChange({
                ...config,
                formula_variables: {
                  ...config.formula_variables,
                  special_fee: Number(event.target.value) || 0,
                },
              })
            }
            className="w-full px-3 py-2 rounded-xl border border-slate-200"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs text-slate-500">續填每系費用</span>
          <input
            type="number"
            min={0}
            value={config.formula_variables.extra_fee ?? 0}
            onChange={(event) =>
              onChange({
                ...config,
                formula_variables: {
                  ...config.formula_variables,
                  extra_fee: Number(event.target.value) || 0,
                },
              })
            }
            className="w-full px-3 py-2 rounded-xl border border-slate-200"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <label className="space-y-1">
          <span className="text-xs text-slate-500">報名開始時間</span>
          <input
            type="date"
            value={toInputDate(config.phases.registration.start)}
            onChange={(event) => updatePhase('registration', 'start', event.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-slate-500">報名結束時間</span>
          <input
            type="date"
            value={toInputDate(config.phases.registration.end)}
            onChange={(event) => updatePhase('registration', 'end', event.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <label className="space-y-1">
          <span className="text-xs text-slate-500">繳費開始時間</span>
          <input
            type="datetime-local"
            value={config.phases.payment.start.slice(0, 16)}
            onChange={(event) => updatePhase('payment', 'start', event.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-slate-500">繳費結束時間</span>
          <input
            type="datetime-local"
            value={config.phases.payment.end.slice(0, 16)}
            onChange={(event) => updatePhase('payment', 'end', event.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <label className="space-y-1">
          <span className="text-xs text-slate-500">放榜開始時間</span>
          <input
            type="datetime-local"
            value={config.phases.announcement.start.slice(0, 16)}
            onChange={(event) => updatePhase('announcement', 'start', event.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-slate-500">放榜結束時間</span>
          <input
            type="datetime-local"
            value={config.phases.announcement.end.slice(0, 16)}
            onChange={(event) => updatePhase('announcement', 'end', event.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200"
          />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-700">動態欄位勾選</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {allFieldOptions.map((option) => {
            const checked = config.candidate_fields.some((field) => field.id === option.id);
            return (
              <label key={option.id} className="flex items-center gap-2 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => toggleField(option.id, event.target.checked)}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">成績計算規則</p>
          <input
            type="text"
            value={config.score_formula}
            onChange={(event) => onChange({ ...config, score_formula: event.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-200"
          />
          <p className={scoreSyntax.ok ? 'text-xs text-green-600' : 'text-xs text-red-600'}>
            {scoreSyntax.ok ? '規則格式正確' : `格式錯誤：${scoreSyntax.error}`}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">報名費設定</p>
          <input
            type="text"
            value={config.fee_formula}
            onChange={(event) => onChange({ ...config, fee_formula: event.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-200"
          />
          <p className={feeSyntax.ok ? 'text-xs text-green-600' : 'text-xs text-red-600'}>
            {feeSyntax.ok ? '規則格式正確' : `格式錯誤：${feeSyntax.error}`}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-700">各系名額設定</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
          {config.departments.map((department) => (
            <label key={department.id} className="flex items-center justify-between gap-3 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <span className="font-medium text-slate-700 truncate">{department.name}</span>
              <input
                type="number"
                min={0}
                value={department.quota ?? 0}
                onChange={(event) => {
                  const nextQuota = Number(event.target.value) || 0;
                  onChange({
                    ...config,
                    departments: config.departments.map((item) =>
                      item.id === department.id ? { ...item, quota: nextQuota } : item
                    ),
                  });
                }}
                className="w-20 px-2 py-1 rounded-lg border border-slate-200"
              />
            </label>
          ))}
        </div>
      </div>
      <div className="pt-4">
        <button
          type="button"
          onClick={() => {
            try {
              // persist to localStorage
              localStorage.setItem('admission-channel-config', JSON.stringify(config));
              // notify parent via onChange if provided
              if (onChange) onChange(config);
              // show temporary visual feedback
              const btn = document.getElementById('save-config-btn');
              if (btn) {
                btn.classList.add('bg-green-600');
                setTimeout(() => btn.classList.remove('bg-green-600'), 1200);
              }
              // simple toast
              const toast = document.createElement('div');
              toast.textContent = '已成功儲存招生設定！';
              toast.className = 'fixed bottom-6 right-6 z-50 rounded-md bg-[#111827] text-white px-4 py-2 text-sm shadow-lg';
              document.body.appendChild(toast);
              setTimeout(() => {
                toast.classList.add('opacity-0');
                setTimeout(() => toast.remove(), 400);
              }, 1200);
            } catch (e) {
              // ignore
            }
          }}
          id="save-config-btn"
          className="inline-flex items-center gap-2 rounded-2xl bg-[#2e1065] px-5 py-3.5 text-sm font-bold text-white shadow-lg hover:opacity-95"
        >
          儲存設定
        </button>
      </div>
    </div>
  );
}
