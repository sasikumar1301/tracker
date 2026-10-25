import * as LocalAuthentication from 'expo-local-authentication';

export async function canUseAppLock(): Promise<boolean> {
  try {
    return (await LocalAuthentication.getEnrolledLevelAsync()) > LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

export async function authenticateForAppLock(
  message = 'Unlock DailyBudget',
): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: message,
      promptDescription: 'Use your fingerprint, face, device PIN, or pattern.',
      disableDeviceFallback: false,
      cancelLabel: 'Cancel',
    });
    return result.success;
  } catch {
    return false;
  }
}
