import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  useColorScheme,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export interface AppTheme {
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  primaryText: string;
  danger: string;
  success: string;
}

export function useAppTheme(): AppTheme {
  const dark = useColorScheme() === 'dark';
  return dark
    ? {
        background: '#101311',
        surface: '#1A201C',
        text: '#F5F7F5',
        muted: '#A8B1AA',
        border: '#344039',
        primary: '#F4B942',
        primaryText: '#241A03',
        danger: '#FF7B7B',
        success: '#79D69C',
      }
    : {
        background: '#F5F7F2',
        surface: '#FFFFFF',
        text: '#172019',
        muted: '#667168',
        border: '#DDE3DE',
        primary: '#E9A91C',
        primaryText: '#201600',
        danger: '#C73737',
        success: '#197A42',
      };
}

export function Screen({ children }: PropsWithChildren) {
  const theme = useAppTheme();
  return <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>{children}</SafeAreaView>;
}

export function ScrollScreen({ children }: PropsWithChildren) {
  const theme = useAppTheme();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function AppText({
  children,
  muted = false,
  style,
}: PropsWithChildren<{ muted?: boolean; style?: object }>) {
  const theme = useAppTheme();
  return <Text style={[styles.text, { color: muted ? theme.muted : theme.text }, style]}>{children}</Text>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.muted}
        {...props}
        style={[
          styles.input,
          { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface },
          props.style,
        ]}
      />
    </View>
  );
}

export function MoneyField(props: TextInputProps & { label: string; symbol: string }) {
  return (
    <Field
      keyboardType="decimal-pad"
      placeholder={`${props.symbol}0`}
      {...props}
      label={`${props.label} (${props.symbol})`}
    />
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  tone = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'danger' | 'neutral';
}) {
  const theme = useAppTheme();
  const backgroundColor =
    tone === 'danger' ? theme.danger : tone === 'neutral' ? theme.surface : theme.primary;
  const color = tone === 'primary' ? theme.primaryText : tone === 'danger' ? '#FFFFFF' : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          borderColor: tone === 'neutral' ? theme.border : backgroundColor,
          opacity: disabled ? 0.45 : pressed ? 0.78 : 1,
        },
      ]}
    >
      <Text style={[styles.buttonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.primary : theme.surface,
          borderColor: selected ? theme.primary : theme.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text style={{ color: selected ? theme.primaryText : theme.text, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function SectionTitle({ children }: PropsWithChildren) {
  const theme = useAppTheme();
  return <Text style={[styles.sectionTitle, { color: theme.text }]}>{children}</Text>;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={theme.primary} size="large" />
      <Text style={{ color: theme.muted }}>{label}</Text>
    </View>
  );
}

export function EmptyState({ icon, children }: PropsWithChildren<{ icon: ReactNode }>) {
  return (
    <View style={styles.empty}>
      {icon}
      <AppText muted style={{ textAlign: 'center' }}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 48, gap: 16 },
  card: { borderRadius: 20, borderWidth: 1, padding: 18 },
  text: { fontSize: 16, lineHeight: 23 },
  fieldWrap: { gap: 7 },
  label: { fontSize: 13, fontWeight: '700' },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 15, fontSize: 17 },
  button: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  buttonText: { fontSize: 17, fontWeight: '800' },
  chip: {
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 21, lineHeight: 27, fontWeight: '800' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  empty: { flex: 1, minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 12 },
});
