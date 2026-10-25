import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState, StyleSheet, Text, View, type AppStateStatus } from 'react-native';

import { getSettings } from '@/db/queries';
import { authenticateForAppLock } from '@/native/appLock';

import { PrimaryButton, useAppTheme } from './ui';

const LOCK_AFTER_MS = 60_000;

export function AppLockGate({ children }: PropsWithChildren) {
  const theme = useAppTheme();
  const [status, setStatus] = useState<'checking' | 'locked' | 'unlocked'>('checking');
  const [authenticating, setAuthenticating] = useState(false);
  const appState = useRef<AppStateStatus>((AppState.currentState ?? 'active') as AppStateStatus);
  const backgroundAt = useRef<number | null>(null);
  const authenticationRunning = useRef(false);

  async function unlock() {
    if (authenticationRunning.current) return;
    authenticationRunning.current = true;
    setAuthenticating(true);
    const success = await authenticateForAppLock();
    if (success) setStatus('unlocked');
    else setStatus('locked');
    setAuthenticating(false);
    authenticationRunning.current = false;
  }

  useEffect(() => {
    let current = true;
    getSettings().then(async (settings) => {
      if (!current) return;
      if (settings?.appLockEnabled) {
        setStatus('locked');
        await unlock();
      } else {
        setStatus('unlocked');
      }
    });
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previous = appState.current;
      appState.current = nextState;
      if (previous === 'active' && nextState !== 'active') {
        backgroundAt.current = Date.now();
        return;
      }
      if (nextState !== 'active' || backgroundAt.current == null) return;
      const elapsed = Date.now() - backgroundAt.current;
      backgroundAt.current = null;
      if (elapsed < LOCK_AFTER_MS) return;
      getSettings().then((settings) => {
        if (!settings?.appLockEnabled) return;
        setStatus('locked');
        void unlock();
      });
    });
    return () => subscription.remove();
  }, []);

  if (status === 'unlocked') return children;
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>DailyBudget is locked</Text>
      <Text style={[styles.body, { color: theme.muted }]}>
        Authenticate with your device security to continue.
      </Text>
      {status === 'locked' ? (
        <PrimaryButton
          label={authenticating ? 'Unlocking…' : 'Unlock'}
          onPress={() => void unlock()}
          disabled={authenticating}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 },
  title: { fontSize: 25, fontWeight: '900' },
  body: { fontSize: 16, lineHeight: 23, textAlign: 'center', marginBottom: 6 },
});
