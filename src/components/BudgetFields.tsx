import { StyleSheet, View } from 'react-native';

import { MoneyField } from './ui';

export interface BudgetFieldValues {
  salary: string;
  fixedExpenses: string;
  savingsTarget: string;
  spendingBudget: string;
}

export function BudgetFields({
  values,
  symbol,
  onChange,
}: {
  values: BudgetFieldValues;
  symbol: string;
  onChange: (field: keyof BudgetFieldValues, value: string) => void;
}) {
  return (
    <View style={styles.fields}>
      <MoneyField
        label="Salary"
        symbol={symbol}
        value={values.salary}
        onChangeText={(value) => onChange('salary', value)}
      />
      <MoneyField
        label="Fixed expenses"
        symbol={symbol}
        value={values.fixedExpenses}
        onChangeText={(value) => onChange('fixedExpenses', value)}
      />
      <MoneyField
        label="Savings target"
        symbol={symbol}
        value={values.savingsTarget}
        onChangeText={(value) => onChange('savingsTarget', value)}
      />
      <MoneyField
        label="Everyday budget"
        symbol={symbol}
        value={values.spendingBudget}
        onChangeText={(value) => onChange('spendingBudget', value)}
      />
    </View>
  );
}

const styles = StyleSheet.create({ fields: { gap: 14 } });
