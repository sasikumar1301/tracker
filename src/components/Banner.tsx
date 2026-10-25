import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from './ui';

interface BannerContextValue {
  showBanner: (message: string) => void;
}

const BannerContext = createContext<BannerContextValue | null>(null);

export function BannerProvider({ children }: PropsWithChildren) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState('');
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, []);

  function showBanner(nextMessage: string) {
    if (timeout.current) clearTimeout(timeout.current);
    setMessage(nextMessage);
    timeout.current = setTimeout(() => setMessage(''), 5_000);
  }

  return (
    <BannerContext.Provider value={{ showBanner }}>
      {children}
      {message ? (
        <Pressable
          accessibilityRole="alert"
          onPress={() => setMessage('')}
          style={[
            styles.banner,
            {
              top: insets.top + 8,
              backgroundColor: theme.text,
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={[styles.text, { color: theme.background }]}>{message}</Text>
        </Pressable>
      ) : null}
    </BannerContext.Provider>
  );
}

export function useBanner(): BannerContextValue {
  const value = useContext(BannerContext);
  if (!value) throw new Error('useBanner must be used inside BannerProvider.');
  return value;
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
    elevation: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  text: { fontSize: 15, lineHeight: 21, fontWeight: '800' },
});
