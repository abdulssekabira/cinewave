import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL = 'downloads';
let ready: Promise<boolean> | null = null;

/** Show alerts even while the app is open. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

/** Asks once for permission (Android 13+) and creates the Downloads channel. */
export function prepareNotifications(): Promise<boolean> {
  if (!ready) {
    ready = (async () => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync(CHANNEL, {
            name: 'Downloads',
            importance: Notifications.AndroidImportance.HIGH,
            description: 'Tells you when a film has finished downloading',
          });
        }
        const cur = await Notifications.getPermissionsAsync();
        if (cur.granted) return true;
        if (!cur.canAskAgain) return false;
        const asked = await Notifications.requestPermissionsAsync();
        return asked.granted;
      } catch {
        return false;
      }
    })();
  }
  return ready;
}

/** "Download complete" notification; tapping it opens Downloads. */
export async function notifyDownloadDone(title: string, detail?: string | null) {
  if (!(await prepareNotifications())) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Download complete',
      body: `${title}${detail ? ` · ${detail}` : ''} is ready to watch offline.`,
      data: { url: '/downloads' },
    },
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
  }).catch(() => {});
}

export async function notifyDownloadFailed(title: string) {
  if (!(await prepareNotifications())) return;
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Download stopped', body: `${title} paused. Open Downloads to continue from where it stopped.`, data: { url: '/downloads' } },
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
  }).catch(() => {});
}
