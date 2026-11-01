/** 브라우저 기능 어댑터. 실패해도 화면이 멈추지 않도록 모두 try/catch로 감싼다. */

export function downloadText(filename: string, text: string, mime: string): void {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    /* 샌드박스 등에서 막히면 화면의 복사 칸을 쓰게 된다 */
  }
}

export async function copyText(text: string, fallbackEl?: HTMLTextAreaElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (fallbackEl) {
      fallbackEl.focus();
      fallbackEl.select();
    }
    return false;
  }
}

export type NotifyState = 'unsupported' | 'default' | 'granted' | 'denied';

export function notifyState(): NotifyState {
  try {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission as NotifyState;
  } catch {
    return 'unsupported';
  }
}

export async function requestNotify(): Promise<NotifyState> {
  try {
    if (typeof Notification === 'undefined') return 'unsupported';
    return (await Notification.requestPermission()) as NotifyState;
  } catch {
    return 'unsupported';
  }
}

export async function showNotification(title: string, body: string, tag: string): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, { body, tag, icon: './icon-192.png', badge: './icon-192.png' });
      return;
    }
  } catch {
    /* 아래 직접 알림으로 */
  }
  try {
    new Notification(title, { body, tag });
  } catch {
    /* 알림이 막힌 환경 */
  }
}

export function isIos(): boolean {
  try {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  } catch {
    return false;
  }
}

export function isStandalone(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}
