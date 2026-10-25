import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { BudgetFields, type BudgetFieldValues } from '@/components/BudgetFields';
import {
  AppText,
  Card,
  Loading,
  PrimaryButton,
  Screen,
  ScrollScreen,
  SectionTitle,
  useAppTheme,
} from '@/components/ui';
import {
  createBudget,
  getDayTotals,
  getLatestBudget,
  getSettings,
  getTransactions,
  toBudgetTransactions,
} from '@/db/queries';
import type { Budget } from '@/db/schema';
import { addDays, getCycle, getDashboard } from '@/lib/budget';
import { todayLocal } from '@/lib/date';
import { formatMoney, paiseToInput, parseRupeesToPaise } from '@/lib/money';

interface CycleState {
  previous: Budget;
  currencySymbol: string;
  cycleStartDay: number;
  spent: number;
  unspent: number;
  overspent: number;
}

export default function NewCycleScreen() {
  const theme = useAppTheme();
  const [state, setState] = useState<CycleState | null>(null);
  const [fields, setFields] = useState<BudgetFieldValues | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getLatestBudget(), getSettings()]).then(async ([previous, settings]) => {
      if (!previous || !settings) {
        router.replace('/setup');
        return;
      }
      const [rows, totals] = await Promise.all([
        getTransactions(previous.cycleStart, previous.cycleEnd),
        getDayTotals(previous.cycleStart, previous.cycleEnd),
      ]);
      const dashboard = getDashboard({
        today: previous.cycleEnd,
        cycleStart: previous.cycleStart,
        cycleEnd: previous.cycleEnd,
        spendingBudget: previous.spendingBudget,
        transactions: toBudgetTransactions(rows),
        dayTotals: totals,
      });
      setState({
        previous,
        currencySymbol: settings.currencySymbol,
        cycleStartDay: settings.cycleStartDay,
        spent: previous.spendingBudget - dashboard.cycleBudgetLeft,
        unspent: Math.max(0, dashboard.cycleBudgetLeft),
        overspent: dashboard.overspentAmount,
      });
      setFields({
        salary: paiseToInput(previous.salary),
        fixedExpenses: paiseToInput(previous.fixedExpenses),
        savingsTarget: paiseToInput(previous.savingsTarget),
        spendingBudget: paiseToInput(previous.spendingBudget),
      });
    });
  }, []);

  if (!state || !fields) {
    return (
      <Screen>
        <Loading label="Closing the last cycle…" />
      </Screen>
    );
  }

  function changeField(field: keyof BudgetFieldValues, value: string) {
    setFields((current) => (current ? { ...current, [field]: value } : current));
  }

  async function save() {
    if (!state || !fields) return;
    const salary = parseRupeesToPaise(fields.salary);
    const fixedExpenses = parseRupeesToPaise(fields.fixedExpenses);
    const savingsTarget = parseRupeesToPaise(fields.savingsTarget);
    const spendingBudget = parseRupeesToPaise(fields.spendingBudget);
    if (
      salary == null ||
      fixedExpenses == null ||
      savingsTarget == null ||
      spendingBudget == null
    ) {
      Alert.alert('Check your budget', 'Enter valid non-negative amounts.');
      return;
    }
    const currentCycle = getCycle(todayLocal(), state.cycleStartDay);
    const firstDateAfterPrevious = addDays(state.previous.cycleEnd, 1);
    const cycleStart =
      currentCycle.start < firstDateAfterPrevious ? firstDateAfterPrevious : currentCycle.start;
    try {
      setSaving(true);
      await createBudget({
        cycleStart,
        cycleEnd: currentCycle.end,
        salary,
        fixedExpenses,
        savingsTarget,
        spendingBudget,
      });
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Couldn’t start the cycle', (error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollScreen>
      <View style={styles.section}>
        <SectionTitle>Last cycle is complete</SectionTitle>
        <AppText muted>
          {state.previous.cycleStart} to {state.previous.cycleEnd}. Nothing carries over.
        </AppText>
      </View>

      <View style={styles.summaryRow}>
        <Card style={styles.summaryCard}>
          <AppText muted>Spent</AppText>
          <AppText style={{ fontWeight: '900', fontSize: 22 }}>
            {formatMoney(state.spent, state.currencySymbol)}
          </AppText>
        </Card>
        <Card style={styles.summaryCard}>
          <AppText muted>{state.overspent > 0 ? 'Overspent' : 'Unspent'}</AppText>
          <AppText
            style={{
              color: state.overspent > 0 ? theme.danger : theme.success,
              fontWeight: '900',
              fontSize: 22,
            }}
          >
            {formatMoney(
              state.overspent > 0 ? state.overspent : state.unspent,
              state.currencySymbol,
            )}
          </AppText>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionTitle>Confirm this cycle</SectionTitle>
        <AppText muted>We copied the previous budget. Edit anything that changed.</AppText>
        <BudgetFields
          values={fields}
          symbol={state.currencySymbol}
          onChange={changeField}
        />
      </View>
      <PrimaryButton
        label={saving ? 'Starting…' : 'Start new cycle'}
        onPress={save}
        disabled={saving}
      />
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryCard: { flex: 1, gap: 6 },
});
