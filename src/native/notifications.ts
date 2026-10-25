import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL_ID = 'daily-spending-reminders';
const REMINDER_ID = 'daily-spending-reminder';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function parseReminderTime(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? { hour, minute } : null;
}

export async function ensureReminderChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Daily spending reminders',
    description: 'A daily reminder to log spending in DailyBudget.',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function cancelDailyReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
  } catch {
    // There may be no reminder yet on a fresh install.
  }
}

export async function scheduleDailyReminder(time: string): Promise<void> {
  const parsed = parseReminderTime(time);
  if (!parsed) throw new Error('Reminder time must use HH:MM in 24-hour time.');
  await ensureReminderChannel();
  await cancelDailyReminder();
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: 'DailyBudget',
      body: 'Log today’s spending',
      data: { route: '/add' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: parsed.hour,
      minute: parsed.minute,
      channelId: CHANNEL_ID,
    },
  });
}

export async function enableDailyReminder(time: string): Promise<boolean> {
  await ensureReminderChannel();
  let permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted && permissions.canAskAgain) {
    permissions = await Notifications.requestPermissionsAsync();
  }
  if (!permissions.granted) return false;
  await scheduleDailyReminder(time);
  return true;
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.dismissAllNotificationsAsync();
}

export function isAddReminderResponse(
  response: Notifications.NotificationResponse | null | undefined,
): boolean {
  return Boolean(
    response &&
      response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER &&
      response.notification.request.content.data?.route === '/add',
  );
}
