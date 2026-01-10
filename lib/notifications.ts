import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Request notification permissions
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push notification permissions!');
      return false;
    }
    
    // For Android, we need to set up a notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('irrigation-reminders', {
        name: 'Irrigation Schedule Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#22C55E',
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

// Convert time string (e.g., "08:00 PM") to Date object for today
export function getNotificationDate(timeString: string, day: number, month: number, year: number): Date {
  try {
    const [time, period] = timeString.split(' ');
    const [hourStr, minuteStr] = time.split(':');
    let hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    
    if (period === 'PM' && hour !== 12) {
      hour += 12;
    } else if (period === 'AM' && hour === 12) {
      hour = 0;
    }
    
    const notificationDate = new Date(year, month - 1, day, hour, minute, 0);
    return notificationDate;
  } catch (error) {
    console.error('Error parsing time string:', error);
    return new Date();
  }
}

// Schedule a notification for irrigation
export async function scheduleIrrigationNotification(
  scheduleId: string,
  day: number,
  month: number,
  year: number,
  time: string
): Promise<string | null> {
  try {
    const notificationDate = getNotificationDate(time, day, month, year);
    const now = new Date();
    
    // Don't schedule if the time has already passed
    if (notificationDate <= now) {
      console.log('Notification time has already passed, skipping');
      return null;
    }
    
    // Calculate seconds until notification
    const secondsUntilNotification = Math.floor((notificationDate.getTime() - now.getTime()) / 1000);
    
    if (secondsUntilNotification <= 0) {
      console.log('Notification time has already passed, skipping');
      return null;
    }
    
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🌱 Irrigation Reminder',
        body: `Time to irrigate your crops! Scheduled for ${time}`,
        sound: true,
        ...(Platform.OS === 'android' && {
          priority: Notifications.AndroidNotificationPriority.HIGH,
        }),
        data: {
          scheduleId,
          day,
          month,
          year,
          time,
        },
      },
      trigger: {
        type: 'timeInterval',
        seconds: secondsUntilNotification,
      } as Notifications.TimeIntervalTriggerInput,
    });
    
    console.log(`Scheduled notification ${notificationId} for ${day}/${month}/${year} at ${time}`);
    return notificationId;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
}

// Cancel a specific notification
export async function cancelNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log(`Cancelled notification ${notificationId}`);
  } catch (error) {
    console.error('Error cancelling notification:', error);
  }
}

// Cancel all notifications
export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('Cancelled all notifications');
  } catch (error) {
    console.error('Error cancelling all notifications:', error);
  }
}

// Get all scheduled notifications
export async function getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  try {
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    return notifications;
  } catch (error) {
    console.error('Error getting scheduled notifications:', error);
    return [];
  }
}

// Cancel notifications for a specific schedule
export async function cancelNotificationsForSchedule(scheduleId: string): Promise<void> {
  try {
    const allNotifications = await Notifications.getAllScheduledNotificationsAsync();
    
    for (const notification of allNotifications) {
      if (notification.content.data?.scheduleId === scheduleId) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
    
    console.log(`Cancelled notifications for schedule ${scheduleId}`);
  } catch (error) {
    console.error('Error cancelling notifications for schedule:', error);
  }
}

// Reschedule all notifications for a schedule
export async function rescheduleNotificationsForDates(
  dateSchedules: Map<string, { day: number; month: number; year: number; schedules: Array<{ id: string; time: string }> }>,
  scheduleId: string
): Promise<void> {
  try {
    // Cancel existing notifications for this schedule
    await cancelNotificationsForSchedule(scheduleId);
    
    // Schedule new notifications
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();
    
    for (const [dateKey, dateSchedule] of dateSchedules.entries()) {
      // Only schedule for today and future dates
      const scheduleDate = new Date(dateSchedule.year, dateSchedule.month - 1, dateSchedule.day);
      const todayDate = new Date(todayYear, todayMonth - 1, todayDay);
      
      if (scheduleDate >= todayDate) {
        for (const schedule of dateSchedule.schedules) {
          if (schedule.time && schedule.time !== 'Not set') {
            await scheduleIrrigationNotification(
              scheduleId,
              dateSchedule.day,
              dateSchedule.month,
              dateSchedule.year,
              schedule.time
            );
          }
        }
      }
    }
    
    console.log('Rescheduled all notifications');
  } catch (error) {
    console.error('Error rescheduling notifications:', error);
  }
}

