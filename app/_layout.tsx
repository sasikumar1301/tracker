import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAppTheme } from '@/components/ui';
import { AppLockGate } from '@/components/AppLockGate';
import { BannerProvider } from '@/components/Banner';
import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';
import { seedDefaultCategories } from '@/db/queries';
import { ensureReminderChannel, isAddReminderResponse } from '@/native/notifications';

function NotificationObserver() {
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!response) {
      handled.current = null;
      return;
    }
    if (!isAddReminderResponse(response)) return;
    const identifier = response.notification.request.identifier;
    if (handled.current === identifier) return;
    handled.current = identifier;
    void Notifications.clearLastNotificationResponseAsync();
    router.push('/add');
  }, [response]);
  return null;
}

function Navigation() {
  const theme = useAppTheme();
  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: theme.background },
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.text,
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '800' },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="setup" options={{ title: 'Set up DailyBudget' }} />
        <Stack.Screen name="new-cycle" options={{ title: 'Start your new cycle', gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="add"
          options={{
            title: 'Add',
            presentation: 'transparentModal',
            animation: 'slide_from_bottom',
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen name="import-review" options={{ title: 'Review import' }} />
        <Stack.Screen name="import-debug" options={{ title: 'OCR diagnostics' }} />
        <Stack.Screen name="savings" options={{ title: 'Savings' }} />
        <Stack.Screen name="summary" options={{ title: 'Cycle summary' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const theme = useAppTheme();
  const { success, error } = useMigrations(db, migrations);
  const [seeded, setSeeded] = useState(false);
  const [seedError, setSeedError] = useState<Error | null>(null);

  useEffect(() => {
    if (!success) return;
    let current = true;
    seedDefaultCategories()
      .then(() => current && setSeeded(true))
      .catch((reason: unknown) => current && setSeedError(reason as Error));
    return () => {
      current = false;
    };
  }, [success]);

  useEffect(() => {
    void ensureReminderChannel();
  }, []);

  const startupError = error ?? seedError;
  if (startupError) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorTitle, { color: theme.danger }]}>Couldn’t open DailyBudget</Text>
        <Text style={{ color: theme.text, textAlign: 'center' }}>{startupError.message}</Text>
      </View>
    );
  }
  if (!success || !seeded) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>Preparing your local budget…</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AppLockGate>
        <BannerProvider>
          <Navigation />
          <NotificationObserver />
        </BannerProvider>
      </AppLockGate>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  errorTitle: { fontSize: 20, fontWeight: '800' },
});
