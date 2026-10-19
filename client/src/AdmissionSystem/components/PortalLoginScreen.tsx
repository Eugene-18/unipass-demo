import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, GraduationCap, KeyRound, Lock, LogIn, Mail, ShieldCheck, UserPlus } from 'lucide-react';
import type { PortalRole, PortalUser } from '../types';
import { DEMO_AUTH_TOKEN, setStoredAuthToken } from '../lib/security';

const REMEMBERED_EMAIL_KEY = 'portal-login-remembered-email';
const NTUB_LOGO_GIF = '/ntubLOGO-GIF.gif';

const ROLE_LABELS: Record<PortalRole, { title: string; entry: string; button: string; accent: string; hero: string; helper: string; placeholder: string; reminder: string }> = {
  candidate: {
    title: '考生端',
    entry: '考生入口',
    button: '登入考生端',
    accent: '#6B21A8',
    hero: '考生登入後即可接續報名、志願、文件與繳費流程。',
    helper: '考生密碼需包含英文大寫、小寫、數字與特殊字元，長度至少 8 碼。',
    placeholder: '請輸入考生電子信箱',
    reminder: '考生可使用報名帳號登入，若尚未建立帳號可先完成註冊。',
  },
  reviewer: {
    title: '審查員端',
    entry: '審查員入口',
    button: '登入審查員端',
    accent: '#5c1126',
    hero: '審查員可直接進入案件總覽、文件核對、補件與核准作業。',
    helper: '審查員請使用教職員帳號密碼登入，忘記密碼請聯繫系統管理員。',
    placeholder: '請輸入教職員帳號或信箱',
    reminder: '若單位已啟用 Microsoft / 校園入口網 SSO，可直接使用快速登入。',
  },
};

interface PortalLoginScreenProps {
  defaultRole?: PortalRole;
  onLogin: (profile: PortalUser) => void;
}

function RoleChip({ active, title, onClick, accent }: { active: boolean; title: string; accent: 'candidate' | 'reviewer'; onClick: () => void; }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={active ? 'flex w-full items-center gap-4 rounded-3xl border border-transparent bg-slate-900 p-4 text-left text-white shadow-sm transition-all sm:p-5' : 'flex w-full items-center gap-4 rounded-3xl border border-slate-200 bg-white p-4 text-left text-slate-700 transition-all hover:border-slate-300 sm:p-5'}
      style={active && accent === 'candidate' ? { background: 'linear-gradient(135deg, #6B21A8 0%, #15233d 100%)' } : active && accent === 'reviewer' ? { background: 'linear-gradient(135deg, #5c1126 0%, #15233d 100%)' } : undefined}
    >
      <div className={active ? 'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white' : 'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500'}>
        {accent === 'candidate' ? <GraduationCap size={22} /> : <ShieldCheck size={22} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-black">{title}</h3>
          {active && <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold tracking-[0.2em]">已選取</span>}
        </div>
      </div>
    </button>
  );
}

export default function PortalLoginScreen({ defaultRole = 'candidate', onLogin }: PortalLoginScreenProps) {
  const [role, setRole] = useState<PortalRole>(defaultRole);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberAccount, setRememberAccount] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const resetCodeInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setRole(defaultRole);
  }, [defaultRole]);

  useEffect(() => {
    const rememberedEmail = window.localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (rememberedEmail) {
      setLoginEmail(rememberedEmail);
      setRememberAccount(true);
    }
  }, []);

  const passwordRegex = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const completeLogin = (profile: PortalUser) => {
    if (rememberAccount && profile.email) {
      window.localStorage.setItem(REMEMBERED_EMAIL_KEY, profile.email);
    } else {
      window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }

    setStoredAuthToken(DEMO_AUTH_TOKEN);
    onLogin(profile);
  };

  const submitLogin = (isRegister = false) => {
    if (role === 'reviewer' && isRegister) {
      return;
    }

    const setError = isRegister ? setRegisterError : setLoginError;
    setError(null);

    if (!emailRegex.test(loginEmail)) {
      setError(role === 'reviewer' ? '請輸入有效審查帳號信箱' : isRegister ? '請輸入有效電子信箱以註冊' : '請輸入有效電子信箱');
      return;
    }

    if (role === 'reviewer') {
      if (!loginPassword.trim()) {
        setError('請輸入教職員帳號密碼，或改用 SSO 快速登入');
        return;
      }
    } else if (!passwordRegex.test(loginPassword)) {
      setError('密碼不符合強度要求');
      return;
    }

    // Prefer server-side auth when available
    (async () => {
      try {
        const resp = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: loginEmail, password: loginPassword }) });
        if (resp.ok) {
          const data = await resp.json();
          completeLogin({ email: data.email, name: data.name || (loginEmail.split('@')[0]), picture: undefined, role });
          return;
        }
      } catch (e) {
        // fall through to local behavior
      }

      const profile: PortalUser = {
        email: loginEmail,
        name: role === 'reviewer' ? '審查委員' : isRegister ? '新註冊考生' : loginEmail.split('@')[0],
        picture: role === 'reviewer' ? undefined : isRegister ? 'https://picsum.photos/seed/new/100/100' : undefined,
        role,
      };

      completeLogin(profile);
    })();
  };

  const handleFacultySsoLogin = () => {
    setLoginError(null);
    setRegisterError(null);

    completeLogin({
      email: 'faculty.sso@ntub.edu.tw',
      name: '校內教職員 SSO',
      picture: undefined,
      role: 'reviewer',
    });
  };

  const activeRoleMeta = ROLE_LABELS[role];

  useEffect(() => {
    if (showReset) {
      setTimeout(() => resetCodeInputRef.current?.focus(), 50);
    }
  }, [showReset]);

  const handleSendVerificationCode = () => {
    setForgotMessage(null);
    setGeneratedCode('');

    if (!emailRegex.test(forgotEmail)) {
      setForgotMessage('請輸入有效電子信箱');
      return;
    }

    setIsSendingCode(true);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedCode(code);

    window.setTimeout(() => {
      setIsSendingCode(false);
      setShowReset(true);
      setResetToken('');
      setForgotMessage('請輸入收到的驗證碼');
      alert(`【系統測試】已模擬發送驗證碼至信箱！\n您的驗證碼為：${code}`);
      setTimeout(() => resetCodeInputRef.current?.focus(), 50);
    }, 1000);
  };

  const submitReset = async () => {
    setForgotMessage(null);
    if (!emailRegex.test(forgotEmail)) {
      setForgotMessage('請輸入有效電子信箱');
      return;
    }
    if (!resetToken.trim()) {
      setForgotMessage('請輸入驗證碼');
      return;
    }
    if (generatedCode && resetToken.trim() !== generatedCode) {
      setForgotMessage('驗證碼錯誤，請重新輸入或重新發送驗證碼');
      return;
    }
    if (!generatedCode) {
      setForgotMessage('尚未產生驗證碼，請先發送驗證碼');
      return;
    }
    if (resetNewPassword !== resetConfirm) {
      setForgotMessage('新密碼與確認密碼不符');
      return;
    }
    if (!passwordRegex.test(resetNewPassword)) {
      setForgotMessage('密碼格式不符要求');
      return;
    }
    try {
      const resp = await fetch('/api/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: forgotEmail, token: resetToken, newPassword: resetNewPassword }) });
      const data = await resp.json();
      if (resp.ok) {
        setForgotMessage('密碼已更新，請使用新密碼登入');
        setShowForgot(false);
        setShowReset(false);
      } else {
        setForgotMessage(data.error || '更新失敗');
      }
    } catch (e) {
      setForgotMessage('網路錯誤，請稍後再試');
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 px-4 py-4 text-slate-900 sm:px-6 sm:py-6 lg:h-screen lg:overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(107,33,168,0.12),transparent_34%),radial-gradient(circle_at_top_right,rgba(92,17,38,0.12),transparent_28%),linear-gradient(180deg,#fbfcfe_0%,#f5f7fb_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/80 to-transparent" />

      <div className="relative mx-auto grid w-full max-w-7xl gap-6 lg:h-[calc(100vh-3rem)] lg:grid-cols-[minmax(0,1.08fr)_minmax(440px,0.92fr)] lg:items-stretch">
        <section className="flex flex-col justify-center space-y-8 lg:h-full lg:overflow-hidden">
          <div className="w-full max-w-2xl px-4 sm:px-6 md:px-8">
            <div className="flex w-full min-w-0 flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-5">
              <img src={NTUB_LOGO_GIF} alt="國立臺北商業大學 Logo" className="h-12 w-auto shrink-0 object-contain sm:h-16" />
              <h1 className="flex min-w-0 flex-1 flex-col font-black leading-tight text-slate-900">
                <span className="whitespace-normal break-words break-keep text-2xl font-bold leading-tight sm:text-3xl md:text-4xl lg:text-5xl">國立臺北商業大學</span>
                <span className="whitespace-normal break-words break-keep text-3xl font-extrabold leading-tight sm:text-4xl md:text-5xl lg:text-6xl">招生網路系統</span>
              </h1>
            </div>
          </div>
        </section>

        <section className="relative flex h-full flex-col">
          <div className="absolute -left-8 top-8 hidden h-40 w-40 rounded-full bg-[#6B21A8]/10 blur-3xl lg:block" />
          <div className="absolute -right-6 bottom-10 hidden h-44 w-44 rounded-full bg-[#5c1126]/10 blur-3xl lg:block" />

          <div className="relative flex h-full flex-1 flex-col rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8 lg:overflow-y-auto">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="mt-2 text-2xl font-black text-slate-900">請選擇登入身分</h2>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <RoleChip
                active={role === 'candidate'}
                title="考生端"
                accent="candidate"
                onClick={() => setRole('candidate')}
              />
              <RoleChip
                active={role === 'reviewer'}
                title="審查員端"
                accent="reviewer"
                onClick={() => setRole('reviewer')}
              />
            </div>

            {/* duplicate hero text removed to simplify layout */}

            <p className="mt-4 text-sm leading-6 text-slate-600">{activeRoleMeta.reminder}</p>

            <div className="mt-6 space-y-4">
              <label className="block space-y-2">
                <span className="flex items-center gap-2 text-base font-semibold text-slate-800"><Mail size={16} /> {role === 'reviewer' ? '教職員帳號 / 信箱' : '帳號信箱'}</span>
                <input
                  type="email"
                  placeholder="請輸入電子郵件"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition-all focus:border-[#6B21A8] focus:ring-4 focus:ring-[#6B21A8]/10"
                />
              </label>

              <label className="block space-y-2">
                <span className="flex items-center gap-2 text-base font-semibold text-slate-800"><Lock size={16} /> 登入密碼</span>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={role === 'reviewer' ? '請輸入教職員密碼' : '請輸入考生密碼'}
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-12 outline-none transition-all focus:border-[#6B21A8] focus:ring-4 focus:ring-[#6B21A8]/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute inset-y-0 right-0 flex items-center justify-center rounded-r-2xl px-4 text-slate-500 transition-colors hover:text-slate-700"
                    aria-label={showPassword ? '隱藏密碼' : '顯示密碼'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
              <p className="text-sm leading-6 text-slate-600">{activeRoleMeta.helper}</p>

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm leading-6 text-slate-700">
                <label className="inline-flex items-center gap-2 font-medium text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberAccount}
                    onChange={(event) => setRememberAccount(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#6B21A8] focus:ring-[#6B21A8]/20"
                  />
                  記住帳號
                </label>
                <button
                  type="button"
                  onClick={() => { setShowForgot(true); setForgotEmail(loginEmail); setForgotMessage(null); setGeneratedCode(''); setResetToken(''); setIsSendingCode(false); }}
                  className="font-semibold text-[#6B21A8] transition-colors hover:text-[#5c1126]"
                >
                  忘記密碼？
                </button>
              </div>

              {loginError && <p className="text-sm font-semibold text-red-500">{loginError}</p>}
              {registerError && <p className="text-sm font-semibold text-red-500">{registerError}</p>}

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => submitLogin(false)}
                  className={role === 'reviewer' ? 'inline-flex items-center justify-center gap-2 rounded-2xl bg-[#5c1126] px-5 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:opacity-95 active:scale-[0.98]' : 'inline-flex items-center justify-center gap-2 rounded-2xl bg-[#6B21A8] px-5 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:opacity-95 active:scale-[0.98]'}
                >
                  <LogIn size={16} /> {activeRoleMeta.button}
                </button>

                {role === 'candidate' ? (
                  <button
                    type="button"
                    onClick={() => submitLogin(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 transition-all hover:border-[#6B21A8]/30 hover:bg-slate-50 active:scale-[0.98]"
                  >
                    <UserPlus size={16} /> 立即註冊考生帳號
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleFacultySsoLogin}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 transition-all hover:border-[#5c1126]/30 hover:bg-slate-50 active:scale-[0.98]"
                  >
                    <KeyRound size={16} /> 校內教職員 SSO 快速登入
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 系統提示區塊已移除 */}
        </section>
      </div>
      {/* Forgot password modal */}
      {showForgot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-bold">重設密碼</h3>
            <p className="mt-2 text-sm text-slate-600">輸入註冊的電子信箱，我們會以驗證碼方式協助您重設密碼。</p>
            <div className="mt-4 space-y-3">
              <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="電子信箱" className="w-full rounded-2xl border px-4 py-2" />
              <div className="flex gap-2">
                <button type="button" onClick={handleSendVerificationCode} disabled={isSendingCode} className="rounded-xl bg-[#6B21A8] px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-70">{isSendingCode ? '發送中...' : '發送驗證碼'}</button>
                <button type="button" onClick={() => { setShowReset(true); setResetToken(''); setForgotMessage('請輸入收到的驗證碼'); setTimeout(() => resetCodeInputRef.current?.focus(), 50); }} className="rounded-xl border px-4 py-2">我已收到驗證碼</button>
                <button type="button" onClick={() => { setShowForgot(false); setForgotMessage(null); setGeneratedCode(''); setResetToken(''); setIsSendingCode(false); }} className="ml-auto text-sm text-slate-500">取消</button>
              </div>
              {forgotMessage && <p className="text-sm text-slate-700">{forgotMessage}</p>}
              {generatedCode && <p className="mt-2 text-xs text-slate-500">測試驗證碼：<span className="font-mono">{generatedCode}</span></p>}
            </div>
          </div>
        </div>
      )}

      {showReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-bold">輸入驗證碼並設定新密碼</h3>
            <div className="mt-4 space-y-3">
              <input ref={resetCodeInputRef} type="text" value={resetToken} onChange={(e) => setResetToken(e.target.value)} placeholder="驗證碼" className="w-full rounded-2xl border px-4 py-2" />
              <input type="password" value={resetNewPassword} onChange={(e) => setResetNewPassword(e.target.value)} placeholder="新密碼" className="w-full rounded-2xl border px-4 py-2" />
              <input type="password" value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)} placeholder="確認新密碼" className="w-full rounded-2xl border px-4 py-2" />
              <div className="flex gap-2">
                <button type="button" onClick={submitReset} className="rounded-xl bg-[#6B21A8] px-4 py-2 text-white">確認並更新密碼</button>
                <button type="button" onClick={() => { setShowReset(false); setForgotMessage(null); }} className="rounded-xl border px-4 py-2">取消</button>
              </div>
              {forgotMessage && <p className="text-sm text-slate-700">{forgotMessage}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
