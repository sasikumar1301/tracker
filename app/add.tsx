import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';

import {
  AppText,
  Chip,
  Field,
  MoneyField,
  PrimaryButton,
  SectionTitle,
  useAppTheme,
} from '@/components/ui';
import { useBanner } from '@/components/Banner';
import { getDashboardAlertSnapshot } from '@/db/habitQueries';
import {
  deleteTransaction,
  getCategories,
  getDayTotal,
  getSettings,
  getTransaction,
  saveDayTotal,
  saveTransaction,
} from '@/db/queries';
import type { Category } from '@/db/schema';
import { deletePickerCacheFiles } from '@/import/files';
import { recognizeImage } from '@/import/ocr';
import { parseRecognizedLines, type ParsedImportRow } from '@/import/parser';
import { createImportSession, type ImportNotice } from '@/import/session';
import { isLocalDate, todayLocal } from '@/lib/date';
import { getCrossedExpenseAlerts } from '@/lib/habits';
import { paiseToInput, parseRupeesToPaise } from '@/lib/money';

type AddMode = 'choices' | 'transaction' | 'day-total' | 'importing';

interface ImportProgress {
  name: string;
  state: 'waiting' | 'reading' | 'done' | 'skipped';
}

export default function AddScreen() {
  const params = useLocalSearchParams<{ id?: string; mode?: string; date?: string }>();
  const theme = useAppTheme();
  const { showBanner } = useBanner();
  const editingId = params.id ? Number(params.id) : undefined;
  const [mode, setMode] = useState<AddMode>(
    editingId || params.mode === 'transaction'
      ? 'transaction'
      : params.mode === 'day-total'
        ? 'day-total'
        : 'choices',
  );
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [categories, setCategories] = useState<Category[]>([]);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(params.date ?? todayLocal());
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [isRefund, setIsRefund] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress[]>([]);
  const importUris = useRef<string[]>([]);
  const importHandedOff = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    return () => {
      mounted.current = false;
      if (!importHandedOff.current) void deletePickerCacheFiles(importUris.current);
    };
  }, []);

  useEffect(() => {
    Promise.all([getCategories(), getSettings()]).then(([categoryRows, appSettings]) => {
      setCategories(categoryRows);
      setCurrencySymbol(appSettings?.currencySymbol ?? '₹');
      if (!editingId) setCategoryId(categoryRows[0]?.id ?? null);
    });
    if (editingId) {
      getTransaction(editingId).then((transaction) => {
        if (!transaction) return;
        setAmount(paiseToInput(transaction.amount));
        setDate(transaction.date);
        setCategoryId(transaction.categoryId);
        setIsRefund(transaction.type === 'refund');
        setNote(transaction.note ?? transaction.description ?? '');
      });
    } else if (params.mode === 'day-total') {
      getDayTotal(params.date ?? todayLocal()).then((total) => {
        if (total) setAmount(paiseToInput(total.amount));
      });
    }
  }, [editingId, params.date, params.mode]);

  async function submitTransaction() {
    const paise = parseRupeesToPaise(amount);
    if (paise == null || paise <= 0 || !isLocalDate(date) || categoryId == null) {
      Alert.alert('Check the entry', 'Enter a positive amount, valid date, and category.');
      return;
    }
    try {
      setSaving(true);
      const today = todayLocal();
      const before = isRefund
        ? null
        : await getDashboardAlertSnapshot(today).catch(() => null);
      await saveTransaction({
        id: editingId,
        date,
        amount: paise,
        type: isRefund ? 'refund' : 'expense',
        categoryId,
        note: note.trim() || null,
      });
      const after = isRefund
        ? null
        : await getDashboardAlertSnapshot(today).catch(() => null);
      if (before && after) {
        const alerts = getCrossedExpenseAlerts(
          before.dashboard,
          after.dashboard,
          before.spendingBudget,
          before.thresholdPercent,
        );
        const messages = alerts.map((alert) =>
          alert === 'left-today'
            ? 'You’ve spent more than today’s allowance.'
            : `You’ve used ${before.thresholdPercent}% of this cycle’s budget.`,
        );
        if (messages.length > 0) showBanner(messages.join(' '));
      }
      router.back();
    } catch (error) {
      Alert.alert('Couldn’t save entry', (error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function submitDayTotal() {
    const paise = parseRupeesToPaise(amount);
    if (paise == null || !isLocalDate(date)) {
      Alert.alert('Check the total', 'Enter a non-negative amount and a valid date.');
      return;
    }
    try {
      setSaving(true);
      await saveDayTotal(date, paise);
      router.back();
    } catch (error) {
      Alert.alert('Couldn’t save day total', (error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!editingId) return;
    Alert.alert('Delete this entry?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteTransaction(editingId)
            .then(() => router.back())
            .catch((error: Error) => Alert.alert('Couldn’t delete entry', error.message));
        },
      },
    ]);
  }

  function updateProgress(index: number, state: ImportProgress['state']) {
    if (!mounted.current) return;
    setImportProgress((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, state } : item)),
    );
  }

  async function startScreenshotImport() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Photo access needed',
          'Allow photo access to choose screenshots. DailyBudget processes them only on this device.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 1,
        shouldDownloadFromNetwork: false,
      });
      if (result.canceled) return;

      const assets = result.assets.slice(0, 10);
      const uris = assets.map((asset) => asset.uri);
      importUris.current = uris;
      setMode('importing');
      setImportProgress(
        assets.map((asset, index) => ({
          name: asset.fileName ?? `Screenshot ${index + 1}`,
          state: 'waiting',
        })),
      );

      const rows: ParsedImportRow[] = [];
      const notices: ImportNotice[] = [];
      for (const [index, asset] of assets.entries()) {
        if (!mounted.current) break;
        const name = asset.fileName ?? `Screenshot ${index + 1}`;
        updateProgress(index, 'reading');
        try {
          const lines = await recognizeImage(asset.uri);
          if (!mounted.current) break;
          const parsed = parseRecognizedLines(lines, todayLocal());
          if (parsed.length === 0) {
            notices.push({ imageName: name, message: 'No transactions found in this image.' });
            updateProgress(index, 'skipped');
          } else {
            rows.push(...parsed);
            updateProgress(index, 'done');
          }
        } catch {
          notices.push({ imageName: name, message: 'Image could not be read and was skipped.' });
          updateProgress(index, 'skipped');
        }
      }

      if (!mounted.current) {
        await deletePickerCacheFiles(uris);
        return;
      }
      if (rows.length === 0) {
        await deletePickerCacheFiles(uris);
        importUris.current = [];
        setMode('choices');
        Alert.alert(
          'No transactions found',
          notices.map((notice) => `${notice.imageName}: ${notice.message}`).join('\n'),
        );
        return;
      }

      const session = createImportSession({ imageUris: uris, rows, notices });
      importHandedOff.current = true;
      router.replace({ pathname: '/import-review', params: { session: session.id } });
    } catch (error) {
      await deletePickerCacheFiles(importUris.current);
      importUris.current = [];
      if (mounted.current) {
        setMode('choices');
        Alert.alert('Couldn’t open screenshots', (error as Error).message);
      }
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.overlay}
    >
      <Pressable style={styles.backdrop} onPress={() => router.back()} />
      <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.headingRow}>
            <SectionTitle>
              {mode === 'choices'
                ? 'Add to DailyBudget'
                : mode === 'day-total'
                  ? 'Day total'
                  : mode === 'importing'
                    ? 'Reading screenshots'
                    : editingId
                      ? 'Edit entry'
                      : 'Expense or refund'}
            </SectionTitle>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text style={[styles.close, { color: theme.muted }]}>×</Text>
            </Pressable>
          </View>

          {mode === 'choices' ? (
            <View style={styles.options}>
              <OptionButton
                icon="+"
                title="Expense or refund"
                subtitle="Add an itemized entry"
                onPress={() => setMode('transaction')}
              />
              <OptionButton
                icon="="
                title="Day total"
                subtitle="Reconcile what you spent that day"
                onPress={() => setMode('day-total')}
              />
              <OptionButton
                icon="▧"
                title="Import screenshots"
                subtitle="Choose up to 10 images; processing stays on this device"
                onPress={() => void startScreenshotImport()}
              />
            </View>
          ) : null}

          {mode === 'transaction' ? (
            <View style={styles.form}>
              <MoneyField
                autoFocus={!editingId}
                label="Amount"
                symbol={currencySymbol}
                value={amount}
                onChangeText={setAmount}
              />
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontWeight: '800' }}>Refund</AppText>
                  <AppText muted>Subtract this amount from spending</AppText>
                </View>
                <Switch value={isRefund} onValueChange={setIsRefund} />
              </View>
              <View style={styles.form}>
                <AppText muted style={{ fontWeight: '700' }}>
                  Category
                </AppText>
                <View style={styles.chips}>
                  {categories.map((category) => (
                    <Chip
                      key={category.id}
                      label={category.name}
                      selected={categoryId === category.id}
                      onPress={() => setCategoryId(category.id)}
                    />
                  ))}
                </View>
              </View>
              <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
              <Field
                label="Note (optional)"
                value={note}
                onChangeText={setNote}
                multiline
                numberOfLines={3}
                style={{ minHeight: 84, textAlignVertical: 'top', paddingTop: 14 }}
              />
              <PrimaryButton
                label={saving ? 'Saving…' : editingId ? 'Save changes' : 'Add entry'}
                onPress={() => void submitTransaction()}
                disabled={saving}
              />
              {editingId ? (
                <PrimaryButton label="Delete entry" onPress={confirmDelete} tone="danger" />
              ) : null}
            </View>
          ) : null}

          {mode === 'day-total' ? (
            <View style={styles.form}>
              <MoneyField
                autoFocus
                label="Total spent"
                symbol={currencySymbol}
                value={amount}
                onChangeText={setAmount}
              />
              <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
              <AppText muted>
                If itemized entries are higher, DailyBudget uses the entries. Otherwise it adds an
                unitemized line for the difference.
              </AppText>
              <PrimaryButton
                label={saving ? 'Saving…' : 'Save day total'}
                onPress={() => void submitDayTotal()}
                disabled={saving}
              />
            </View>
          ) : null}

          {mode === 'importing' ? (
            <View style={styles.form}>
              <AppText muted>Keep this sheet open while text is read on your device.</AppText>
              {importProgress.map((item, index) => (
                <View key={`${item.name}-${index}`} style={styles.progressRow}>
                  <AppText style={{ flex: 1 }}>{item.name}</AppText>
                  <AppText muted>{progressLabel(item.state)}</AppText>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function progressLabel(state: ImportProgress['state']): string {
  if (state === 'reading') return 'Reading…';
  if (state === 'done') return 'Ready';
  if (state === 'skipped') return 'Skipped';
  return 'Waiting';
}

function OptionButton({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        {
          borderColor: theme.border,
          backgroundColor: theme.surface,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text style={[styles.optionIcon, { color: theme.primary }]}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <AppText style={{ fontWeight: '800' }}>{title}</AppText>
        <AppText muted>{subtitle}</AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.46)',
  },
  sheet: {
    maxHeight: '91%',
    minHeight: 330,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingTop: 10,
  },
  handle: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center' },
  content: { padding: 20, paddingBottom: 38, gap: 20 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { fontSize: 34, lineHeight: 36 },
  options: { gap: 12 },
  option: {
    minHeight: 78,
    borderWidth: 1,
    borderRadius: 18,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  optionIcon: { width: 34, textAlign: 'center', fontSize: 30, fontWeight: '600' },
  form: { gap: 16 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 42 },
});
