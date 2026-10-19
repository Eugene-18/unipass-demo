import { useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle, KeyRound, LoaderCircle, Mail, X } from 'lucide-react';
import { validatePassword } from '../utils/passwordPolicy';

type ForgotPasswordModalProps = {
  onClose: () => void;
};

type Step = 'email' | 'reset' | 'complete';

const API_URL = 'http://localhost:3000';

export default function ForgotPasswordModal({ onClose }: ForgotPasswordModalProps) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSendCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || '驗證碼寄送失敗，請稍後重試');
      }

      setStep('reset');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '網路連線錯誤，請稍後重試');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!/^\d{6}$/.test(code.trim())) {
      setError('請輸入信件中的 6 位數驗證碼');
      return;
    }
    const passwordError = validatePassword(newPassword, [email]);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/users/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim(), newPassword }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || '密碼更新失敗，請確認驗證碼後重試');
      }

      setStep('complete');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '網路連線錯誤，請稍後重試');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="presentation">
      <section
        aria-labelledby="forgot-password-title"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        role="dialog"
      >
        <header className="mb-6 flex items-center justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
              {step === 'email' ? 'Step 1 of 3' : step === 'reset' ? 'Step 2 of 3' : 'Step 3 of 3'}
            </p>
            <h2 id="forgot-password-title" className="text-xl font-bold text-slate-900">
              {step === 'email' ? '重設密碼' : step === 'reset' ? '設定新密碼' : '密碼更新完成'}
            </h2>
          </div>
          <button
            aria-label="關閉"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </header>

        {step === 'email' && (
          <>
            <p className="mb-5 text-sm leading-6 text-slate-600">
              輸入帳號的 Email，我們會寄送一組限時驗證碼給你。
            </p>
            <form className="space-y-4" onSubmit={handleSendCode}>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">電子郵件</span>
                <span className="relative block">
                  <Mail className="absolute left-3 top-3.5 text-slate-400" size={18} />
                  <input
                    autoComplete="email"
                    className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@example.com"
                    required
                    type="email"
                    value={email}
                  />
                </span>
              </label>
              {error && <ErrorMessage message={error} />}
              <button
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 py-3 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={isSubmitting || !email.trim()}
                type="submit"
              >
                {isSubmitting ? <LoaderCircle className="animate-spin" size={18} /> : <Mail size={18} />}
                {isSubmitting ? '寄送中…' : '寄送驗證碼'}
              </button>
            </form>
          </>
        )}

        {step === 'reset' && (
          <>
            <p className="mb-5 text-sm leading-6 text-slate-600">
              驗證碼已寄至 <span className="font-medium text-slate-800">{email}</span>，請在 10 分鐘內完成設定。
            </p>
            <form className="space-y-4" onSubmit={handleResetPassword}>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">6 位數驗證碼</span>
                <span className="relative block">
                  <KeyRound className="absolute left-3 top-3.5 text-slate-400" size={18} />
                  <input
                    autoComplete="one-time-code"
                    className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-3 text-sm tracking-[0.25em] outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                    inputMode="numeric"
                    maxLength={6}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    required
                    value={code}
                  />
                </span>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">新密碼</span>
                <input
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  minLength={8}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="至少 8 字元，含大小寫、數字及符號"
                  required
                  type="password"
                  value={newPassword}
                />
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  避免連續或重複字元、常見單字、機關縮寫，以及包含帳號等個人資料。
                </span>
              </label>
              {error && <ErrorMessage message={error} />}
              <button
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 py-3 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={isSubmitting || code.length !== 6 || newPassword.length < 8}
                type="submit"
              >
                {isSubmitting ? <LoaderCircle className="animate-spin" size={18} /> : <KeyRound size={18} />}
                {isSubmitting ? '更新中…' : '更新密碼'}
              </button>
            </form>
          </>
        )}

        {step === 'complete' && (
          <div className="py-3 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle size={36} />
            </div>
            <p className="mb-6 text-sm leading-6 text-slate-600">新密碼已安全更新，現在可以使用新密碼登入。</p>
            <button
              className="w-full rounded-lg bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700"
              onClick={onClose}
              type="button"
            >
              返回登入
            </button>
          </div>
        )}

        {step !== 'complete' && (
          <div className="mt-6 border-t border-slate-100 pt-4 text-center">
            <button className="text-sm font-medium text-slate-500 hover:text-slate-800" onClick={onClose} type="button">
              返回登入
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
      <AlertCircle className="mt-0.5 shrink-0" size={17} />
      <span>{message}</span>
    </div>
  );
}