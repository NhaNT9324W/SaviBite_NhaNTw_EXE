import { Platform } from 'react-native';
import { ENV } from '../../../config/env';

export interface GoogleUserProfile {
  sub: string;
  name: string;
  email: string;
  picture?: string;
  emailVerified?: boolean;
}

const GSI_SCRIPT_ID = 'google-gsi-client-script';
const STORAGE_CLIENT_ID_KEY = 'SAVIBITE_GOOGLE_CLIENT_ID';

export function getEffectiveGoogleClientId(): string {
  if (ENV.googleClientId && ENV.googleClientId.trim().length > 0) {
    return ENV.googleClientId.trim();
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = window.localStorage.getItem(STORAGE_CLIENT_ID_KEY);
    if (saved && saved.trim().length > 0) {
      return saved.trim();
    }
  }

  return '';
}

export function saveGoogleClientId(clientId: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(STORAGE_CLIENT_ID_KEY, clientId.trim());
  }
}

/**
 * Tải script Google Identity Services (GIS) chính thức của Google vào trình duyệt
 */
export function loadGoogleGsiScript(): Promise<void> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return Promise.resolve();
  }

  const existingScript = document.getElementById(GSI_SCRIPT_ID);
  if (existingScript) {
    if ((window as any).google?.accounts?.oauth2) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', (e) => reject(e));
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = GSI_SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
}

/**
 * Kích hoạt popup chọn tài khoản Google chính thức (accounts.google.com)
 */
export async function promptOfficialGoogleSignIn(
  clientId: string,
  onSuccess: (profile: GoogleUserProfile, token: string) => Promise<void> | void,
  onError: (errorMessage: string) => void
): Promise<void> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    onError('Tính năng đăng nhập Google hiện khả dụng trên nền tảng Web.');
    return;
  }

  if (!clientId || !clientId.trim()) {
    onError('Chưa có Google Client ID. Vui lòng cấu hình Client ID từ Google Cloud Console.');
    return;
  }

  try {
    await loadGoogleGsiScript();
  } catch (err) {
    onError('Không thể tải dịch vụ Google Identity Services. Vui lòng kiểm tra kết nối mạng.');
    return;
  }

  const google = (window as any).google;
  if (!google?.accounts?.oauth2) {
    onError('Google Identity Services chưa sẵn sàng.');
    return;
  }

  try {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId.trim(),
      scope: 'openid email profile',
      prompt: 'select_account', // Bắt buộc Google hiển thị màn hình "Chọn tài khoản" như Ảnh 2
      callback: async (tokenResponse: any) => {
        if (!tokenResponse || tokenResponse.error) {
          const errDetail = tokenResponse?.error_description || tokenResponse?.error || 'Người dùng đã hủy hoặc đăng nhập thất bại';
          onError(`Đăng nhập Google: ${errDetail}`);
          return;
        }

        try {
          // Lấy thông tin tài khoản thật từ Google UserInfo API
          const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: {
              Authorization: `Bearer ${tokenResponse.access_token}`,
            },
          });

          if (!response.ok) {
            throw new Error('Không thể lấy thông tin tài khoản từ Google.');
          }

          const userInfo = await response.json();
          const profile: GoogleUserProfile = {
            sub: userInfo.sub,
            name: userInfo.name || userInfo.email.split('@')[0],
            email: userInfo.email,
            picture: userInfo.picture,
            emailVerified: userInfo.email_verified,
          };

          await onSuccess(profile, tokenResponse.access_token);
        } catch (fetchErr: any) {
          onError(fetchErr?.message || 'Lỗi khi đồng bộ thông tin tài khoản Google.');
        }
      },
    });

    // Mở popup chính thức của Google accounts.google.com
    tokenClient.requestAccessToken({ prompt: 'select_account' });
  } catch (initErr: any) {
    onError(initErr?.message || 'Lỗi khởi tạo phiên đăng nhập Google.');
  }
}
