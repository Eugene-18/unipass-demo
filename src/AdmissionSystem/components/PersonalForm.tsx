import React from 'react';
import { ADMISSION_TYPES, type StudentInfo } from '../types';
import { validateStudentInfo, type StudentInfoField } from '../lib/studentInfoValidation';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PersonalFormProps {
  data: StudentInfo;
  onChange: (data: StudentInfo) => void;
  showErrors: boolean;
}

export default function PersonalForm({ data, onChange, showErrors }: PersonalFormProps) {
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const validationErrors = validateStudentInfo(data);
  const getError = (name: StudentInfoField) => showErrors ? validationErrors[name] : errors[name];

  const phoneSuffix = React.useMemo(() => {
    if (!data.phone) return '';
    if (data.phone.startsWith('+886')) return data.phone.slice(4);
    return data.phone.replace(/\D/g, '');
  }, [data.phone]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const nextValue = name === 'phone' ? value.replace(/\D/g, '').slice(0, 10) : value;
    const nextData = {
      ...data,
      [name]: name === 'phone' ? `+886${nextValue}` : value,
    };
    const error = validateStudentInfo(nextData)[name as StudentInfoField];
    setErrors(prev => ({ ...prev, [name]: error }));
    onChange(nextData);
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200">
        <h2 className="text-2xl font-bold text-slate-800 mb-5 border-l-4 border-indigo-bloom pl-4">
          第一步：個人基本資料確認
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          <div className="space-y-2 col-span-full">
            <label htmlFor="admissionType" className="inline-flex items-baseline gap-1 text-sm font-semibold text-slate-600">
              報考學制<span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <select
              id="admissionType"
              name="admissionType"
              value={data.admissionType}
              onChange={handleChange}
              required
              aria-invalid={Boolean(getError('admissionType'))}
              aria-describedby={getError('admissionType') ? 'admissionType-error' : undefined}
              className={cn(
                "w-full px-4 py-3 rounded-xl border outline-none transition-all bg-white",
                getError('admissionType') ? "border-red-500 focus:ring-red-500/20" : "border-slate-200 focus:ring-indigo-bloom/20 focus:border-indigo-bloom"
              )}
            >
              <option value="">請選擇學制</option>
              {ADMISSION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            {getError('admissionType') && <p id="admissionType-error" className="text-xs text-red-500 font-medium">{getError('admissionType')}</p>}
          </div>
          <div className="space-y-2 col-span-full md:col-span-1">
            <label htmlFor="candidateIdentity" className="inline-flex items-baseline gap-1 text-sm font-semibold text-slate-600">
              考生身分<span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <select
              id="candidateIdentity"
              name="candidateIdentity"
              value={data.candidateIdentity}
              onChange={handleChange}
              required
              aria-invalid={Boolean(getError('candidateIdentity'))}
              aria-describedby={getError('candidateIdentity') ? 'candidateIdentity-error' : undefined}
              className={cn(
                "w-full px-4 py-3 rounded-xl border outline-none transition-all bg-white",
                getError('candidateIdentity') ? "border-red-500 focus:ring-red-500/20" : "border-slate-200 focus:ring-indigo-bloom/20 focus:border-indigo-bloom"
              )}
            >
              <option value="">請選擇考生身分</option>
              <option value="general">一般生</option>
              <option value="special">特別生</option>
            </select>
            {getError('candidateIdentity') && <p id="candidateIdentity-error" className="text-xs text-red-500 font-medium">{getError('candidateIdentity')}</p>}
          </div>
          <div className="space-y-2">
            <label htmlFor="name" className="inline-flex items-baseline gap-1 text-sm font-semibold text-slate-600">
              姓名<span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="name"
              type="text"
              name="name"
              value={data.name}
              onChange={handleChange}
              required
              aria-invalid={Boolean(getError('name'))}
              aria-describedby={getError('name') ? 'name-error' : undefined}
              placeholder="請輸入真實姓名"
              className={cn(
                "w-full px-4 py-3 rounded-xl border outline-none transition-all",
                getError('name') ? "border-red-500 focus:ring-red-500/20" : "border-slate-200 focus:ring-indigo-bloom/20 focus:border-indigo-bloom"
              )}
            />
            {getError('name') && <p id="name-error" className="text-xs text-red-500 font-medium">{getError('name')}</p>}
          </div>
          <div className="space-y-2">
            <label htmlFor="idNumber" className="inline-flex items-baseline gap-1 text-sm font-semibold text-slate-600">
              身分證字號<span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="idNumber"
              type="text"
              name="idNumber"
              value={data.idNumber}
              onChange={handleChange}
              required
              pattern="[A-Z][12][0-9]{8}"
              aria-invalid={Boolean(getError('idNumber'))}
              aria-describedby={getError('idNumber') ? 'idNumber-error' : undefined}
              placeholder="A123456789"
              className={cn(
                "w-full px-4 py-3 rounded-xl border outline-none transition-all",
                getError('idNumber') ? "border-red-500 focus:ring-red-500/20" : "border-slate-200 focus:ring-indigo-bloom/20 focus:border-indigo-bloom"
              )}
            />
            {getError('idNumber') && <p id="idNumber-error" className="text-xs text-red-500 font-medium">{getError('idNumber')}</p>}
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className="inline-flex items-baseline gap-1 text-sm font-semibold text-slate-600">
              電子郵件<span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="email"
              type="email"
              name="email"
              value={data.email}
              onChange={handleChange}
              required
              aria-invalid={Boolean(getError('email'))}
              aria-describedby={getError('email') ? 'email-error' : undefined}
              placeholder="example@email.com"
              className={cn(
                "w-full px-4 py-3 rounded-xl border outline-none transition-all",
                getError('email') ? "border-red-500 focus:ring-red-500/20" : "border-slate-200 focus:ring-indigo-bloom/20 focus:border-indigo-bloom"
              )}
            />
            {getError('email') && <p id="email-error" className="text-xs text-red-500 font-medium">{getError('email')}</p>}
          </div>
          <div className="space-y-2">
            <label htmlFor="phone" className="inline-flex items-baseline gap-1 text-sm font-semibold text-slate-600">
              聯絡電話<span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <div
              className={cn(
                "flex items-center w-full overflow-hidden rounded-xl border bg-white transition-all",
                getError('phone') ? "border-red-500 focus-within:ring-red-500/20" : "border-slate-200 focus-within:ring-indigo-bloom/20 focus-within:border-indigo-bloom"
              )}
            >
              <div className="flex items-center justify-center bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 border-r border-slate-200 min-w-[72px]">
                +886
              </div>
              <input
                id="phone"
                type="tel"
                name="phone"
                value={phoneSuffix}
                onChange={handleChange}
                inputMode="numeric"
                maxLength={10}
                required
                pattern="[0-9]{8,10}"
                aria-invalid={Boolean(getError('phone'))}
                aria-describedby={getError('phone') ? 'phone-error' : undefined}
                placeholder="912345678"
                className="w-full px-4 py-3 border-0 bg-transparent outline-none text-slate-700 placeholder:text-slate-400"
              />
            </div>
            {getError('phone') && <p id="phone-error" className="text-xs text-red-500 font-medium">{getError('phone')}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
