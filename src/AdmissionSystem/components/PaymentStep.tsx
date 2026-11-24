import React, { useRef } from 'react';
import type { Department, PaymentMethod, StudentInfo } from '../types';
import { CreditCard, Landmark, Smartphone, Store, ReceiptText, UploadCloud, Trash2, Eye } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PaymentSummary {
  baseFee: number;
  extraFee: number;
  discount: number;
  total: number;
  identityLabel: string;
}

interface PaymentProofFile {
  id: string;
  url: string;
  fileName: string;
  uploadedAt: string;
}

interface PaymentStepProps {
  studentInfo: StudentInfo;
  selectedDepartments: Department[];
  paymentMethod: PaymentMethod | null;
  paymentSummary: PaymentSummary;
  isPaymentComplete: boolean;
  paymentProofs: PaymentProofFile[];
  onPaymentProofChange: (proofs: PaymentProofFile[]) => void;
  onSelectPaymentMethod: (method: PaymentMethod) => void;
  onCompletePayment: () => void;
}

const paymentOptions: {
  id: PaymentMethod;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  { id: 'credit_card', label: '信用卡', description: 'Credit Card', icon: <CreditCard size={22} /> },
  { id: 'bank_transfer', label: '銀行轉帳/匯款', description: 'ATM / Bank', icon: <Landmark size={22} /> },
  { id: 'taiwan_pay', label: '台灣 Pay', description: 'Taiwan Pay', icon: <Smartphone size={22} /> },
  { id: 'cvs', label: '超商繳費', description: 'CVS', icon: <Store size={22} /> },
];

export default function PaymentStep({
  studentInfo,
  selectedDepartments,
  paymentMethod,
  paymentSummary,
  isPaymentComplete,
  paymentProofs,
  onPaymentProofChange,
  onSelectPaymentMethod,
  onCompletePayment,
}: PaymentStepProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleProofUpload = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || '');
      const nextProof: PaymentProofFile = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        fileName: file.name,
        url,
        uploadedAt: new Date().toISOString(),
      };
      onPaymentProofChange([nextProof]);
    };
    reader.readAsDataURL(file);
  };

  const removeProof = () => {
    onPaymentProofChange([]);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 border-l-4 border-indigo-bloom pl-4">
          第四步：繳費
        </h2>

        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">繳費資訊</p>
                  <h3 className="mt-1 text-xl font-bold text-slate-800">{studentInfo.name || '考生'}</h3>
                </div>
                <div className={cn('rounded-full px-3 py-1 text-xs font-bold', isPaymentComplete ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
                  {isPaymentComplete ? '已繳費' : '待繳費'}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                  <p className="text-slate-500 text-xs">考生身分</p>
                  <p className="mt-1 font-bold text-slate-800">{paymentSummary.identityLabel}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                  <p className="text-slate-500 text-xs">志願數</p>
                  <p className="mt-1 font-bold text-slate-800">{selectedDepartments.length} 個</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <p className="text-sm font-semibold text-slate-700">繳費管道</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {paymentOptions.map((option) => {
                    const isSelected = paymentMethod === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => onSelectPaymentMethod(option.id)}
                        className={cn(
                          'flex items-center gap-4 rounded-2xl border p-4 text-left transition-all min-h-20',
                          isSelected
                            ? 'border-indigo-bloom bg-indigo-50'
                            : 'border-slate-200 bg-white hover:border-indigo-bloom/30 hover:bg-slate-50'
                        )}
                      >
                        <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl', isSelected ? 'bg-indigo-bloom text-white' : 'bg-slate-100 text-indigo-bloom')}>
                          {option.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800">{option.label}</p>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{option.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-indigo-bloom/15 bg-white p-5">
              <div className="flex items-center gap-2 text-slate-800 font-bold">
                <ReceiptText size={18} className="text-indigo-bloom" /> 金額明細
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3">
                  <span className="text-slate-600">基本報名費</span>
                  <span className="font-bold text-slate-800">NT$ {paymentSummary.baseFee.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3">
                  <span className="text-slate-600">志願加選費</span>
                  <span className="font-bold text-slate-800">NT$ {paymentSummary.extraFee.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3">
                  <span className="text-slate-600">身分減免</span>
                  <span className="font-bold text-green-600">- NT$ {paymentSummary.discount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-2xl bg-indigo-bloom px-4 py-4 text-white">
                  <span className="text-sm font-semibold">最終金額</span>
                  <span className="text-2xl font-black">NT$ {paymentSummary.total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 text-slate-800 font-bold">
                <UploadCloud size={18} className="text-indigo-bloom" /> 繳費證明上傳
              </div>
              <p className="mt-2 text-sm text-slate-600">請上傳 JPG / PNG 繳費證明，僅支援圖片格式，系統會自動綁定到本次報名資料。</p>

              <div className="mt-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    handleProofUpload(file);
                    event.target.value = '';
                  }}
                />

                {!paymentProofs.length ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-200"
                  >
                    <UploadCloud size={16} /> 上傳繳費證明
                  </button>
                ) : (
                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <img src={paymentProofs[0].url} alt={paymentProofs[0].fileName} className="h-20 w-24 rounded-xl object-cover border border-slate-200 bg-white" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-800">{paymentProofs[0].fileName}</p>
                          <p className="text-xs text-slate-500">{new Date(paymentProofs[0].uploadedAt).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => window.open(paymentProofs[0].url, '_blank', 'noopener,noreferrer')}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700"
                        >
                          <Eye size={14} /> 預覽
                        </button>
                        <button
                          type="button"
                          onClick={removeProof}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-bold text-rose-700"
                        >
                          <Trash2 size={14} /> 刪除
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-bold text-indigo-bloom underline underline-offset-2"
                    >
                      重新上傳其他圖片
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-lg font-bold text-slate-800">繳費說明</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                請先選擇適合的繳費管道，再依照系統提示完成繳費。完成後按下確認鍵，系統會將第三步的暫存檔案正式標示為上傳完成。
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">應繳總額</p>
              <div className="mt-2 flex items-end gap-2">
                <span className={cn('text-4xl font-black', isPaymentComplete ? 'text-green-600' : 'text-indigo-bloom')}>
                  NT$ {paymentSummary.total.toLocaleString()}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {isPaymentComplete ? '已完成繳費，金額同步至左側側邊欄。' : '此金額會與左側側邊欄即時同步。'}
              </p>
              <button
                type="button"
                onClick={onCompletePayment}
                disabled={!paymentMethod || isPaymentComplete}
                className={cn(
                  'mt-5 w-full rounded-2xl px-5 py-3.5 text-sm font-bold transition-all',
                  !paymentMethod || isPaymentComplete
                    ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                    : 'bg-indigo-bloom text-white hover:bg-indigo-bloom/90 active:scale-[0.99]'
                )}
              >
                {isPaymentComplete ? '繳費已完成' : '確認完成繳費'}
              </button>
              {!paymentMethod && !isPaymentComplete && (
                <p className="mt-2 text-xs text-amber-600">請先選擇繳費管道。</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}