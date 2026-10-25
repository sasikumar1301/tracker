import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { BudgetFields, type BudgetFieldValues } from '@/components/BudgetFields';
import {
  AppText,
  Card,
  Chip,
  Field,
  Loading,
  PrimaryButton,
  Screen,
  ScrollScreen,
  SectionTitle,
} from '@/components/ui';
import {
  deleteAllData,
  getBudgetForDate,
  getSettings,
  updateBudget,
  updateSettings,
} from '@/db/queries';
import type { Budget } from '@/db/schema';
import { todayLocal } from '@/lib/date';
import { paiseToInput, parseRupeesToPaise } from '@/lib/money';
import { authenticateForAppLock, canUseAppLock } from '@/native/appLock';
import { exportAllCsvFiles } from '@/native/exportCsv';
import {
  cancelAllNotifications,
  cancelDailyReminder,
  enableDailyReminder,
  parseReminderTime,
  scheduleDailyReminder,
} from '@/native/notifications';

const TIME_PRESETS = ['20:00', '21:00', '21:30', '22:00'];
const THRESHOLDS = [50, 60, 70, 80, 90, 100];

export default function SettingsScreen() {
  const [budget, setBudget] = useState<Budget | null>(null);
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [cycleStartDay, setCycleStartDay] = useState(1);
  const [fields, setFields] = useState<BudgetFieldValues | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('21:30');
  const [alertThreshold, setAlertThreshold] = useState('80');
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [appLockAvailable, setAppLockAvailable] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [nativeBusy, setNativeBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let current = true;
      Promise.all([getBudgetForDate(todayLocal()), getSettings(), canUseAppLock()]).then(
        ([row, settings, lockAvailable]) => {
          if (!current || !row || !settings) return;
          setBudget(row);
          setCurrencySymbol(settings.currencySymbol);
          setCycleStartDay(settings.cycleStartDay);
          setReminderEnabled(settings.reminderEnabled);
          setReminderTime(settings.reminderTime ?? '21:30');
          setAlertThreshold(
            String(
              settings.alertThreshold >= 50 && settings.alertThreshold <= 100
                ? settings.alertThreshold
                : 80,
            ),
          );
          setAppLockEnabled(settings.appLockEnabled);
          setAppLockAvailable(lockAvailable);
          setFields({
            salary: paiseToInput(row.salary),
            fixedExpenses: paiseToInput(row.fixedExpenses),
            savingsTarget: paiseToInput(row.savingsTarget),
            spendingBudget: paiseToInput(row.spendingBudget),
          });
        },
      );
      return () => {
        current = false;
      };
    }, []),
  );

  if (!budget || !fields || appLockAvailable == null) {
    return (
      <Screen>
        <Loading label="Loading settings…" />
      </Screen>
    );
  }

  function changeField(field: keyof BudgetFieldValues, value: string) {
    setFields((current) => (current ? { ...current, [field]: value } : current));
  }

  async function changeReminder(enabled: boolean) {
    if (!parseReminderTime(reminderTime)) {
      Alert.alert('Check the reminder time', 'Use HH:MM in 24-hour time, for example 21:30.');
      return;
    }
    try {
      setNativeBusy(true);
      if (enabled) {
        const granted = await enableDailyReminder(reminderTime);
        if (!granted) {
          Alert.alert(
            'Notifications are disabled',
            'Allow notifications in Android Settings before turning on the reminder.',
          );
          return;
        }
      } else {
        await cancelDailyReminder();
      }
      await updateSettings({ reminderEnabled: enabled, reminderTime });
      setReminderEnabled(enabled);
    } catch (error) {
      Alert.alert('Couldn’t update reminder', (error as Error).message);
    } finally {
      setNativeBusy(false);
    }
  }

  async function commitReminderTime(time: string) {
    if (!parseReminderTime(time)) {
      Alert.alert('Check the reminder time', 'Use HH:MM in 24-hour time, for example 21:30.');
      return;
    }
    if (!reminderEnabled) return;
    try {
      setNativeBusy(true);
      await scheduleDailyReminder(time);
      await updateSettings({ reminderTime: time });
    } catch (error) {
      Alert.alert('Couldn’t reschedule reminder', (error as Error).message);
    } finally {
      setNativeBusy(false);
    }
  }

  function chooseReminderTime(time: string) {
    setReminderTime(time);
    void commitReminderTime(time);
  }

  async function changeAppLock(enabled: boolean) {
    if (enabled && !appLockAvailable) return;
    try {
      setNativeBusy(true);
      if (enabled) {
        const authenticated = await authenticateForAppLock('Enable DailyBudget app lock');
        if (!authenticated) {
          Alert.alert('App lock not enabled', 'Authentication was not completed.');
          return;
        }
      }
      await updateSettings({ appLockEnabled: enabled });
      setAppLockEnabled(enabled);
    } catch (error) {
      Alert.alert('Couldn’t update app lock', (error as Error).message);
    } finally {
      setNativeBusy(false);
    }
  }

  async function save() {
    if (!budget || !fields) return;
    const salary = parseRupeesToPaise(fields.salary);
    const fixedExpenses = parseRupeesToPaise(fields.fixedExpenses);
    const savingsTarget = parseRupeesToPaise(fields.savingsTarget);
    const spendingBudget = parseRupeesToPaise(fields.spendingBudget);
    const threshold = Number(alertThreshold);
    if (
      salary == null ||
      fixedExpenses == null ||
      savingsTarget == null ||
      spendingBudget == null ||
      !currencySymbol.trim() ||
      !parseReminderTime(reminderTime) ||
      !Number.isInteger(threshold) ||
      threshold < 50 ||
      threshold > 100
    ) {
      Alert.alert(
        'Check your settings',
        'Enter valid non-negative amounts, a reminder time, and an alert threshold from 50 to 100.',
      );
      return;
    }
    try {
      setSaving(true);
      if (reminderEnabled) await scheduleDailyReminder(reminderTime);
      else await cancelDailyReminder();
      await Promise.all([
        updateBudget(budget.id, { salary, fixedExpenses, savingsTarget, spendingBudget }),
        updateSettings({
          currencySymbol: currencySymbol.trim(),
          cycleStartDay,
          reminderEnabled,
          reminderTime,
          alertThreshold: threshold,
          appLockEnabled,
        }),
      ]);
      Alert.alert('Saved', 'Your budget, reminders, and privacy settings are updated.');
    } catch (error) {
      Alert.alert('Couldn’t save settings', (error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function exportCsv() {
    try {
      setNativeBusy(true);
      await exportAllCsvFiles();
    } catch (error) {
      Alert.alert('Couldn’t export data', (error as Error).message);
    } finally {
      setNativeBusy(false);
    }
  }

  function confirmDeleteAll() {
    Alert.alert('Delete all DailyBudget data?', 'Budgets, transactions, totals, savings, and learned merchant rules will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Really delete everything?', 'This cannot be undone.', [
            { text: 'Keep my data', style: 'cancel' },
            {
              text: 'Delete all data',
              style: 'destructive',
              onPress: () => {
                setNativeBusy(true);
                void cancelAllNotifications()
                  .then(deleteAllData)
                  .then(() => router.replace('/setup'))
                  .catch((error: Error) => {
                    setNativeBusy(false);
                    Alert.alert('Couldn’t delete data', error.message);
                  });
              },
            },
          ], { cancelable: false });
        },
      },
    ]);
  }

  return (
    <ScrollScreen>
      <Card style={styles.cycleCard}>
        <AppText muted>Current cycle</AppText>
        <AppText style={{ fontWeight: '800' }}>{budget.cycleStart} to {budget.cycleEnd}</AppText>
      </Card>

      <View style={styles.section}>
        <SectionTitle>Daily reminder</SectionTitle>
        <ToggleRow
          title="Log spending reminder"
          subtitle="A local notification; no account or server is used."
          value={reminderEnabled}
          disabled={nativeBusy}
          onValueChange={(value) => void changeReminder(value)}
        />
        <Field
          label="Reminder time (24-hour HH:MM)"
          value={reminderTime}
          onChangeText={setReminderTime}
          onEndEditing={() => void commitReminderTime(reminderTime)}
          placeholder="21:30"
          keyboardType="numbers-and-punctuation"
          maxLength={5}
        />
        <View style={styles.chips}>
          {TIME_PRESETS.map((time) => (
            <Chip
              key={time}
              label={time}
              selected={reminderTime === time}
              onPress={() => chooseReminderTime(time)}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionTitle>Spending alert</SectionTitle>
        <AppText muted>Show a banner once when a save crosses this share of the cycle budget.</AppText>
        <Field
          label="Alert threshold (50–100%)"
          value={alertThreshold}
          onChangeText={setAlertThreshold}
          keyboardType="number-pad"
          maxLength={3}
        />
        <View style={styles.chips}>
          {THRESHOLDS.map((threshold) => (
            <Chip
              key={threshold}
              label={`${threshold}%`}
              selected={alertThreshold === String(threshold)}
              onPress={() => setAlertThreshold(String(threshold))}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionTitle>App lock</SectionTitle>
        <ToggleRow
          title="Require device authentication"
          subtitle={
            appLockAvailable
              ? 'Locks on cold start and after 60 seconds in the background.'
              : 'Set up a device PIN, pattern, fingerprint, or face unlock first.'
          }
          value={appLockEnabled}
          disabled={!appLockAvailable || nativeBusy}
          onValueChange={(value) => void changeAppLock(value)}
        />
      </View>

      <View style={styles.section}>
        <SectionTitle>Current budget</SectionTitle>
        <BudgetFields values={fields} symbol={currencySymbol || '₹'} onChange={changeField} />
      </View>

      <View style={styles.section}>
        <SectionTitle>Display</SectionTitle>
        <Field label="Currency symbol" value={currencySymbol} maxLength={4} onChangeText={setCurrencySymbol} />
      </View>

      <View style={styles.section}>
        <SectionTitle>Next cycle</SectionTitle>
        <AppText muted>Start-day changes apply only when you confirm the next cycle.</AppText>
        <View style={styles.chips}>
          {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => (
            <Chip key={day} label={String(day)} selected={cycleStartDay === day} onPress={() => setCycleStartDay(day)} />
          ))}
        </View>
      </View>

      <PrimaryButton label={saving ? 'Saving…' : 'Save settings'} onPress={() => void save()} disabled={saving || nativeBusy} />

      <View style={styles.section}>
        <SectionTitle>Your data</SectionTitle>
        <AppText muted>Export opens three system share sheets: transactions, day totals, and savings.</AppText>
        <PrimaryButton label="Export CSV files" onPress={() => void exportCsv()} tone="neutral" disabled={nativeBusy} />
        <PrimaryButton label="Delete all data" onPress={confirmDeleteAll} tone="danger" disabled={nativeBusy} />
      </View>

      {__DEV__ ? (
        <View style={styles.section}>
          <SectionTitle>Developer tools</SectionTitle>
          <PrimaryButton label="OCR diagnostics" onPress={() => router.push('/import-debug')} tone="neutral" />
        </View>
      ) : null}
    </ScrollScreen>
  );
}

function ToggleRow({
  title,
  subtitle,
  value,
  disabled,
  onValueChange,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  disabled: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <AppText style={{ fontWeight: '800' }}>{title}</AppText>
        <AppText muted>{subtitle}</AppText>
      </View>
      <Switch value={value} disabled={disabled} onValueChange={onValueChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  cycleCard: { gap: 4 },
  section: { gap: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
});
