import { AppState, type AppStateStatus } from 'react-native';
import type { ConnectivityState } from '../types/offline.types';

type Listener = (state: ConnectivityState) => void;
let current: ConnectivityState = 'unknown';
const listeners = new Set<Listener>();
let started = false;

function setState(next: ConnectivityState) {
  if (current === next) return;
  current = next;
  listeners.forEach(listener => listener(next));
}

export const connectivityService = {
  getState: () => current,
  setState,
  subscribe(listener: Listener) { listeners.add(listener); return () => listeners.delete(listener); },
  start() {
    if (started) return () => undefined;
    started = true;
    let removeNetInfo: (() => void) | undefined;
    try {
      const NetInfo = require('@react-native-community/netinfo') as { addEventListener: (listener: (state: { isConnected: boolean | null; isInternetReachable?: boolean | null; type?: string }) => void) => () => void };
      removeNetInfo = NetInfo.addEventListener(state => {
        if (state.isConnected === false) setState('offline');
        else if (state.isInternetReachable === false) setState('limited');
        else if (state.isConnected === true) setState('online');
        else setState('unknown');
      });
    } catch { setState('unknown'); }
    const appSubscription = AppState.addEventListener('change', (status: AppStateStatus) => { if (status === 'active' && current !== 'offline') setState('recovering'); });
    return () => { removeNetInfo?.(); appSubscription.remove(); started = false; };
  },
};