import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import {
  AppText,
  Card,
  Loading,
  Screen,
  ScrollScreen,
  SectionTitle,
  useAppTheme,
} from '@/components/ui';
import {
  getBudgets,
  getDayTotals,
  getSavingsEntries,
  getSettings,
  getTransactions,
} from '@/db/queries';
import type { Budget } from '@/db/schema';
import { todayLocal } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { getCycleSummary, type CycleSummary } from '@/lib/summary';

interface SummaryRow {
  budget: Budget;
  summary: CycleSummary;
}

interface SummaryData {
  selected: SummaryRow;
  past: SummaryRow[];
  currencySymbol: string;
}

export default function SummaryScreen() {
  const params = useLocalSearchParams<{ cycleId?: string }>();
  const theme = useAppTheme();
  const [data, setData] = useState<SummaryData | null>(null);

  useEffect(() => {
    let current = true;
    const today = todayLocal();
    Promise.all([getBudgets(), getTransactions(), getDayTotals(), getSavingsEntries(), getSettings()])
      .then(([budgets, transactions, totals, savings, settings]) => {
        if (!current || budgets.length === 0) return;
        const rows = budgets.map((budget) => ({
          budget,
          summary: getCycleSummary({
            cycle: { start: budget.cycleStart, end: budget.cycleEnd },
            today,
            spendingBudget: budget.spendingBudget,
            savingsTarget: budget.savingsTarget,
            transactions: transactions
              .filter((row) => row.date >= budget.cycleStart && row.date <= budget.cycleEnd)
              .map((row) => ({
                date: row.date,
                amount: row.amount,
                type: row.type,
                countsTowardBudget: row.countsTowardBudget,
                categoryName: row.categoryName,
              })),
            dayTotals: totals.filter((row) => row.date >= budget.cycleStart && row.date <= budget.cycleEnd),
            savingsEntries: savings.filter((row) => row.date >= budget.cycleStart && row.date <= budget.cycleEnd),
          }),
        }));
        const requestedId = params.cycleId ? Number(params.cycleId) : null;
        const selected =
          rows.find((row) => requestedId != null && row.budget.id === requestedId) ??
          rows.find((row) => row.budget.cycleStart <= today && row.budget.cycleEnd >= today) ??
          rows[0]!;
        setData({
          selected,
          past: rows.filter(
            (row) => row.budget.cycleEnd < today && row.budget.id !== selected.budget.id,
          ),
          currencySymbol: settings?.currencySymbol ?? '₹',
        });
      });
    return () => {
      current = false;
    };
  }, [params.cycleId]);

  if (!data) {
    return (
      <Screen>
        <Loading label="Building cycle summary…" />
      </Screen>
    );
  }

  const { budget, summary } = data.selected;
  const barMaximum = Math.max(1, ...summary.spendingByCategory.map((row) => Math.max(0, row.amount)));
  return (
    <ScrollScreen>
      <View style={styles.heading}>
        <SectionTitle>Cycle summary</SectionTitle>
        <AppText muted>{budget.cycleStart} to {budget.cycleEnd}</AppText>
      </View>

      <View style={styles.metrics}>
        <Card style={styles.metricCard}>
          <AppText muted>Total spent</AppText>
          <AppText style={styles.metric}>{formatMoney(summary.totalSpent, data.currencySymbol)}</AppText>
        </Card>
        <Card style={styles.metricCard}>
          <AppText muted>{summary.overspent > 0 ? 'Overspent' : 'Remaining'}</AppText>
          <AppText style={[styles.metric, { color: summary.overspent > 0 ? theme.danger : theme.success }]}>
            {formatMoney(summary.overspent || summary.remaining, data.currencySymbol)}
          </AppText>
        </Card>
      </View>

      <Card style={styles.detailCard}>
        <View>
          <AppText muted>Average daily spending</AppText>
          <AppText style={styles.detailValue}>
            {formatMoney(summary.averageDailySpending, data.currencySymbol)}
          </AppText>
          <AppText muted>Across {summary.daysElapsed} elapsed days</AppText>
        </View>
        <View>
          <AppText muted>Planned savings / logged savings</AppText>
          <AppText style={styles.detailValue}>
            {formatMoney(summary.plannedSavings, data.currencySymbol)} / {formatMoney(summary.loggedSavings, data.currencySymbol)}
          </AppText>
        </View>
      </Card>

      <View style={styles.section}>
        <SectionTitle>Spending by category</SectionTitle>
        {summary.spendingByCategory.length === 0 ? <AppText muted>No spending in this cycle.</AppText> : null}
        {summary.spendingByCategory.map((row) => (
          <View key={row.category} style={styles.barRow}>
            <View style={styles.barLabels}>
              <AppText style={{ fontWeight: '700' }}>{row.category}</AppText>
              <AppText style={{ color: row.amount < 0 ? theme.success : theme.text, fontWeight: '800' }}>
                {formatMoney(row.amount, data.currencySymbol)}
              </AppText>
            </View>
            <View style={[styles.track, { backgroundColor: theme.border }]}>
              <View
                style={[
                  styles.bar,
                  {
                    backgroundColor: row.category === 'Unitemized' ? theme.muted : theme.primary,
                    width: `${(Math.max(0, row.amount) / barMaximum) * 100}%`,
                  },
                ]}
              />
            </View>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <SectionTitle>Past cycles</SectionTitle>
        {data.past.length === 0 ? <AppText muted>No completed cycles yet.</AppText> : null}
        {data.past.map((row) => (
          <Pressable
            key={row.budget.id}
            onPress={() => router.push({ pathname: '/summary', params: { cycleId: String(row.budget.id) } })}
          >
            <Card style={styles.pastRow}>
              <View style={{ flex: 1 }}>
                <AppText style={{ fontWeight: '800' }}>
                  {row.budget.cycleStart} to {row.budget.cycleEnd}
                </AppText>
                <AppText muted>Spent {formatMoney(row.summary.totalSpent, data.currencySymbol)}</AppText>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <AppText muted>{row.summary.overspent > 0 ? 'Overspent' : 'Unspent'}</AppText>
                <AppText style={{ color: row.summary.overspent > 0 ? theme.danger : theme.success, fontWeight: '800' }}>
                  {formatMoney(row.summary.overspent || row.summary.remaining, data.currencySymbol)}
                </AppText>
              </View>
              <Text style={{ color: theme.primary, fontSize: 24 }}>›</Text>
            </Card>
          </Pressable>
        ))}
      </View>
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 5 },
  metrics: { flexDirection: 'row', gap: 12 },
  metricCard: { flex: 1, gap: 7 },
  metric: { fontSize: 22, lineHeight: 29, fontWeight: '900' },
  detailCard: { gap: 18 },
  detailValue: { fontSize: 20, fontWeight: '900', marginTop: 3 },
  section: { gap: 14 },
  barRow: { gap: 6 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  track: { height: 12, borderRadius: 6, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 6 },
  pastRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15 },
});
