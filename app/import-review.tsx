import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import {
  AppText,
  Card,
  Chip,
  Field,
  Loading,
  MoneyField,
  PrimaryButton,
  Screen,
  SectionTitle,
  useAppTheme,
} from '@/components/ui';
import {
  getMerchantRules,
  getTransactionsForDedupe,
  saveImportedTransactions,
  type ImportRuleUpdate,
  type ImportSaveRow,
} from '@/db/importQueries';
import { getCategories, getSettings } from '@/db/queries';
import type { Category } from '@/db/schema';
import { categorizeDescription, normalizeMerchantKeyword } from '@/import/categorize';
import {
  assignFingerprints,
  findDuplicateMatches,
  type DuplicateMatch,
  type ExistingTransactionForDedupe,
} from '@/import/dedupe';
import { deletePickerCacheFiles } from '@/import/files';
import type { ImportDirection } from '@/import/parser';
import { clearImportSession, getImportSession, type ImportNotice } from '@/import/session';
import { isLocalDate } from '@/lib/date';
import { paiseToInput, parseRupeesToPaise } from '@/lib/money';

type DuplicateAction = ImportSaveRow['duplicateAction'];

interface ReviewRow {
  id: string;
  date: string;
  description: string;
  amount: number | null;
  amountText: string;
  direction: ImportDirection;
  uncertain: boolean;
  raw: string;
  categoryId: number;
  categoryKeyword: string;
  categoryChanged: boolean;
  selected: boolean;
  treatAsRefund: boolean;
  fingerprint: string;
  duplicate: DuplicateMatch;
  duplicateAction: DuplicateAction;
}

interface ReviewData {
  categories: Category[];
  currencySymbol: string;
  notices: ImportNotice[];
}

function rebuildDuplicates(
  rows: readonly ReviewRow[],
  existing: readonly ExistingTransactionForDedupe[],
): ReviewRow[] {
  const fingerprinted = assignFingerprints(
    rows.map((row) => ({
      date: row.date,
      amount: row.amount ?? -1,
      description: row.description,
    })),
  );
  const matches = findDuplicateMatches(fingerprinted, existing);
  return rows.map((row, index) => {
    const match = matches[index]!;
    const previousKind = row.duplicate.kind;
    const changedMatch = previousKind !== match.kind;
    let selected = row.selected;
    let duplicateAction = row.duplicateAction;
    if (match.kind === 'already-imported') {
      selected = false;
      duplicateAction = 'insert';
    } else if (match.kind === 'manual-match' && changedMatch) {
      selected = false;
      duplicateAction = 'insert';
    } else if (match.kind === 'none' && previousKind === 'already-imported') {
      selected = row.direction === 'debit' && !row.uncertain;
      duplicateAction = 'insert';
    }
    return {
      ...row,
      fingerprint: fingerprinted[index]!.fingerprint,
      duplicate: match,
      duplicateAction,
      selected,
    };
  });
}

export default function ImportReviewScreen() {
  const params = useLocalSearchParams<{ session?: string }>();
  const sessionId = params.session ?? '';
  const theme = useAppTheme();
  const [data, setData] = useState<ReviewData | null>(null);
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [existing, setExisting] = useState<ExistingTransactionForDedupe[]>([]);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const cleaned = useRef(false);

  useEffect(() => {
    let current = true;
    const session = getImportSession(sessionId);
    if (!session) {
      setLoadError('This import session has ended. Choose the screenshots again.');
      return;
    }

    Promise.all([getCategories(), getSettings(), getMerchantRules(), getTransactionsForDedupe()])
      .then(([categories, settings, rules, existingRows]) => {
        if (!current) return;
        const initial: ReviewRow[] = session.rows.map((row, index) => {
          const category = categorizeDescription(row.description, rules, categories);
          return {
            ...row,
            id: String(index),
            amountText: paiseToInput(row.amount),
            categoryId: category.categoryId,
            categoryKeyword: category.keyword,
            categoryChanged: false,
            selected: row.direction === 'debit' && !row.uncertain,
            treatAsRefund: false,
            fingerprint: '',
            duplicate: { kind: 'none' },
            duplicateAction: 'insert',
          };
        });
        setExisting(existingRows);
        setRows(rebuildDuplicates(initial, existingRows));
        setData({
          categories,
          currencySymbol: settings?.currencySymbol ?? '₹',
          notices: session.notices,
        });
      })
      .catch((error: Error) => current && setLoadError(error.message));

    return () => {
      current = false;
    };
  }, [sessionId]);

  useEffect(() => {
    return () => {
      if (cleaned.current) return;
      cleaned.current = true;
      void deletePickerCacheFiles(clearImportSession(sessionId));
    };
  }, [sessionId]);

  const groups = useMemo(() => {
    if (!rows) return [];
    const values = new Map<string, ReviewRow[]>();
    for (const row of rows) {
      const label = row.date || 'Date missing';
      values.set(label, [...(values.get(label) ?? []), row]);
    }
    return [...values.entries()];
  }, [rows]);

  function updateRow(id: string, values: Partial<ReviewRow>) {
    setRows((current) => {
      if (!current) return current;
      const updated = current.map((row) => (row.id === id ? { ...row, ...values } : row));
      return rebuildDuplicates(updated, existing);
    });
  }

  function toggleRow(row: ReviewRow) {
    if (row.duplicate.kind !== 'none') return;
    updateRow(row.id, {
      selected: !row.selected,
      treatAsRefund: row.direction === 'credit' ? !row.selected : row.treatAsRefund,
    });
  }

  function selectDuplicateAction(row: ReviewRow, action: 'merge' | 'keep') {
    updateRow(row.id, { duplicateAction: action, selected: true });
  }

  function selectAllDebits() {
    setRows((current) =>
      current?.map((row) => ({
        ...row,
        selected:
          row.direction === 'debit' &&
          !row.uncertain &&
          row.duplicate.kind === 'none' &&
          row.amount != null &&
          isLocalDate(row.date)
            ? true
            : row.selected,
      })) ?? current,
    );
  }

  async function cleanSessionFiles() {
    if (cleaned.current) return;
    cleaned.current = true;
    await deletePickerCacheFiles(clearImportSession(sessionId));
  }

  async function save() {
    if (!rows || !data) return;
    const invalid = rows.find(
      (row) =>
        row.selected &&
        (!isLocalDate(row.date) || row.amount == null || row.amount <= 0 || !row.description.trim()),
    );
    if (invalid) {
      Alert.alert(
        'Check selected transactions',
        'Every selected transaction needs a valid date, positive amount, and description.',
      );
      return;
    }

    const rowsToCheck = rows.filter(
      (row) => row.selected || row.duplicate.kind === 'already-imported' || row.duplicate.kind === 'manual-match',
    );
    const saveRows: ImportSaveRow[] = rowsToCheck.map((row) => ({
      date: row.date,
      amount: row.amount!,
      description: row.description.trim(),
      fingerprint: row.fingerprint,
      categoryId: row.categoryId,
      type: row.direction === 'credit' || row.treatAsRefund ? 'refund' : 'expense',
      duplicateAction: row.duplicateAction,
    }));
    const ruleMap = new Map<string, ImportRuleUpdate>();
    for (const row of rows) {
      if (row.selected && row.categoryChanged && row.categoryKeyword) {
        ruleMap.set(row.categoryKeyword, {
          keyword: row.categoryKeyword,
          categoryId: row.categoryId,
        });
      }
    }

    try {
      setSaving(true);
      const result = await saveImportedTransactions(saveRows, [...ruleMap.values()]);
      const creditsIgnored = rows.filter((row) => row.direction === 'credit' && !row.selected).length;
      await cleanSessionFiles();
      const summary = [
        `${result.added} added`,
        `${result.duplicatesSkipped} duplicates skipped`,
        `${creditsIgnored} credits ignored`,
      ];
      if (result.merged > 0) summary.push(`${result.merged} merged`);
      Alert.alert('Import complete', summary.join('\n'), [
        { text: 'Done', onPress: () => router.replace('/transactions') },
      ], { cancelable: false });
    } catch (error) {
      Alert.alert('Couldn’t save import', (error as Error).message);
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <Screen>
        <View style={styles.center}>
          <SectionTitle>Import unavailable</SectionTitle>
          <AppText muted style={{ textAlign: 'center' }}>{loadError}</AppText>
          <PrimaryButton label="Back" onPress={() => router.back()} tone="neutral" />
        </View>
      </Screen>
    );
  }
  if (!data || !rows) {
    return (
      <Screen>
        <Loading label="Preparing review…" />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.reviewHeader}>
          <View style={{ flex: 1, gap: 3 }}>
            <SectionTitle>Review transactions</SectionTitle>
            <AppText muted>{rows.filter((row) => row.selected).length} selected</AppText>
          </View>
          <Pressable onPress={selectAllDebits} style={styles.textButton}>
            <Text style={{ color: theme.primary, fontWeight: '800' }}>Select all debits</Text>
          </Pressable>
        </View>

        {data.notices.map((notice, index) => (
          <Card key={`${notice.imageName}-${index}`} style={styles.notice}>
            <AppText style={{ fontWeight: '700' }}>{notice.imageName}</AppText>
            <AppText muted>{notice.message}</AppText>
          </Card>
        ))}

        {groups.map(([dateLabel, groupRows]) => (
          <View key={dateLabel} style={styles.group}>
            <AppText style={{ fontWeight: '800' }}>{dateLabel}</AppText>
            {groupRows.map((row) => (
              <Card key={row.id} style={styles.rowCard}>
                <View style={styles.rowHeading}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: row.selected, disabled: row.duplicate.kind !== 'none' }}
                    onPress={() => toggleRow(row)}
                    style={[
                      styles.checkbox,
                      {
                        borderColor: row.selected ? theme.primary : theme.border,
                        backgroundColor: row.selected ? theme.primary : theme.surface,
                        opacity: row.duplicate.kind === 'none' ? 1 : 0.55,
                      },
                    ]}
                  >
                    <Text style={{ color: row.selected ? theme.primaryText : theme.text, fontWeight: '900' }}>
                      {row.selected ? '✓' : ''}
                    </Text>
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <AppText style={{ fontWeight: '800' }}>{row.description}</AppText>
                    <AppText muted>{directionLabel(row)}</AppText>
                  </View>
                </View>

                <View style={styles.badges}>
                  {row.uncertain ? <StatusBadge label="Check this" color={theme.danger} /> : null}
                  {row.duplicate.kind === 'already-imported' ? (
                    <StatusBadge label="Already imported" color={theme.muted} />
                  ) : null}
                  {row.duplicate.kind === 'manual-match' ? (
                    <StatusBadge label="Looks like one you added" color={theme.danger} />
                  ) : null}
                </View>

                {row.duplicate.kind === 'manual-match' ? (
                  <View style={styles.chips}>
                    <Chip
                      label="Merge"
                      selected={row.duplicateAction === 'merge'}
                      onPress={() => selectDuplicateAction(row, 'merge')}
                    />
                    <Chip
                      label="Keep both"
                      selected={row.duplicateAction === 'keep'}
                      onPress={() => selectDuplicateAction(row, 'keep')}
                    />
                  </View>
                ) : null}

                <Field
                  label="Description"
                  value={row.description}
                  onChangeText={(description) =>
                    updateRow(row.id, {
                      description,
                      categoryKeyword: normalizeMerchantKeyword(description),
                    })
                  }
                />
                <View style={styles.fieldRow}>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Date"
                      value={row.date}
                      placeholder="YYYY-MM-DD"
                      onChangeText={(date) => updateRow(row.id, { date })}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <MoneyField
                      label="Amount"
                      symbol={data.currencySymbol}
                      value={row.amountText}
                      onChangeText={(amountText) =>
                        updateRow(row.id, {
                          amountText,
                          amount: parseRupeesToPaise(amountText),
                        })
                      }
                    />
                  </View>
                </View>
                <AppText muted style={{ fontWeight: '700' }}>Category</AppText>
                <View style={styles.chips}>
                  {data.categories.map((category) => (
                    <Chip
                      key={category.id}
                      label={category.name}
                      selected={row.categoryId === category.id}
                      onPress={() =>
                        updateRow(row.id, { categoryId: category.id, categoryChanged: true })
                      }
                    />
                  ))}
                </View>
              </Card>
            ))}
          </View>
        ))}

        <PrimaryButton
          label={saving ? 'Saving import…' : `Save ${rows.filter((row) => row.selected).length} transactions`}
          onPress={() => void save()}
          disabled={saving}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function directionLabel(row: ReviewRow): string {
  if (row.direction === 'credit') {
    return row.selected ? 'Credit · will be saved as a refund' : 'Credit · Ignored';
  }
  if (row.direction === 'debit') return 'Debit';
  return 'Direction uncertain';
}

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={{ color, fontSize: 12, fontWeight: '800' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48, gap: 18 },
  center: { flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center', gap: 16 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  textButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  notice: { gap: 3, padding: 14 },
  group: { gap: 10 },
  rowCard: { gap: 14 },
  rowHeading: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  checkbox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  badge: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
  fieldRow: { flexDirection: 'row', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
