import React, { useState, useRef } from 'react';
import type { DocumentRequirement } from '../types';
import { Upload, FileText, CheckCircle, AlertCircle, Eye, Trash2, Clock } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function validateUpload(file: File, document: DocumentRequirement): string | null {
  if (file.size === 0) {
    return '檔案內容是空的，請選擇有效檔案。';
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return '檔案超過 10MB 限制，請壓縮後重新上傳。';
  }

  const extension = file.name.split('.').pop()?.toUpperCase() ?? '';
  const acceptedFormats = document.format.map((value) => value.replace(/^\./, '').toUpperCase());
  if (!acceptedFormats.includes(extension)) {
    return `檔案格式不符，請上傳 ${document.format.join('、')} 格式。`;
  }

  return null;
}

interface DocumentUploadProps {
  documents: DocumentRequirement[];
  onUpload: (id: string, file: File) => void;
  onRemove: (id: string) => void;
  isLocked?: boolean;
}

export default function DocumentUpload({ documents, onUpload, onRemove, isLocked = false }: DocumentUploadProps) {
  const [dragActive, setDragActive] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleDrag = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLocked) return;
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(id);
    } else if (e.type === "dragleave") {
      setDragActive(null);
    }
  };

  const handleDrop = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(null);
    if (isLocked) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      if (e.dataTransfer.files.length > 1) {
        setUploadErrors((previous) => ({ ...previous, [id]: '請一次拖曳一個檔案。' }));
        return;
      }
      simulateUpload(id, e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    e.preventDefault();
    if (isLocked) return;
    if (e.target.files && e.target.files[0]) {
      simulateUpload(id, e.target.files[0]);
      e.target.value = '';
    }
  };

  const simulateUpload = (id: string, file: File) => {
    if (isLocked) return;

    const document = documents.find((item) => item.id === id);
    if (!document) return;

    const validationError = validateUpload(file, document);
    if (validationError) {
      setUploadErrors((previous) => ({ ...previous, [id]: validationError }));
      return;
    }

    setUploadErrors((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
    setUploading(id);
    setProgress(0);
    let nextProgress = 0;
    const interval = setInterval(() => {
      nextProgress = Math.min(nextProgress + 10, 100);
      setProgress(nextProgress);

      if (nextProgress === 100) {
        clearInterval(interval);
        setUploading(null);
        onUpload(id, file);
      }
    }, 100);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 border-l-4 border-indigo-bloom pl-4">
          第三步：書審資料上傳
        </h2>

        <div className="mb-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          檔案上傳後會先暫存，請完成繳費以確認上傳。
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className={cn(
                "group relative p-5 sm:p-6 rounded-2xl border-2 transition-all duration-300",
                doc.status === 'uploaded'
                  ? "border-green-100 bg-green-50/30"
                  : doc.status === 'pending_payment'
                  ? "border-amber-100 bg-amber-50/30"
                  : dragActive === doc.id
                  ? "border-indigo-bloom border-dashed bg-indigo-50/50"
                  : "border-slate-100 bg-slate-50/50 hover:border-slate-200"
              )}
              onDragEnter={(e) => handleDrag(e, doc.id)}
              onDragLeave={(e) => handleDrag(e, doc.id)}
              onDragOver={(e) => handleDrag(e, doc.id)}
              onDrop={(e) => handleDrop(e, doc.id)}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                    doc.status === 'uploaded'
                      ? "bg-green-500 text-white"
                      : doc.status === 'pending_payment'
                      ? "bg-amber-100 text-amber-700"
                      : "bg-white text-slate-400"
                  )}>
                    <FileText size={24} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800">{doc.name}</h3>
                      {doc.isRequired ? (
                        <span className="px-2 py-0.5 bg-red-100 text-dark-amethyst text-[10px] font-bold rounded-full uppercase tracking-wider">必繳</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full uppercase tracking-wider">選繳</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      格式要求：{doc.format.join(', ')} (最大 10MB)
                    </p>
                    {uploadErrors[doc.id] && (
                      <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-rose-700">
                        <AlertCircle size={14} className="mt-0.5 shrink-0" />
                        <span>{uploadErrors[doc.id]}</span>
                      </p>
                    )}
                    {doc.status === 'uploaded' && (
                      <div className="flex items-center gap-3 mt-2">
                        <span className="flex items-center gap-1 text-[11px] text-green-600 font-medium">
                          <CheckCircle size={12} /> 已上傳：{doc.fileName}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Clock size={12} /> {doc.lastUploaded}
                        </span>
                      </div>
                    )}
                    {doc.status === 'pending_payment' && (
                      <div className="flex items-center gap-2 mt-2 text-[11px] font-semibold text-amber-700">
                        <Clock size={12} /> 檔案已暫存，請完成繳費以確認上傳
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-center">
                  {doc.status === 'missing' ? (
                    <div className="relative">
                      <input
                        type="file"
                        disabled={isLocked}
                        className="hidden"
                        ref={(element) => {
                          fileInputRefs.current[doc.id] = element;
                        }}
                        accept={doc.format.map(f => `.${f.toLowerCase()}`).join(',')}
                        onChange={(e) => handleChange(e, doc.id)}
                      />
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => fileInputRefs.current[doc.id]?.click()}
                        className="flex min-h-11 items-center gap-2 px-6 py-3 bg-indigo-bloom text-white rounded-xl text-sm font-bold hover:bg-indigo-bloom/90 transition-all"
                      >
                        <Upload size={18} /> 點擊選取檔案
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          if (doc.previewUrl) {
                            window.open(doc.previewUrl, '_blank', 'noopener,noreferrer');
                          }
                        }}
                        className="flex min-h-11 items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 hover:border-indigo-bloom/30 transition-all"
                      >
                        <Eye size={16} /> 預覽
                      </button>
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => onRemove(doc.id)}
                        className="min-h-11 min-w-11 p-2 text-slate-400 hover:text-dark-amethyst hover:bg-indigo-50 rounded-xl transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {(doc.status === 'uploaded' || doc.status === 'pending_payment') && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                  {doc.fileType?.startsWith('image/') && doc.previewUrl ? (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">文件預覽</p>
                      <img
                        src={doc.previewUrl}
                        alt={`${doc.name} 預覽`}
                        className="h-40 w-full rounded-lg object-contain bg-slate-50"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-50 text-red-500 flex items-center justify-center">
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-700">PDF 檔案</p>
                        <p className="text-[11px] text-slate-500 truncate">{doc.fileName}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {uploading === doc.id && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-8 z-10">
                  <div className="w-full max-w-xs space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-indigo-bloom">
                      <span>檔案上傳中...</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-bloom transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-100">
          <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
            <AlertCircle size={16} className="text-indigo-bloom" /> 上傳注意事項
          </h4>
          <ul className="text-xs text-slate-500 space-y-2 list-disc pl-4">
            <li>所有必繳文件皆須完成繳費後，才會正式顯示為上傳完成。</li>
            <li>單一檔案大小限制為 10MB，若超過請進行壓縮。</li>
            <li>建議使用 Chrome 或 Edge 瀏覽器進行上傳，以獲得最佳相容性。</li>
            <li>上傳後請務必點擊「預覽」確認內容清晰且無誤。</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
