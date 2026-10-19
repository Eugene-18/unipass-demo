import { useEffect, useRef, useState } from 'react';

type GoogleCredentialResponse = {
  credential: string;
};

type GoogleProfile = {
  id: number;
  studentId: string;
  email: string;
  name: string;
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

const DEFAULT_API_BASE_URL = 'http://localhost:3000';

export default function GoogleSignInButton({ onSuccess, onError }: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);
  const [missingClientId, setMissingClientId] = useState(false);

  useEffect(() => {
    // 自動從 .env 檔案讀取剛才建立的 Client ID
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
    if (!clientId) {
      setMissingClientId(true);
      onError?.(new Error('遺失環境變數 VITE_GOOGLE_CLIENT_ID'));
      return;
    }

    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) || DEFAULT_API_BASE_URL;
    const backendEndpoint = `${apiBaseUrl.replace(/\/$/, '')}/api/auth/google`;

    // 🚀 動態載入 Google SDK 腳本 (免改 index.html)
    const loadGoogleScript = () => {
      if (document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) return;
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    };

    loadGoogleScript();

    const tryInit = () => {
      if (initRef.current) return true;
      if (!window.google?.accounts?.id || !buttonRef.current) return false;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: GoogleCredentialResponse) => {
          try {
            // 將 Google 回傳的 Token 送往後端驗證
            const res = await fetch(backendEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential: response.credential })
            });

            if (!res.ok) {
              throw new Error('Google 授權驗證失敗，請確認後端 API 狀態');
            }

            const profile = (await res.json()) as GoogleProfile;
            onSuccess(profile);
          } catch (error) {
            onError?.(error instanceof Error ? error : new Error('Google 授權驗證發生未知錯誤'));
          }
        }
      });

      // 渲染 Google 原生登入按鈕
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        type: 'standard',
        text: 'signin_with',
        width: '100%' // 讓按鈕寬度自適應父容器
      });

      initRef.current = true;
      return true;
    };

    if (tryInit()) return;

    // 若腳本尚未載入完畢，使用輪詢等待
    const intervalId = window.setInterval(() => {
      if (tryInit()) {
        window.clearInterval(intervalId);
      }
    }, 200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [onError, onSuccess]);

  // 若未設定金鑰的防呆畫面
  if (missingClientId) {
    return (
      <button
        type="button"
        className="w-full py-3 border border-red-200 bg-red-50 text-red-500 rounded-xl font-bold cursor-not-allowed"
        disabled
      >
        請在 .env 檔案設定 VITE_GOOGLE_CLIENT_ID
      </button>
    );
  }

  // 確保外層 div 撐滿容器並置中
  return <div ref={buttonRef} className="flex justify-center w-full" />;
}