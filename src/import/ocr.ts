import { extractTextFromImage, isSupported } from 'expo-text-extractor';

export interface LinePosition {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface RecognizedLine {
  text: string;
  position?: LinePosition;
}

export async function recognizeImage(uri: string): Promise<RecognizedLine[]> {
  if (!isSupported) {
    throw new Error('Text recognition is not supported on this device.');
  }
  const values = await extractTextFromImage(uri);
  return values
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text) => ({ text }));
}
