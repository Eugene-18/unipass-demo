import { useEffect, useRef, useState } from 'react';

type GoogleCredentialResponse = {
  credential: string;
};

export type GoogleProfile = {
  email: string;
  name: string;
  picture?: string;
};

type GoogleSignInButtonProps = {
  onSuccess: (profile: GoogleProfile) => void;
  onError?: (error: Error) => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }) => void;
          renderButton: (container: HTMLElement, options: Record<string, string>) => void;
        };
      };
    };
  }
}

const DEFAULT_API_BASE_URL = window.location.origin;

export default function GoogleSignInButton({ onSuccess, onError }: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);
  const [missingClientId, setMissingClientId] = useState(false);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
    if (!clientId) {
      setMissingClientId(true);
      onError?.(new Error('Missing VITE_GOOGLE_CLIENT_ID'));
      return;
    }

    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) || DEFAULT_API_BASE_URL;
    const backendEndpoint = `${apiBaseUrl.replace(/\/$/, '')}/api/auth/google`;

    const tryInit = () => {
      if (initRef.current) return true;
      if (!window.google?.accounts?.id || !buttonRef.current) return false;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: GoogleCredentialResponse) => {
          try {
            const res = await fetch(backendEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential: response.credential })
            });

            if (!res.ok) {
              throw new Error('Google authentication failed');
            }

            const profile = (await res.json()) as GoogleProfile;
            onSuccess(profile);
          } catch (error) {
            onError?.(error instanceof Error ? error : new Error('Google authentication failed'));
          }
        }
      });

      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        type: 'standard',
        text: 'signin_with'
      });

      initRef.current = true;
      return true;
    };

    if (tryInit()) return;

    const intervalId = window.setInterval(() => {
      if (tryInit()) {
        window.clearInterval(intervalId);
      }
    }, 200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [onError, onSuccess]);

  if (missingClientId) {
    return (
      <div className="flex flex-col gap-3 w-full">
        <button
          type="button"
          className="w-full py-4 bg-slate-100 border-2 border-dashed border-slate-300 rounded-2xl text-slate-400 font-bold cursor-not-allowed"
          disabled
        >
          Google Client ID 未設定
        </button>
        <button
          type="button"
          onClick={() => onSuccess({
            email: 'test@example.com',
            name: '測試使用者 (開發模式)',
            picture: 'https://picsum.photos/seed/user/100/100'
          })}
          className="w-full py-4 bg-amber-50 border-2 border-amber-200 rounded-2xl text-amber-700 font-bold hover:bg-amber-100 transition-all active:scale-95"
        >
          使用測試帳號登入 (開發預覽)
        </button>
        <p className="text-[10px] text-slate-400 text-center px-4">
          提示：請在 Settings &gt; Secrets 中設定 VITE_GOOGLE_CLIENT_ID 以啟用正式 Google 登入。
        </p>
      </div>
    );
  }

  return <div ref={buttonRef} />;
}
