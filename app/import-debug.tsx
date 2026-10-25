import { useEffect, useRef, useState } from 'react';
import { Alert, Clipboard, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';

import {
  AppText,
  Card,
  Loading,
  PrimaryButton,
  ScrollScreen,
  SectionTitle,
} from '@/components/ui';
import { deletePickerCacheFiles } from '@/import/files';
import { recognizeImage, type RecognizedLine } from '@/import/ocr';

export default function ImportDebugScreen() {
  const [lines, setLines] = useState<RecognizedLine[]>([]);
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState('Choose one image to inspect the raw on-device OCR output.');
  const temporaryUris = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      void deletePickerCacheFiles(temporaryUris.current);
    };
  }, []);

  async function pickImage() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photo access needed', 'Allow photo access to run OCR diagnostics.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 1,
        shouldDownloadFromNetwork: false,
      });
      if (result.canceled) return;

      const uri = result.assets[0]?.uri;
      if (!uri) return;
      temporaryUris.current = [uri];
      setReading(true);
      setLines([]);
      const recognized = await recognizeImage(uri);
      setLines(recognized);
      setMessage(
        recognized.length === 0 ? 'No text was found in this image.' : `${recognized.length} raw lines found.`,
      );
      await deletePickerCacheFiles([uri]);
      temporaryUris.current = [];
    } catch (error) {
      await deletePickerCacheFiles(temporaryUris.current);
      temporaryUris.current = [];
      setMessage(`Image could not be read: ${(error as Error).message}`);
    } finally {
      setReading(false);
    }
  }

  function copyLines() {
    Clipboard.setString(lines.map((line) => line.text).join('\n'));
    Alert.alert('Copied', 'Raw OCR lines were copied to the clipboard.');
  }

  if (!__DEV__) {
    return (
      <ScrollScreen>
        <SectionTitle>Developer tool unavailable</SectionTitle>
        <AppText muted>OCR diagnostics are included only in development mode.</AppText>
        <PrimaryButton label="Back" onPress={() => router.back()} tone="neutral" />
      </ScrollScreen>
    );
  }

  if (reading) {
    return <Loading label="Reading image on device…" />;
  }

  return (
    <ScrollScreen>
      <View style={styles.heading}>
        <SectionTitle>Raw OCR lines</SectionTitle>
        <AppText muted>{message}</AppText>
      </View>
      <PrimaryButton label="Choose image" onPress={() => void pickImage()} />
      {lines.length > 0 ? (
        <>
          <PrimaryButton label="Copy raw text" onPress={copyLines} tone="neutral" />
          <Card style={styles.output}>
            {lines.map((line, index) => (
              <View key={`${line.text}-${index}`} style={styles.line}>
                <AppText muted style={styles.number}>{index + 1}</AppText>
                <AppText style={{ flex: 1 }}>{line.text}</AppText>
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 6 },
  output: { gap: 10 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  number: { width: 28, textAlign: 'right' },
});
