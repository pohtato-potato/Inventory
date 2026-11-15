import { useSyncExternalStore } from 'react';

interface PwaState {
  needRefresh: boolean;
  offlineReady: boolean;
  persisted: boolean | null;
}

let state: PwaState = { needRefresh: false, offlineReady: false, persisted: null };
let updateSW: ((reload?: boolean) => Promise<void>) | undefined;
const listeners = new Set<() => void>();

function set(patch: Partial<PwaState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function usePwa(): PwaState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

/** Registers the service worker by hand (injectRegister is false) and asks Chrome to keep the data. */
export function startPwa(): void {
  if (navigator.storage?.persisted) {
    navigator.storage
      .persisted()
      .then((p) => (p ? true : navigator.storage.persist?.() ?? false))
      .then((p) => set({ persisted: p }))
      .catch(() => {});
  }
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    void import('virtual:pwa-register').then(({ registerSW }) => {
      updateSW = registerSW({
        onNeedRefresh: () => set({ needRefresh: true }),
        onOfflineReady: () => set({ offlineReady: true }),
        onRegisteredSW: (_url, reg) => {
          if (!reg) return;
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') reg.update().catch(() => {});
          });
        },
      });
    });
  }
}

export async function applyUpdate() {
  await updateSW?.(true);
}
