/**
 * Jest test setup — Worlds Mobile
 *
 * Global mocks applied before each test suite.
 */

// ─── AsyncStorage ─────────────────────────────────────────────────────────────
jest.mock('@react-native-async-storage/async-storage', () => {
  const values = new Map<string, string>();
  return {
  getItem: jest.fn((key: string) => Promise.resolve(values.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => { values.set(key, value); return Promise.resolve(); }),
  removeItem: jest.fn((key: string) => { values.delete(key); return Promise.resolve(); }),
  clear: jest.fn(() => { values.clear(); return Promise.resolve(); }),
  getAllKeys: jest.fn(() => Promise.resolve([...values.keys()])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn((entries: Array<[string, string]>) => { entries.forEach(([key, value]) => values.set(key, value)); return Promise.resolve(); }),
  multiRemove: jest.fn((keys: string[]) => { keys.forEach(key => values.delete(key)); return Promise.resolve(); }),
  };
});

// ─── expo-splash-screen ───────────────────────────────────────────────────────
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

// ─── expo-router ─────────────────────────────────────────────────────────────
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
  }),
  useSegments: () => [],
  useLocalSearchParams: () => ({}),
  Link: 'Link',
  Stack: { Screen: 'Stack.Screen' },
  Tabs: { Screen: 'Tabs.Screen' },
}));

// ─── expo-linking ─────────────────────────────────────────────────────────────
jest.mock('expo-linking', () => ({
  getInitialURL: jest.fn(() => Promise.resolve(null)),
  createURL: jest.fn((path: string) => `worlds://${path}`),
  parse: jest.fn((url: string) => ({ path: url, queryParams: {} })),
  canOpenURL: jest.fn(() => Promise.resolve(false)),
  openURL: jest.fn(() => Promise.resolve()),
  openSettings: jest.fn(() => Promise.resolve()),
}));

// ─── expo-location ────────────────────────────────────────────────────────────
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' })
  ),
  getForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'undetermined' })
  ),
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
}));

// ─── Suppress act() warnings in tests ────────────────────────────────────────
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('act(') || args[0].includes('Warning:'))
  ) {
    return;
  }
  originalConsoleError(...args);
};
