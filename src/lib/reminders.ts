import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

const ID = 'bay-one-odometer';

/**
 * Repeating local notification asking for an odometer reading. Not available on web,
 * where the in-app banner is the reminder.
 */
export async function scheduleOdometerReminder(days: number): Promise<string> {
  if (Platform.OS === 'web') return 'Reminders appear as a banner in the garage on web.';
  await Notifications.cancelScheduledNotificationAsync(ID).catch(() => undefined);
  if (!days) return 'Reminders off.';
  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return 'Notification permission was not granted; the garage banner still reminds you.';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', { name: 'Reminders', importance: AndroidImportance.DEFAULT });
  }
  await Notifications.scheduleNotificationAsync({
    identifier: ID,
    content: { title: 'Odometer check', body: 'Log your current reading to keep service estimates accurate.' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: days * 86400,
      repeats: true,
      channelId: 'reminders',
    },
  });
  return `Reminder every ${days} days.`;
}
