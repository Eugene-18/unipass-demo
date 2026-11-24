import React, { useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { CheckCircle2, FileText, MapPin, User, Download, ArrowRight, ReceiptText, Clock3 } from 'lucide-react';
import type { Department, StudentInfo } from '../types';

export interface FinalConfirmationPdfData {
  registrationEmail: string;
  departmentLabel: string;
  paymentAmount: number;
  paymentStatus: '待付款' | '已付款' | '已取消';
  registrationId: string;
  registrationTime: string;
}

interface FinalConfirmationProps {
  studentInfo: StudentInfo;
  selectedDepartments: Department[];
  paymentAmount: number;
  paymentStatus: '待付款' | '已付款' | '已取消';
  registrationId: string;
  registrationTime: string;
  isPaymentComplete: boolean;
  canSubmit: boolean;
  onConfirm?: () => void;
  isSubmitted?: boolean;
  onReturnHome?: () => void;
}

function formatDepartmentLabel(selectedDepartments: Department[]) {
  if (selectedDepartments.length === 0) return '未選擇';
  return selectedDepartments.map((department) => `${department.name} (${department.code})`).join('、');
}

function formatRegistrationId(rawId: string) {
  return rawId.trim() || '未產生';
}

function getPdfStatusLabel(status: FinalConfirmationProps['paymentStatus']) {
  return status;
}

export default function FinalConfirmation({
  studentInfo,
  selectedDepartments,
  paymentAmount,
  paymentStatus,
  registrationId,
  registrationTime,
  isPaymentComplete,
  canSubmit,
  onConfirm,
  isSubmitted,
  onReturnHome,
}: FinalConfirmationProps) {
  const pdfTemplateRef = useRef<HTMLDivElement | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const departmentLabel = useMemo(
    () => formatDepartmentLabel(selectedDepartments),
    [selectedDepartments]
  );

  const pdfData: FinalConfirmationPdfData = {
    registrationEmail: studentInfo.email || '未填寫',
    departmentLabel,
    paymentAmount,
    paymentStatus,
    registrationId: formatRegistrationId(registrationId || '未產生'),
    registrationTime: registrationTime || '未提供',
  };

  const handleDownloadPDF = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    console.log('[FinalConfirmation] download button clicked');

    if (isGeneratingPdf) {
      console.log('[FinalConfirmation] PDF generation already in progress');
      return;
    }

    try {
      setIsGeneratingPdf(true);
      console.log('[FinalConfirmation] waiting for DOM paint');
      await new Promise((resolve) => setTimeout(resolve, 300));

      const templateElement = pdfTemplateRef.current ?? document.getElementById('pdf-template');
      console.log('[FinalConfirmation] templateElement:', templateElement);
      if (!templateElement || !(templateElement instanceof HTMLElement)) {
        console.error('[FinalConfirmation] 找不到 pdf-template 元素');
        return;
      }

      console.log('[FinalConfirmation] calling html-to-image');
      const imageDataUrl = await toPng(templateElement, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });

      const templateRect = templateElement.getBoundingClientRect();
      const pageWidth = 210;
      const imageWidth = pageWidth;
      const imageHeight = (templateRect.height * imageWidth) / templateRect.width;
      const finalHeight = Math.min(imageHeight, 297);

      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      pdf.addImage(imageDataUrl, 'PNG', 0, 0, imageWidth, finalHeight, undefined, 'FAST');
      console.log('[FinalConfirmation] saving PDF file');
      pdf.save(`報名確認表_${pdfData.registrationId}.pdf`);
      console.log('[FinalConfirmation] PDF 已成功下載');
    } catch (error) {
      console.error('[FinalConfirmation] PDF 生成失敗', error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <>
      {isSubmitted ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
            🔒 報名資料已鎖定（唯讀），無法再進行修改或補件
          </div>
          <div className="bg-white p-8 rounded-2xl border border-slate-200">
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 mx-auto">
                <CheckCircle2 size={30} />
              </div>
              <h2 className="text-3xl font-bold text-slate-900">報名成功！</h2>
              <p className="text-slate-500 max-w-2xl mx-auto">
                您的報名資料已成功送出，系統已生成報名確認表 PDF。
                請點選下方按鈕下載並妥善保存。
              </p>
            </div>

            <div className="mt-10 grid gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50">
                  <p className="text-xs text-slate-500">報名序號</p>
                  <p className="mt-2 text-lg font-bold text-slate-900 break-all">{pdfData.registrationId}</p>
                </div>
                <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50">
                  <p className="text-xs text-slate-500">報名時間</p>
                  <p className="mt-2 text-lg font-bold text-slate-900">{pdfData.registrationTime}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50">
                  <p className="text-xs text-slate-500">繳費狀態</p>
                  <p className="mt-2 text-lg font-bold text-slate-900">{pdfData.paymentStatus}</p>
                </div>
                <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50">
                  <p className="text-xs text-slate-500">應繳金額</p>
                  <p className="mt-2 text-lg font-bold text-slate-900">NT$ {paymentAmount.toLocaleString()}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 items-center">
                <button
                  type="button"
                  disabled={!isPaymentComplete || isGeneratingPdf}
                  onClick={handleDownloadPDF}
                  className={isPaymentComplete && !isGeneratingPdf ? 'flex items-center gap-3 px-10 py-4 rounded-2xl text-lg font-bold transition-all duration-300 bg-indigo-bloom text-white hover:bg-indigo-600 hover:scale-105 active:scale-95' : 'flex items-center gap-3 px-10 py-4 rounded-2xl text-lg font-bold transition-all duration-300 bg-slate-200 text-slate-500 cursor-not-allowed'}
                >
                  <Download size={18} /> {isGeneratingPdf ? '產生 PDF 中...' : '下載報名確認表 PDF'}
                </button>

                {onReturnHome && (
                  <button
                    type="button"
                    onClick={onReturnHome}
                    className="px-8 py-3 rounded-2xl font-bold bg-slate-100 text-slate-900 hover:bg-slate-200 transition-all"
                  >
                    返回登入頁
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-8 rounded-2xl border border-slate-200">
            <h2 className="text-2xl font-bold text-slate-800 mb-8 border-l-4 border-indigo-bloom pl-4">
              第五步：最終確認與送出
            </h2>

            <div className={isPaymentComplete ? 'mb-8 rounded-2xl border px-4 py-3 text-sm font-semibold border-green-100 bg-green-50 text-green-700' : 'mb-8 rounded-2xl border px-4 py-3 text-sm font-semibold border-amber-100 bg-amber-50 text-amber-700'}>
              {isPaymentComplete ? '繳費已完成，現在可以送出最終報名資料。' : '尚未完成繳費，請回到繳費步驟完成後再送出。'}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-wider">
                  <User size={16} /> 基本資料
                </h3>
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                    <span className="text-sm text-slate-500">報名信箱</span>
                    <span className="font-bold text-indigo-bloom break-all text-right">{pdfData.registrationEmail}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                    <span className="text-sm text-slate-500">報考科系</span>
                    <span className="font-bold text-slate-800 text-right">{pdfData.departmentLabel}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                    <span className="text-sm text-slate-500">報名時間 / 序號</span>
                    <span className="font-bold text-slate-800 text-right">{pdfData.registrationTime} / {pdfData.registrationId}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">報名姓名</span>
                    <span className="font-bold text-slate-800 text-right">{studentInfo.name || '未填寫'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-wider">
                  <MapPin size={16} /> 志願序
                </h3>
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-3">
                  {selectedDepartments.length > 0 ? (
                    selectedDepartments.map((dept, index) => (
                      <div key={dept.id} className="flex items-center gap-4 p-3 bg-white rounded-xl border border-slate-200">
                        <div className="w-6 h-6 rounded-full bg-indigo-bloom text-white flex items-center justify-center text-xs font-bold shrink-0">
                          {index + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-800">{dept.name}</h4>
                            <span className={dept.campus === '台北校區' ? 'text-[9px] px-1.5 py-0.5 rounded-md font-bold bg-blue-50 text-blue-600' : 'text-[9px] px-1.5 py-0.5 rounded-md font-bold bg-orange-50 text-orange-600'}>
                              {dept.campus}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500">{dept.code}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-slate-400 py-4 italic">尚未選擇志願</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-wider">
                <FileText size={16} /> 書審資料狀態
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border flex items-center justify-between bg-green-50 border-green-100 text-green-700">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold truncate max-w-[120px]">報名確認表</span>
                    <span className="text-[10px] opacity-70">已可下載</span>
                  </div>
                  <CheckCircle2 size={18} className="text-green-500" />
                </div>
                <div className="p-4 rounded-xl border flex items-center justify-between bg-slate-50 border-slate-200 text-slate-700">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold truncate max-w-[120px]">繳費狀態</span>
                    <span className="text-[10px] opacity-70">{getPdfStatusLabel(paymentStatus)}</span>
                  </div>
                  <ReceiptText size={18} className="text-slate-500" />
                </div>
                <div className="p-4 rounded-xl border flex items-center justify-between bg-slate-50 border-slate-200 text-slate-700">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold truncate max-w-[120px]">繳費金額</span>
                    <span className="text-[10px] opacity-70">NT$ {paymentAmount.toLocaleString()}</span>
                  </div>
                  <Download size={18} className="text-slate-500" />
                </div>
                <div className="p-4 rounded-xl border flex items-center justify-between bg-slate-50 border-slate-200 text-slate-700">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold truncate max-w-[120px]">報名時間</span>
                    <span className="text-[10px] opacity-70">{registrationTime}</span>
                  </div>
                  <Clock3 size={18} className="text-slate-500" />
                </div>
              </div>
            </div>

            <div className="mt-12 p-8 bg-indigo-bloom rounded-3xl text-white flex flex-col items-center text-center gap-6">
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">確認送出報名資料？</h3>
                <p className="text-indigo-100 text-sm max-w-md">
                  送出後將無法再進行修改。系統將自動產生報名確認表 PDF，請下載並妥善保存。
                </p>
              </div>

              <button
                disabled={!canSubmit}
                onClick={onConfirm}
                className={canSubmit ? 'group flex items-center gap-3 px-10 py-4 rounded-2xl text-lg font-bold transition-all duration-300 bg-white text-indigo-bloom hover:bg-indigo-50 hover:scale-105 active:scale-95' : 'group flex items-center gap-3 px-10 py-4 rounded-2xl text-lg font-bold transition-all duration-300 bg-white/20 text-white/50 cursor-not-allowed'}
              >
                確認送出報名 <ArrowRight className="group-hover:translate-x-1 transition-transform" />
              </button>

              {!isPaymentComplete && (
                <p className="text-xs text-amber-100 font-medium">
                  * 需先完成繳費，才能進入送出作業。
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 黃金 A4 排版樣板 (794px * 1123px 標準尺寸 + border-box 防超界) */}
      {/* ========================================================= */}
      <div
        id="pdf-template"
        ref={pdfTemplateRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '794px',
          minHeight: '1123px',
          padding: '50px 50px',
          boxSizing: 'border-box',
          backgroundColor: '#ffffff',
          color: '#1a1a1a',
          fontFamily: '"Microsoft JhengHei", "PingFang TC", sans-serif',
          zIndex: -1000,
          pointerEvents: 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '3px solid #1a1a1a', paddingBottom: '16px', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1a1a1a', margin: '0 0 6px 0', letterSpacing: '1px' }}>
              報名確認表
            </h1>
            <p style={{ fontSize: '13px', color: '#555555', margin: 0 }}>
              Registration Confirmation Sheet
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1a1a1a', marginBottom: '4px' }}>
              國立臺北商業大學
            </div>
            <div style={{ fontSize: '12px', color: '#555555' }}>
              National Taipei University of Business
            </div>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px', lineHeight: '1.6', marginBottom: '30px' }}>
          <tbody>
            <tr>
              <th style={{ border: '1px solid #cccccc', padding: '14px 16px', backgroundColor: '#f8f9fa', width: '28%', textAlign: 'left', color: '#444444', fontWeight: 'bold' }}>
                報名信箱
              </th>
              <td style={{ border: '1px solid #cccccc', padding: '14px 16px', color: '#1a1a1a', wordBreak: 'break-all' }}>
                {pdfData.registrationEmail}
              </td>
            </tr>
            <tr>
              <th style={{ border: '1px solid #cccccc', padding: '14px 16px', backgroundColor: '#f8f9fa', textAlign: 'left', color: '#444444', fontWeight: 'bold' }}>
                報考科系 <span style={{ display: 'block', fontSize: '12px', color: '#666666', fontWeight: 'normal' }}>(Department / Major)</span>
              </th>
              <td style={{ border: '1px solid #cccccc', padding: '14px 16px', color: '#1a1a1a', fontWeight: 'bold', fontSize: '16px' }}>
                {pdfData.departmentLabel}
              </td>
            </tr>
            <tr>
              <th style={{ border: '1px solid #cccccc', padding: '14px 16px', backgroundColor: '#f8f9fa', textAlign: 'left', color: '#444444', fontWeight: 'bold' }}>
                應繳費金額 <span style={{ display: 'block', fontSize: '12px', color: '#666666', fontWeight: 'normal' }}>(Payment Amount)</span>
              </th>
              <td style={{ border: '1px solid #cccccc', padding: '14px 16px', color: '#1a1a1a', fontWeight: 'bold', fontSize: '16px' }}>
                NT$ {pdfData.paymentAmount.toLocaleString()}
              </td>
            </tr>
            <tr>
              <th style={{ border: '1px solid #cccccc', padding: '14px 16px', backgroundColor: '#f8f9fa', textAlign: 'left', color: '#444444', fontWeight: 'bold' }}>
                繳費狀態
              </th>
              <td style={{ border: '1px solid #cccccc', padding: '14px 16px', fontWeight: 'bold', color: pdfData.paymentStatus === '已付款' ? '#15803d' : pdfData.paymentStatus === '待付款' ? '#b45309' : '#b91c1c' }}>
                {pdfData.paymentStatus}
              </td>
            </tr>
            <tr>
              <th style={{ border: '1px solid #cccccc', padding: '14px 16px', backgroundColor: '#f8f9fa', textAlign: 'left', color: '#444444', fontWeight: 'bold' }}>
                報名序號與時間 <span style={{ display: 'block', fontSize: '12px', color: '#666666', fontWeight: 'normal' }}>(Registration ID / Time)</span>
              </th>
              <td style={{ border: '1px solid #cccccc', padding: '14px 16px', color: '#1a1a1a', fontSize: '14px' }}>
                {pdfData.registrationTime} / {pdfData.registrationId}
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ display: 'flex', gap: '20px', marginBottom: '40px', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ flex: 1, border: '1px solid #e2e8f0', padding: '16px', borderRadius: '6px', backgroundColor: '#f8fafc', boxSizing: 'border-box' }}>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>下載時間</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#334155' }}>
              {new Date().toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>
          <div style={{ flex: 1, border: '1px solid #e2e8f0', padding: '16px', borderRadius: '6px', backgroundColor: '#f8fafc', boxSizing: 'border-box' }}>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>送出狀態</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#15803d' }}>已可送出</div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', fontSize: '12px', color: '#64748b', lineHeight: '1.8' }}>
          <p style={{ margin: '0 0 4px 0' }}>※ 本確認表僅供報名流程核對與留存使用，請妥善保存。</p>
          <p style={{ margin: 0 }}>※ 如繳費狀態為「待付款」，請依系統指定帳號與期限內完成繳費，逾期系統將自動取消報名資格。</p>
        </div>
      </div>
    </>
  );
}
