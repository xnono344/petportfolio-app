import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    if (!Device.isDevice) return false;
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function scheduleMedicationReminder(opts: {
  petName: string;
  medName: string;
  schedule: string;
}): Promise<string | null> {
  try {
    const ok = await ensureNotificationPermission();
    if (!ok) return null;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('meds', {
        name: 'Medication reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    // Simple daily 9am reminder. Parsing free-text schedules is out of scope;
    // the stored schedule text is shown in the notification body.
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${opts.petName} · ${opts.medName}`,
        body: opts.schedule || 'Time for medication',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 9, minute: 0 },
    });
    return id;
  } catch {
    return null;
  }
}

export async function cancelReminder(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // best effort
  }
}
