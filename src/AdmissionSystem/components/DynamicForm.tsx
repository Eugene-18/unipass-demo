import React from 'react';
import type { CandidateFieldConfig } from '../types';

interface DynamicFormProps {
  fields: CandidateFieldConfig[];
  values: Record<string, unknown>;
  errors: Record<string, string>;
  onChange: (fieldId: string, value: unknown) => void;
}

type FieldRendererProps = {
  field: CandidateFieldConfig;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
};

function NumberField({ field, value, error, onChange }: FieldRendererProps) {
  return (
    <input
      id={field.id}
      type="number"
      min={field.min}
      max={field.max}
      step={field.step ?? 1}
      value={typeof value === 'number' || typeof value === 'string' ? value : ''}
      onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))}
      placeholder={field.placeholder}
      required={field.required}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${field.id}-error` : undefined}
      className={`w-full px-4 py-3 rounded-xl border outline-none transition-all focus:ring-indigo-bloom/20 focus:border-indigo-bloom ${error ? 'border-red-500' : 'border-slate-200'}`}
    />
  );
}

function TextField({ field, value, error, onChange }: FieldRendererProps) {
  return (
    <input
      id={field.id}
      type="text"
      value={typeof value === 'string' ? value : ''}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.placeholder}
      required={field.required}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${field.id}-error` : undefined}
      className={`w-full px-4 py-3 rounded-xl border outline-none transition-all focus:ring-indigo-bloom/20 focus:border-indigo-bloom ${error ? 'border-red-500' : 'border-slate-200'}`}
    />
  );
}

function DocumentField({ field, value, error, onChange }: FieldRendererProps) {
  const fileName = value instanceof File ? value.name : '尚未上傳';

  return (
    <div className="space-y-2">
      <input
        id={field.id}
        type="file"
        accept={field.accept?.map((ext) => `.${ext.toLowerCase()}`).join(',')}
        required={field.required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${field.id}-error` : undefined}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onChange(file);
        }}
        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:border-0 file:rounded-lg file:bg-indigo-bloom file:text-white file:font-semibold hover:file:bg-indigo-bloom/90"
      />
      <p className="text-xs text-slate-500">目前檔案：{fileName}</p>
    </div>
  );
}

const ComponentMap: Record<CandidateFieldConfig['type'], React.FC<FieldRendererProps>> = {
  score: NumberField,
  number: NumberField,
  text: TextField,
  document: DocumentField,
};

export default function DynamicForm({ fields, values, errors, onChange }: DynamicFormProps) {
  return (
    <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 space-y-6">
      <h3 className="text-xl font-bold text-slate-800 border-l-4 border-indigo-bloom pl-4">成績填寫</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        {fields.map((field) => {
          const Renderer = ComponentMap[field.type];
          const value = values[field.id];
          const error = errors[field.id];

          return (
            <div key={field.id} className="space-y-2">
              <label htmlFor={field.id} className="inline-flex items-baseline gap-1 text-base font-semibold text-slate-800">
                {field.label}
                {field.required && <span className="text-red-500" aria-hidden="true">*</span>}
              </label>
              <Renderer field={field} value={value} error={error} onChange={(nextValue) => onChange(field.id, nextValue)} />
              {error && <p id={`${field.id}-error`} className="text-xs font-medium text-red-500">{error}</p>}
              {field.helpText && <p className="text-sm leading-6 text-slate-600">{field.helpText}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
