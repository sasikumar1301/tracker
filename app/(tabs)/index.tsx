import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { AppText, Card, Loading, Screen, useAppTheme } from '@/components/ui';
import {
  getBudgetForDate,
  getDayTotals,
  getSavingsEntries,
  getSettings,
  getTransactions,
  saveDayTotal,
  toBudgetTransactions,
} from '@/db/queries';
import { getDashboard, type Dashboard } from '@/lib/budget';
import { todayLocal } from '@/lib/date';
import { getMissingDays } from '@/lib/habits';
import { formatMoney } from '@/lib/money';

interface DashboardView {
  values: Dashboard;
  currencySymbol: string;
  missingDays: string[];
  savingsLogged: number;
  savingsTarget: number;
}

export default function DashboardScreen() {
  const theme = useAppTheme();
  const [data, setData] = useState<DashboardView | null>(null);
  const [showAllMissing, setShowAllMissing] = useState(false);

  const loadDashboard = useCallback(async (isCurrent: () => boolean = () => true) => {
    const today = todayLocal();
    const [budget, settings] = await Promise.all([getBudgetForDate(today), getSettings()]);
    if (!budget) {
      router.replace('/new-cycle');
      return;
    }
    const [rows, totals, savings] = await Promise.all([
      getTransactions(budget.cycleStart, budget.cycleEnd),
      getDayTotals(budget.cycleStart, budget.cycleEnd),
      getSavingsEntries(budget.cycleStart, budget.cycleEnd),
    ]);
    if (!isCurrent()) return;
    setData({
      currencySymbol: settings?.currencySymbol ?? '₹',
      values: getDashboard({
        today,
        cycleStart: budget.cycleStart,
        cycleEnd: budget.cycleEnd,
        spendingBudget: budget.spendingBudget,
        transactions: toBudgetTransactions(rows),
        dayTotals: totals,
      }),
      missingDays: getMissingDays(
        { start: budget.cycleStart, end: budget.cycleEnd },
        today,
        rows,
        totals,
      ),
      savingsLogged: savings.reduce((sum, entry) => sum + entry.amount, 0),
      savingsTarget: budget.savingsTarget,
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      let current = true;
      void loadDashboard(() => current);
      return () => {
        current = false;
      };
    }, [loadDashboard]),
  );

  async function markNothingSpent(date: string) {
    try {
      await saveDayTotal(date, 0);
      setData((current) =>
        current ? { ...current, missingDays: current.missingDays.filter((day) => day !== date) } : current,
      );
    } catch (error) {
      Alert.alert('Couldn’t save the day', (error as Error).message);
    }
  }

  if (!data) {
    return (
      <Screen>
        <Loading label="Calculating today…" />
      </Screen>
    );
  }

  const { values, currencySymbol } = data;
  const visibleMissing = showAllMissing ? data.missingDays : data.missingDays.slice(0, 3);
  const savingsProgress =
    data.savingsTarget > 0 ? Math.min(1, data.savingsLogged / data.savingsTarget) : 0;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.hero}>
          <AppText muted style={styles.eyebrow}>YOU CAN SPEND TODAY</AppText>
          <Text style={[styles.allowance, { color: theme.text }]}>
            {formatMoney(values.allowance, currencySymbol)}
          </Text>
          <AppText muted>{values.daysLeft} days left, including today</AppText>
        </Card>

        <View style={styles.row}>
          <Card style={styles.halfCard}>
            <AppText muted>Spent today</AppText>
            <Text style={[styles.metric, { color: theme.text }]}>
              {formatMoney(values.spentToday, currencySymbol)}
            </Text>
          </Card>
          <Card style={styles.halfCard}>
            <AppText muted>{values.overToday > 0 ? 'Today' : 'Left today'}</AppText>
            <Text style={[styles.metric, { color: values.overToday > 0 ? theme.danger : theme.success }]}>
              {values.overToday > 0
                ? `Over by ${formatMoney(values.overToday, currencySymbol)}`
                : formatMoney(values.leftToday, currencySymbol)}
            </Text>
          </Card>
        </View>

        <Card>
          <AppText muted>Cycle budget left</AppText>
          <Text style={[styles.cycleAmount, { color: values.overspentAmount > 0 ? theme.danger : theme.text }]}>
            {values.overspentAmount > 0
              ? `Overspent by ${formatMoney(values.overspentAmount, currencySymbol)}`
              : formatMoney(values.cycleBudgetLeft, currencySymbol)}
          </Text>
          {values.unitemizedToday > 0 ? (
            <AppText muted>
              Today includes {formatMoney(values.unitemizedToday, currencySymbol)} unitemized.
            </AppText>
          ) : null}
          {values.entriesExceedDayTotal ? (
            <AppText style={{ color: theme.danger }}>
              Today’s entries exceed the saved day total, so entries are used.
            </AppText>
          ) : null}
        </Card>

        <Pressable onPress={() => router.push('/savings')}>
          <Card style={styles.savingsCard}>
            <View style={styles.cardHeading}>
              <AppText style={{ fontWeight: '800' }}>Savings</AppText>
              <AppText style={{ color: theme.primary, fontWeight: '800' }}>Manage</AppText>
            </View>
            <AppText style={{ fontWeight: '900', fontSize: 23 }}>
              {formatMoney(data.savingsLogged, currencySymbol)} / {formatMoney(data.savingsTarget, currencySymbol)}
            </AppText>
            <View style={[styles.track, { backgroundColor: theme.border }]}>
              <View style={[styles.fill, { backgroundColor: theme.success, width: `${savingsProgress * 100}%` }]} />
            </View>
            <AppText muted>Only savings you log are counted.</AppText>
          </Card>
        </Pressable>

        {data.missingDays.length > 0 ? (
          <Card style={styles.nudgeCard}>
            <View style={styles.cardHeading}>
              <View style={{ flex: 1 }}>
                <AppText style={{ fontWeight: '800' }}>Missing days</AppText>
                <AppText muted>Tell DailyBudget what happened on these days.</AppText>
              </View>
            </View>
            {visibleMissing.map((date) => (
              <View key={date} style={[styles.missingRow, { borderTopColor: theme.border }]}>
                <AppText style={{ fontWeight: '800' }}>{date}</AppText>
                <View style={styles.actions}>
                  <SmallAction
                    label="Add spending"
                    onPress={() =>
                      router.push({ pathname: '/add', params: { mode: 'transaction', date } })
                    }
                  />
                  <SmallAction label="Nothing spent" onPress={() => void markNothingSpent(date)} />
                </View>
              </View>
            ))}
            {data.missingDays.length > 3 ? (
              <SmallAction
                label={showAllMissing ? 'Show fewer' : `Show ${data.missingDays.length - 3} more`}
                onPress={() => setShowAllMissing((value) => !value)}
              />
            ) : null}
          </Card>
        ) : null}

        <Pressable onPress={() => router.push('/summary')}>
          <Card style={styles.summaryLink}>
            <View style={{ flex: 1 }}>
              <AppText style={{ fontWeight: '800' }}>Cycle summary</AppText>
              <AppText muted>Spending, categories, averages, and past cycles</AppText>
            </View>
            <Text style={{ color: theme.primary, fontSize: 24 }}>›</Text>
          </Card>
        </Pressable>
      </ScrollView>

      <Pressable
        accessibilityLabel="Add spending"
        accessibilityRole="button"
        onPress={() => router.push('/add')}
        style={({ pressed }) => [styles.fab, { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 }]}
      >
        <Text style={[styles.plus, { color: theme.primaryText }]}>+</Text>
      </Pressable>
    </Screen>
  );
}

function SmallAction({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.smallAction,
        { borderColor: theme.border, backgroundColor: theme.surface, opacity: pressed ? 0.65 : 1 },
      ]}
    >
      <Text style={{ color: theme.text, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 110, gap: 16 },
  hero: { alignItems: 'center', gap: 8, paddingVertical: 30 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  allowance: { fontSize: 50, lineHeight: 58, fontWeight: '900', letterSpacing: -1.5 },
  row: { flexDirection: 'row', gap: 12 },
  halfCard: { flex: 1, gap: 8, minHeight: 125 },
  metric: { fontSize: 20, lineHeight: 26, fontWeight: '800' },
  cycleAmount: { fontSize: 28, lineHeight: 36, fontWeight: '800', marginTop: 8, marginBottom: 6 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  savingsCard: { gap: 10 },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  nudgeCard: { gap: 12 },
  missingRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 9 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  smallAction: { minHeight: 42, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  summaryLink: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fab: { position: 'absolute', right: 22, bottom: 24, width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', elevation: 8 },
  plus: { fontSize: 40, lineHeight: 44, fontWeight: '500' },
});
