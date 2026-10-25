import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import {
  AppText,
  Card,
  Chip,
  EmptyState,
  Field,
  Loading,
  Screen,
  useAppTheme,
} from '@/components/ui';
import {
  getCategories,
  getDayTotals,
  getSettings,
  getTransactions,
  toBudgetTransactions,
  type TransactionWithCategory,
} from '@/db/queries';
import type { Category, DayTotal } from '@/db/schema';
import { spentOnDay } from '@/lib/budget';
import { formatMoney } from '@/lib/money';

interface ListData {
  transactions: TransactionWithCategory[];
  totals: DayTotal[];
  categories: Category[];
  currencySymbol: string;
}

export default function TransactionsScreen() {
  const theme = useAppTheme();
  const [data, setData] = useState<ListData | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useFocusEffect(
    useCallback(() => {
      let current = true;
      Promise.all([getTransactions(), getDayTotals(), getCategories(), getSettings()]).then(
        ([transactions, totals, categories, settings]) => {
          if (!current) return;
          setData({
            transactions,
            totals,
            categories,
            currencySymbol: settings?.currencySymbol ?? '₹',
          });
        },
      );
      return () => {
        current = false;
      };
    }, []),
  );

  const groups = useMemo(() => {
    if (!data) return [];
    const dateMatches = (date: string) =>
      (!startDate || date >= startDate) && (!endDate || date <= endDate);
    const filteredTransactions = data.transactions.filter(
      (row) => dateMatches(row.date) && (categoryId == null || row.categoryId === categoryId),
    );
    const totals = categoryId == null ? data.totals.filter((row) => dateMatches(row.date)) : [];
    const dates = new Set([
      ...filteredTransactions.map((row) => row.date),
      ...totals.map((row) => row.date),
    ]);
    return [...dates]
      .sort((a, b) => b.localeCompare(a))
      .map((date) => ({
        date,
        transactions: filteredTransactions.filter((row) => row.date === date),
        total: totals.find((row) => row.date === date) ?? null,
      }));
  }, [categoryId, data, endDate, startDate]);

  if (!data) {
    return (
      <Screen>
        <Loading label="Loading entries…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.filters}>
          <AppText style={{ fontWeight: '800' }}>Filters</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="All" selected={categoryId == null} onPress={() => setCategoryId(null)} />
            {data.categories.map((category) => (
              <Chip
                key={category.id}
                label={category.name}
                selected={categoryId === category.id}
                onPress={() => setCategoryId(category.id)}
              />
            ))}
          </ScrollView>
          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <Field
                label="From"
                placeholder="YYYY-MM-DD"
                value={startDate}
                onChangeText={setStartDate}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="To"
                placeholder="YYYY-MM-DD"
                value={endDate}
                onChangeText={setEndDate}
              />
            </View>
          </View>
        </Card>

        {groups.length === 0 ? (
          <EmptyState icon={<Text style={styles.emptyIcon}>₹</Text>}>
            No entries match these filters.
          </EmptyState>
        ) : (
          groups.map((group) => {
            const detail = spentOnDay(
              group.date,
              toBudgetTransactions(group.transactions),
              group.total?.amount,
            );
            return (
              <View key={group.date} style={styles.dayGroup}>
                <View style={styles.dayHeader}>
                  <AppText style={{ fontWeight: '800' }}>{group.date}</AppText>
                  <AppText style={{ fontWeight: '800' }}>
                    {formatMoney(detail.spent, data.currencySymbol)}
                  </AppText>
                </View>
                <Card style={styles.entriesCard}>
                  {group.transactions.map((transaction) => (
                    <Pressable
                      key={transaction.id}
                      onPress={() =>
                        router.push({ pathname: '/add', params: { id: String(transaction.id) } })
                      }
                      style={({ pressed }) => [
                        styles.entry,
                        { borderBottomColor: theme.border, opacity: pressed ? 0.65 : 1 },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <AppText style={{ fontWeight: '700' }}>
                          {transaction.description || transaction.note || transaction.categoryName}
                        </AppText>
                        <AppText muted>
                          {transaction.type === 'refund'
                            ? `Refund · ${transaction.categoryName}`
                            : transaction.categoryName}
                        </AppText>
                      </View>
                      <Text
                        style={[
                          styles.amount,
                          { color: transaction.type === 'refund' ? theme.success : theme.text },
                        ]}
                      >
                        {transaction.type === 'refund' ? '−' : ''}
                        {formatMoney(transaction.amount, data.currencySymbol)}
                      </Text>
                    </Pressable>
                  ))}
                  {group.total ? (
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: '/add',
                          params: { mode: 'day-total', date: group.date },
                        })
                      }
                      style={({ pressed }) => [
                        styles.entry,
                        { borderBottomColor: theme.border, opacity: pressed ? 0.65 : 1 },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <AppText style={{ fontWeight: '700' }}>Day total</AppText>
                        <AppText muted>Tap to edit</AppText>
                      </View>
                      <AppText style={{ fontWeight: '800' }}>
                        {formatMoney(group.total.amount, data.currencySymbol)}
                      </AppText>
                    </Pressable>
                  ) : null}
                  {detail.unitemized > 0 ? (
                    <View style={[styles.entry, { borderBottomWidth: 0 }]}>
                      <AppText muted style={{ flex: 1 }}>
                        Unitemized
                      </AppText>
                      <AppText muted style={{ fontWeight: '800' }}>
                        {formatMoney(detail.unitemized, data.currencySymbol)}
                      </AppText>
                    </View>
                  ) : null}
                  {detail.entriesExceedDayTotal ? (
                    <AppText style={{ color: theme.danger, paddingTop: 12 }}>
                      Entries exceed the day total; entries are used.
                    </AppText>
                  ) : null}
                </Card>
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, gap: 18 },
  filters: { gap: 14 },
  chips: { gap: 8 },
  dateRow: { flexDirection: 'row', gap: 10 },
  dayGroup: { gap: 8 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  entriesCard: { paddingVertical: 4 },
  entry: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  amount: { fontSize: 16, fontWeight: '800' },
  emptyIcon: { fontSize: 42, fontWeight: '800', opacity: 0.35 },
});
