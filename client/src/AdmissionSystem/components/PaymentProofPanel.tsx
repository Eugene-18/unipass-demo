import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import type { AdmissionApplication } from '../types';
import { secureFetch } from '../lib/security';

interface Props {
  application: AdmissionApplication;
  currentUserName: string;
  onChange: (next: AdmissionApplication) => void;
}

export default function PaymentProofPanel({ application, currentUserName, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = (file?: File) => {
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const url = String(reader.result);
      try {
        const resp = await secureFetch(`/api/applications/${encodeURIComponent(application.id)}/payment-proof`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl: url, fileName: file.name }),
        });
        if (!resp.ok) throw new Error('upload failed');
        const json = await resp.json();
        setUploading(false);
        onChange(json);
      } catch (e) {
        setUploading(false);
        console.error(e);
        // fallback to local-only behaviour
        const proof = {
          id: `${Date.now()}`,
          url,
          fileName: file.name,
          uploadedAt: new Date().toISOString(),
          verified: false,
        };
        const next: any = { ...application, paymentProof: [...(application.paymentProof || []), proof] };
        onChange(next);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeProof = (id: string) => {
    (async () => {
      try {
        const resp = await secureFetch(`/api/applications/${encodeURIComponent(application.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentProof: (application.paymentProof || []).filter((p) => p.id !== id) }),
        });
        if (resp.ok) {
          const json = await resp.json();
          onChange(json);
          return;
        }
      } catch (e) {
        console.error(e);
      }
      const next = { ...application, paymentProof: (application.paymentProof || []).filter((p) => p.id !== id) };
      onChange(next as AdmissionApplication);
    })();
  };

  const toggleVerify = (id: string) => {
    (async () => {
      const nextProof = (application.paymentProof || []).map((p) =>
        p.id === id ? { ...p, verified: !p.verified, verifiedBy: !p.verified ? currentUserName : p.verifiedBy, verifiedAt: !p.verified ? new Date().toISOString() : p.verifiedAt } : p
      );
      try {
        const resp = await secureFetch(`/api/applications/${encodeURIComponent(application.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentProof: nextProof }),
        });
        if (resp.ok) {
          const json = await resp.json();
          onChange(json);
          return;
        }
      } catch (e) {
        console.error(e);
      }

      const next = { ...application, paymentProof: nextProof };
      onChange(next as AdmissionApplication);
    })();
  };

  const updateExamNumber = (value: string) => {
    (async () => {
      try {
        const resp = await secureFetch(`/api/applications/${encodeURIComponent(application.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ examNumber: value || null }),
        });
        if (resp.ok) {
          const json = await resp.json();
          onChange(json);
          return;
        }
      } catch (e) {
        console.error(e);
      }
      const next = { ...application, examNumber: value || null } as AdmissionApplication;
      onChange(next);
    })();
  };

  return (
    <div className="rounded-[2rem] border border-white bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-slate-900">繳費證明</h3>
        <div className="text-sm text-slate-500">可上傳 JPG/PNG，支援多張</div>
      </div>

      <div className="mt-4 grid gap-4">
        <div className="flex items-center gap-3">
          <input
            ref={(el) => {
              fileRef.current = el;
            }}
            className="hidden"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.currentTarget.value = '';
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white"
          >
            <Upload size={16} /> 上傳繳費證明
          </button>
          {uploading && <div className="text-sm text-slate-500">上傳中…</div>}
        </div>

        <div className="grid gap-3">
          {(application.paymentProof || []).length === 0 ? (
            <div className="text-sm text-slate-500">尚無繳費證明。</div>
          ) : (
            (application.paymentProof || []).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
                <div className="flex items-center gap-3">
                  <img src={p.url} alt={p.fileName} className="h-20 w-28 rounded-md object-contain bg-slate-50" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-800 truncate">{p.fileName}</div>
                    <div className="text-xs text-slate-500">{new Date(p.uploadedAt).toLocaleString()}</div>
                    <div className="text-xs mt-1">狀態: {p.verified ? '已核實' : '未核實'}</div>
                    {p.verified && <div className="text-xs text-slate-400">核驗人：{p.verifiedBy} · {p.verifiedAt ? new Date(p.verifiedAt).toLocaleString() : ''}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => window.open(p.url, '_blank', 'noopener,noreferrer')} className="px-3 py-2 rounded-lg bg-white border text-sm">預覽</button>
                  <button onClick={() => toggleVerify(p.id)} className="px-3 py-2 rounded-lg bg-green-50 border text-sm">{p.verified ? '取消核實' : '標記已核實'}</button>
                  <button onClick={() => removeProof(p.id)} className="px-3 py-2 rounded-lg bg-rose-50 border text-sm">刪除</button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-2">
          <label className="block text-xs font-bold text-slate-500">准考證號 (審查端可輸入)</label>
          <input
            value={application.examNumber || ''}
            onChange={(e) => updateExamNumber(e.target.value)}
            placeholder="輸入准考證號後按 Enter 或離開"
            onBlur={(e) => updateExamNumber(e.target.value)}
            className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
          />
        </div>
      </div>
    </div>
  );
}
