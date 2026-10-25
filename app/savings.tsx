import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import {
  AppText,
  Card,
  Field,
  Loading,
  MoneyField,
  PrimaryButton,
  Screen,
  ScrollScreen,
  SectionTitle,
  useAppTheme,
} from '@/components/ui';
import {
  deleteSavingsEntry,
  getBudgetForDate,
  getSavingsEntries,
  getSettings,
  saveSavingsEntry,
} from '@/db/queries';
import type { Budget, SavingsEntry } from '@/db/schema';
import { isLocalDate, todayLocal } from '@/lib/date';
import { formatMoney, parseRupeesToPaise } from '@/lib/money';

interface SavingsData {
  budget: Budget;
  entries: SavingsEntry[];
  currencySymbol: string;
}

export default function SavingsScreen() {
  const theme = useAppTheme();
  const [data, setData] = useState<SavingsData | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayLocal());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [budget, settings] = await Promise.all([getBudgetForDate(todayLocal()), getSettings()]);
    if (!budget) return;
    const entries = await getSavingsEntries(budget.cycleStart, budget.cycleEnd);
    setData({ budget, entries, currencySymbol: settings?.currencySymbol ?? '₹' });
  }, []);

  useFocusEffect(useCallback(() => void load(), [load]));

  async function save() {
    if (!data) return;
    const paise = parseRupeesToPaise(amount);
    if (
      paise == null ||
      paise <= 0 ||
      !isLocalDate(date) ||
      date < data.budget.cycleStart ||
      date > data.budget.cycleEnd
    ) {
      Alert.alert('Check the saving', 'Enter a positive amount and a date in the current cycle.');
      return;
    }
    try {
      setSaving(true);
      await saveSavingsEntry({ date, amount: paise, note: note.trim() || null });
      setAmount('');
      setNote('');
      await load();
    } catch (error) {
      Alert.alert('Couldn’t save this entry', (error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(entry: SavingsEntry) {
    Alert.alert('Delete this savings entry?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteSavingsEntry(entry.id)
            .then(load)
            .catch((error: Error) => Alert.alert('Couldn’t delete entry', error.message));
        },
      },
    ]);
  }

  if (!data) {
    return (
      <Screen>
        <Loading label="Loading savings…" />
      </Screen>
    );
  }

  const logged = data.entries.reduce((sum, entry) => sum + entry.amount, 0);
  return (
    <ScrollScreen>
      <Card style={styles.totalCard}>
        <AppText muted>Logged this cycle</AppText>
        <AppText style={{ fontSize: 28, fontWeight: '900' }}>
          {formatMoney(logged, data.currencySymbol)} / {formatMoney(data.budget.savingsTarget, data.currencySymbol)}
        </AppText>
        <AppText muted>Unspent everyday budget is not counted automatically.</AppText>
      </Card>

      <View style={styles.section}>
        <SectionTitle>I saved money</SectionTitle>
        <MoneyField
          label="Amount saved"
          symbol={data.currencySymbol}
          value={amount}
          onChangeText={setAmount}
        />
        <Field label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
        <Field label="Note (optional)" value={note} onChangeText={setNote} />
        <PrimaryButton
          label={saving ? 'Saving…' : amount ? `I saved ${data.currencySymbol}${amount}` : 'Save entry'}
          onPress={() => void save()}
          disabled={saving}
        />
      </View>

      <View style={styles.section}>
        <SectionTitle>Entries</SectionTitle>
        {data.entries.length === 0 ? <AppText muted>No savings logged this cycle.</AppText> : null}
        {data.entries.map((entry) => (
          <Card key={entry.id} style={styles.entry}>
            <View style={{ flex: 1 }}>
              <AppText style={{ fontWeight: '800' }}>
                {formatMoney(entry.amount, data.currencySymbol)}
              </AppText>
              <AppText muted>{entry.date}{entry.note ? ` · ${entry.note}` : ''}</AppText>
            </View>
            <Pressable onPress={() => confirmDelete(entry)} hitSlop={10}>
              <AppText style={{ color: theme.danger, fontWeight: '800' }}>Delete</AppText>
            </Pressable>
          </Card>
        ))}
      </View>
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  totalCard: { gap: 7 },
  section: { gap: 14 },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 15 },
});
