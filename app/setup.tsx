import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { BudgetFields, type BudgetFieldValues } from '@/components/BudgetFields';
import {
  AppText,
  Chip,
  Field,
  PrimaryButton,
  ScrollScreen,
  SectionTitle,
} from '@/components/ui';
import { saveInitialSetup, updateSettings } from '@/db/queries';
import { getCycle } from '@/lib/budget';
import { todayLocal } from '@/lib/date';
import { paiseToInput, parseRupeesToPaise } from '@/lib/money';
import { enableDailyReminder } from '@/native/notifications';

const EMPTY_BUDGET: BudgetFieldValues = {
  salary: '',
  fixedExpenses: '',
  savingsTarget: '',
  spendingBudget: '',
};

export default function SetupScreen() {
  const [cycleStartDay, setCycleStartDay] = useState(1);
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [fields, setFields] = useState(EMPTY_BUDGET);
  const [spendingEdited, setSpendingEdited] = useState(false);
  const [saving, setSaving] = useState(false);

  function changeField(field: keyof BudgetFieldValues, value: string) {
    if (field === 'spendingBudget') setSpendingEdited(true);
    setFields((current) => {
      const next = { ...current, [field]: value };
      if (field !== 'spendingBudget' && !spendingEdited) {
        const salary = parseRupeesToPaise(next.salary) ?? 0;
        const fixed = parseRupeesToPaise(next.fixedExpenses) ?? 0;
        const savings = parseRupeesToPaise(next.savingsTarget) ?? 0;
        next.spendingBudget = paiseToInput(Math.max(0, salary - fixed - savings));
      }
      return next;
    });
  }

  async function save() {
    const salary = parseRupeesToPaise(fields.salary);
    const fixedExpenses = parseRupeesToPaise(fields.fixedExpenses);
    const savingsTarget = parseRupeesToPaise(fields.savingsTarget);
    const spendingBudget = parseRupeesToPaise(fields.spendingBudget);
    if (
      salary == null ||
      fixedExpenses == null ||
      savingsTarget == null ||
      spendingBudget == null ||
      currencySymbol.trim().length === 0
    ) {
      Alert.alert('Check your details', 'Enter valid non-negative amounts and a currency symbol.');
      return;
    }

    const today = todayLocal();
    const naturalCycle = getCycle(today, cycleStartDay);
    try {
      setSaving(true);
      await saveInitialSetup({
        currencySymbol: currencySymbol.trim(),
        cycleStartDay,
        cycleStart: today,
        cycleEnd: naturalCycle.end,
        salary,
        fixedExpenses,
        savingsTarget,
        spendingBudget,
      });
      Alert.alert('Daily reminder', 'Enable the daily reminder at 9:30 PM?', [
        { text: 'Not now', onPress: () => router.replace('/(tabs)') },
        {
          text: 'Yes',
          onPress: () => {
            void enableDailyReminder('21:30')
              .then(async (enabled) => {
                if (enabled) {
                  await updateSettings({ reminderEnabled: true, reminderTime: '21:30' });
                } else {
                  Alert.alert(
                    'Notifications are off',
                    'You can enable the reminder later in Settings.',
                  );
                }
              })
              .catch((error: Error) =>
                Alert.alert('Couldn’t enable reminder', error.message),
              )
              .finally(() => router.replace('/(tabs)'));
          },
        },
      ], { cancelable: false });
    } catch (error) {
      Alert.alert('Couldn’t save setup', (error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollScreen>
      <View style={styles.intro}>
        <SectionTitle>Plan this pay cycle</SectionTitle>
        <AppText muted>
          Everything stays on this phone. You can adjust the suggested everyday budget before saving.
        </AppText>
      </View>

      <Field
        label="Currency symbol (display only)"
        value={currencySymbol}
        maxLength={4}
        onChangeText={setCurrencySymbol}
      />

      <View style={styles.section}>
        <AppText muted style={styles.pickerLabel}>
          Cycle starts on day {cycleStartDay}
        </AppText>
        <View style={styles.chips}>
          {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => (
            <Chip
              key={day}
              label={String(day)}
              selected={cycleStartDay === day}
              onPress={() => setCycleStartDay(day)}
            />
          ))}
        </View>
      </View>

      <BudgetFields values={fields} symbol={currencySymbol || '₹'} onChange={changeField} />
      <PrimaryButton label={saving ? 'Saving…' : 'Start budgeting'} onPress={save} disabled={saving} />
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 6 },
  section: { gap: 10 },
  pickerLabel: { fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
