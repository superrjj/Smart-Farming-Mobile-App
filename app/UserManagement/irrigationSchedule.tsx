import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import {
  requestNotificationPermissions,
  scheduleIrrigationNotification,
  cancelNotificationsForSchedule,
  rescheduleNotificationsForDates,
  setNotificationResponseHandler,
  setNotificationReceivedHandler,
} from '@/lib/notifications';
import * as Notifications from 'expo-notifications';

const colors = {
  primary: '#22C55E',
  primaryLight: '#BBF7D0',
  primaryDark: '#16A34A',
  brandBlue: '#3B82F6',
  accent: '#0EA5E9',
  grayText: '#94A3B8',
  grayBorder: '#E2E8F0',
  grayLight: '#F8FAFC',
  dark: '#0F172A',
  white: '#FFFFFF',
};

const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(month: number, year: number) {
  return new Date(year, month, 1).getDay();
}

interface ScheduleDate {
  id: string;
  day: number;
  month: number;
  year: number;
  time: string;
  times?: string[]; // For backward compatibility and multiple times support
}

interface DateSchedule {
  day: number;
  month: number;
  year: number;
  schedules: Array<{
    id: string;
    time: string;
  }>;
}

export default function IrrigationScheduleScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';
  const router = useRouter();
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [scheduledDates, setScheduledDates] = useState<ScheduleDate[]>([]);
  const [dateSchedules, setDateSchedules] = useState<Map<string, DateSchedule>>(new Map());
  const [schedules, setSchedules] = useState<any[]>([]);
  const [addScheduleModalVisible, setAddScheduleModalVisible] = useState(false);
  const [scheduleInfoModalVisible, setScheduleInfoModalVisible] = useState(false);
  const [selectedScheduleInfo, setSelectedScheduleInfo] = useState<DateSchedule | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [newScheduleDates, setNewScheduleDates] = useState<number[]>([]);
  const [newScheduleTimes, setNewScheduleTimes] = useState<string[]>(['08:00 AM']);
  const [newScheduleTime, setNewScheduleTime] = useState('08:00');
  const [newSchedulePeriod, setNewSchedulePeriod] = useState<'AM' | 'PM'>('AM');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedHour, setSelectedHour] = useState('08');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [editingTimeIndex, setEditingTimeIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentScheduleId, setCurrentScheduleId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [todayScheduledTimesCount, setTodayScheduledTimesCount] = useState(0);
  const [nextScheduleTime, setNextScheduleTime] = useState<string>('No schedule');
  const [alarmModalVisible, setAlarmModalVisible] = useState(false);
  const [alarmScheduleData, setAlarmScheduleData] = useState<{ day: number; month: number; year: number; time: string; scheduleId: string } | null>(null);

  const hours = Array.from({length: 12}, (_, i) => String(i + 1).padStart(2, '0'));
  const minutes = Array.from({length: 60}, (_, i) => String(i).padStart(2, '0'));

  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDay = getFirstDayOfMonth(currentMonth, currentYear);

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  // Request notification permissions on mount
  useEffect(() => {
    requestNotificationPermissions();
    
    // Set up notification response handler
    setNotificationResponseHandler((response) => {
      const data = response.notification.request.content.data as any;
      if (data && data.scheduleId && typeof data.day === 'number' && typeof data.month === 'number' && typeof data.year === 'number' && typeof data.time === 'string' && typeof data.scheduleId === 'string') {
        // Navigate to current month if needed
        const notificationDate = new Date(data.year, data.month - 1, data.day);
        const today = new Date();
        if (notificationDate.getMonth() !== today.getMonth() || notificationDate.getFullYear() !== today.getFullYear()) {
          setCurrentMonth(notificationDate.getMonth());
          setCurrentYear(notificationDate.getFullYear());
        }
        
        // Show alarm modal
        setAlarmScheduleData({
          day: data.day,
          month: data.month,
          year: data.year,
          time: data.time,
          scheduleId: data.scheduleId,
        });
        setAlarmModalVisible(true);
      }
    });
    
    // Listen for notifications received while app is in foreground
    setNotificationReceivedHandler((notification) => {
      const data = notification.request.content.data as any;
      if (data && data.scheduleId && typeof data.day === 'number' && typeof data.month === 'number' && typeof data.year === 'number' && typeof data.time === 'string' && typeof data.scheduleId === 'string') {
        // Show alarm modal immediately
        setAlarmScheduleData({
          day: data.day,
          month: data.month,
          year: data.year,
          time: data.time,
          scheduleId: data.scheduleId,
        });
        setAlarmModalVisible(true);
      }
    });
  }, []);

  // Fetch user session
  useEffect(() => {
    fetchUserSession();
  }, [email]);

  // Fetch schedules when user is loaded (initial load only)
  useEffect(() => {
    if (userId && !currentScheduleId) {
      fetchOrCreateSchedule();
    }
  }, [userId]);

  // Fetch dates when month/year changes (without loading state)
  useEffect(() => {
    if (currentScheduleId && userId) {
      fetchScheduledDates(currentScheduleId);
    }
  }, [currentMonth, currentYear, currentScheduleId]);

  // Update today's scheduled times and next schedule whenever dateSchedules changes
  useEffect(() => {
    // Use a small delay to ensure state is fully updated
    const timeoutId = setTimeout(() => {
      updateTodayStats();
    }, 50);
    
    // Update every minute to show next schedule
    const interval = setInterval(() => {
      updateTodayStats();
    }, 60000); // Update every minute

    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, [dateSchedules]);

  const fetchUserSession = async () => {
    if (!email) {
      Alert.alert('Error', 'No email provided');
      setLoading(false);
      return;
    }

    try {
      const { data: userData, error } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (error || !userData) {
        console.error('Error fetching user:', error);
        Alert.alert('Error', 'User not found');
        setLoading(false);
        return;
      }

      setUserId(userData.id);
      console.log('Loaded user ID:', userData.id);
    } catch (error) {
      console.error('Error fetching user session:', error);
      Alert.alert('Error', 'Failed to load user session');
      setLoading(false);
    }
  };

  const fetchOrCreateSchedule = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const { data: existingSchedule, error: scheduleError } = await supabase
        .from('irrigation_schedules')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (scheduleError && scheduleError.code !== 'PGRST116') {
        throw scheduleError;
      }

      let scheduleId = existingSchedule?.id;

      if (!existingSchedule) {
        const { data: newSchedule, error: createError } = await supabase
          .from('irrigation_schedules')
          .insert({
            user_id: userId,
            schedule_name: 'My Irrigation Schedule',
            is_active: true
          })
          .select()
          .single();

        if (createError) throw createError;
        scheduleId = newSchedule.id;
        console.log('Created new schedule:', scheduleId);
      }

      setCurrentScheduleId(scheduleId);
      await fetchTimeSchedules(scheduleId);
      await fetchScheduledDates(scheduleId, true);
      
    } catch (error) {
      console.error('Error fetching schedule:', error);
      Alert.alert('Error', 'Failed to load irrigation schedule');
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeSchedules = async (scheduleId: string) => {
    try {
      const { data, error } = await supabase
        .from('irrigation_time_schedules')
        .select('*')
        .eq('schedule_id', scheduleId)
        .order('time');

      if (error) throw error;
      
      console.log('Fetched time schedules:', data);
      setSchedules(data || []);
    } catch (error) {
      console.error('Error fetching time schedules:', error);
    }
  };

  const fetchScheduledDates = async (scheduleId: string, showLoading: boolean = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      
      const today = new Date();
      const todayMonth = today.getMonth() + 1;
      const todayYear = today.getFullYear();
      const todayDay = today.getDate();
      
      // Fetch schedules for current month being viewed
      const { data, error } = await supabase
        .from('irrigation_scheduled_dates')
        .select('id, day, month, year, time')
        .eq('schedule_id', scheduleId)
        .eq('month', currentMonth + 1)
        .eq('year', currentYear)
        .order('day, time');

      if (error) {
        // If time column doesn't exist, try without it
        if (error.code === '42703' && error.message.includes('time')) {
          console.log('Time column not found, fetching without time column');
          const { data: dataWithoutTime, error: errorWithoutTime } = await supabase
            .from('irrigation_scheduled_dates')
            .select('id, day, month, year')
            .eq('schedule_id', scheduleId)
            .eq('month', currentMonth + 1)
            .eq('year', currentYear)
            .order('day');

          if (errorWithoutTime) throw errorWithoutTime;

          // Group schedules by date (without time for now)
          const schedulesMap = new Map<string, DateSchedule>();
          
          (dataWithoutTime || []).forEach(d => {
            const dateKey = `${d.year}-${d.month}-${d.day}`;
            
            if (!schedulesMap.has(dateKey)) {
              schedulesMap.set(dateKey, {
                day: d.day,
                month: d.month,
                year: d.year,
                schedules: [{
                  id: d.id,
                  time: 'Not set'
                }]
              });
            } else {
              const dateSchedule = schedulesMap.get(dateKey)!;
              dateSchedule.schedules.push({
                id: d.id,
                time: 'Not set'
              });
            }
          });
          
          const formattedDates: ScheduleDate[] = (dataWithoutTime || []).map(d => ({
            id: d.id,
            day: d.day,
            month: d.month,
            year: d.year,
            time: 'Not set'
          }));
          
          // Also fetch today's schedules if today is not in the current month view
          const today = new Date();
          const todayMonth = today.getMonth() + 1;
          const todayYear = today.getFullYear();
          const todayDay = today.getDate();
          
          if (todayMonth !== currentMonth + 1 || todayYear !== currentYear) {
            const { data: todayDataWithoutTime, error: todayErrorWithoutTime } = await supabase
              .from('irrigation_scheduled_dates')
              .select('id, day, month, year')
              .eq('schedule_id', scheduleId)
              .eq('month', todayMonth)
              .eq('year', todayYear)
              .eq('day', todayDay)
              .order('day');

            if (!todayErrorWithoutTime && todayDataWithoutTime && todayDataWithoutTime.length > 0) {
              const todayDateKey = `${todayYear}-${todayMonth}-${todayDay}`;
              
              if (!schedulesMap.has(todayDateKey)) {
                schedulesMap.set(todayDateKey, {
                  day: todayDay,
                  month: todayMonth,
                  year: todayYear,
                  schedules: []
                });
              }
              
              const todaySchedule = schedulesMap.get(todayDateKey)!;
              todayDataWithoutTime.forEach(d => {
                todaySchedule.schedules.push({
                  id: d.id,
                  time: 'Not set'
                });
              });
              
              todayDataWithoutTime.forEach(d => {
                formattedDates.push({
                  id: d.id,
                  day: d.day,
                  month: d.month,
                  year: d.year,
                  time: 'Not set'
                });
              });
            }
          }
          
          // Also fetch today's schedules (same logic as above)
          const { data: todayDataWithoutTime, error: todayErrorWithoutTime } = await supabase
            .from('irrigation_scheduled_dates')
            .select('id, day, month, year')
            .eq('schedule_id', scheduleId)
            .eq('month', todayMonth)
            .eq('year', todayYear)
            .eq('day', todayDay)
            .order('day');

          if (!todayErrorWithoutTime && todayDataWithoutTime && todayDataWithoutTime.length > 0) {
            const todayDateKey = `${todayYear}-${todayMonth}-${todayDay}`;
            
            if (!schedulesMap.has(todayDateKey)) {
              schedulesMap.set(todayDateKey, {
                day: todayDay,
                month: todayMonth,
                year: todayYear,
                schedules: []
              });
            }
            
            const todaySchedule = schedulesMap.get(todayDateKey)!;
            todaySchedule.schedules = [];
            todayDataWithoutTime.forEach(d => {
              todaySchedule.schedules.push({
                id: d.id,
                time: 'Not set'
              });
            });
          } else if (!todayErrorWithoutTime) {
            const todayDateKey = `${todayYear}-${todayMonth}-${todayDay}`;
            if (schedulesMap.has(todayDateKey)) {
              schedulesMap.delete(todayDateKey);
            }
          }
          
          // Create a new Map to ensure React detects the change
          const newSchedulesMap = new Map(schedulesMap);
          
          setScheduledDates(formattedDates);
          setDateSchedules(newSchedulesMap);
          
          // Stats will auto-update via useEffect when dateSchedules changes
          return;
        }
        throw error;
      }
      
      // Group schedules by date
      const schedulesMap = new Map<string, DateSchedule>();
      
      (data || []).forEach(d => {
        const dateKey = `${d.year}-${d.month}-${d.day}`;
        const time = d.time || 'Not set';
        
        if (!schedulesMap.has(dateKey)) {
          schedulesMap.set(dateKey, {
            day: d.day,
            month: d.month,
            year: d.year,
            schedules: []
          });
        }
        
        const dateSchedule = schedulesMap.get(dateKey)!;
        dateSchedule.schedules.push({
          id: d.id,
          time: time
        });
      });
      
      // Also maintain backward compatibility with scheduledDates
      const formattedDates: ScheduleDate[] = (data || []).map(d => ({
        id: d.id,
        day: d.day,
        month: d.month,
        year: d.year,
        time: d.time || 'Not set'
      }));
      
      console.log('Fetched scheduled dates:', formattedDates);
      console.log('Grouped schedules:', schedulesMap);
      
      // ALWAYS fetch today's schedules to keep stats updated (even if viewing different month)
      // This ensures "Scheduled times today" and "Next schedule" are always accurate
      const { data: todayData, error: todayError } = await supabase
        .from('irrigation_scheduled_dates')
        .select('id, day, month, year, time')
        .eq('schedule_id', scheduleId)
        .eq('month', todayMonth)
        .eq('year', todayYear)
        .eq('day', todayDay)
        .order('time');

      if (!todayError && todayData && todayData.length > 0) {
        const todayDateKey = `${todayYear}-${todayMonth}-${todayDay}`;
        
        // Only add if not already in the map (in case today is in current month view)
        if (!schedulesMap.has(todayDateKey)) {
          schedulesMap.set(todayDateKey, {
            day: todayDay,
            month: todayMonth,
            year: todayYear,
            schedules: []
          });
        }
        
        const todaySchedule = schedulesMap.get(todayDateKey)!;
        // Clear existing schedules for today and replace with fresh data
        todaySchedule.schedules = [];
        todayData.forEach(d => {
          todaySchedule.schedules.push({
            id: d.id,
            time: d.time || 'Not set'
          });
        });
        
        // Also add to formattedDates for backward compatibility (avoid duplicates)
        todayData.forEach(d => {
          if (!formattedDates.find(fd => fd.id === d.id)) {
            formattedDates.push({
              id: d.id,
              day: d.day,
              month: d.month,
              year: d.year,
              time: d.time || 'Not set'
            });
          }
        });
      } else if (!todayError) {
        // If today has no schedules, make sure it's removed from map if it exists
        const todayDateKey = `${todayYear}-${todayMonth}-${todayDay}`;
        if (schedulesMap.has(todayDateKey)) {
          schedulesMap.delete(todayDateKey);
        }
      }
      
      // Create a new Map to ensure React detects the change
      const newSchedulesMap = new Map(schedulesMap);
      
      setScheduledDates(formattedDates);
      setDateSchedules(newSchedulesMap);
      
      // Schedule notifications for all fetched schedules
      if (scheduleId) {
        rescheduleNotificationsForDates(newSchedulesMap, scheduleId);
      }
      
      // Stats will auto-update via useEffect when dateSchedules changes
    } catch (error) {
      console.error('Error fetching scheduled dates:', error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const canGoPrevMonth = () => {
    const currentDate = new Date();
    const prevMonthDate = currentMonth === 0 
      ? new Date(currentYear - 1, 11) 
      : new Date(currentYear, currentMonth - 1);
    const todayMonth = new Date(currentDate.getFullYear(), currentDate.getMonth());
    return prevMonthDate >= todayMonth;
  };

  const goToPrevMonth = () => {
    if (!canGoPrevMonth()) return;
    
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const isPastDate = (day: number) => {
    const selectedDate = new Date(currentYear, currentMonth, day);
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);
    return selectedDate < todayDate;
  };

  const isDateScheduled = (day: number) => {
    const dateKey = `${currentYear}-${currentMonth + 1}-${day}`;
    return dateSchedules.has(dateKey);
  };

  const handleDateClick = (day: number) => {
    if (isPastDate(day)) return;
    
    const dateKey = `${currentYear}-${currentMonth + 1}-${day}`;
    const scheduled = dateSchedules.get(dateKey);
    if (scheduled) {
      setSelectedScheduleInfo(scheduled);
      setSelectedDateKey(dateKey);
      setScheduleInfoModalVisible(true);
    }
  };

  const isToday = (day: number) => {
    return (
      day === today.getDate() &&
      currentMonth === today.getMonth() &&
      currentYear === today.getFullYear()
    );
  };

  const handleAddSchedule = () => {
    setNewScheduleDates([]);
    setNewScheduleTimes(['08:00 AM']);
    setNewScheduleTime('08:00');
    setNewSchedulePeriod('AM');
    setSelectedHour('08');
    setSelectedMinute('00');
    setEditingTimeIndex(null);
    setAddScheduleModalVisible(true);
  };

  const addNewSchedule = async () => {
    if (!currentScheduleId || newScheduleDates.length === 0 || newScheduleTimes.length === 0) {
      Alert.alert('Error', 'Please select at least one date and one time');
      return;
    }

    try {
      const insertData = [];
      
      // Create schedule entries for each date and time combination
      for (const day of newScheduleDates) {
        for (const timeString of newScheduleTimes) {
          const scheduledDate = new Date(currentYear, currentMonth, day);
          const scheduleEntry: any = {
            schedule_id: currentScheduleId,
            scheduled_date: scheduledDate.toISOString().split('T')[0],
            month: currentMonth + 1,
            year: currentYear,
            day: day
          };
          
          // Try to add time column if it exists
          try {
            scheduleEntry.time = timeString;
          } catch (e) {
            // Time column doesn't exist, will be handled by database
          }
          
          insertData.push(scheduleEntry);
        }
      }

      const { data, error } = await supabase
        .from('irrigation_scheduled_dates')
        .insert(insertData)
        .select();

      if (error) {
        // If time column doesn't exist, try without it
        if (error.code === '42703' && error.message.includes('time')) {
          Alert.alert(
            'Database Schema Error', 
            'The "time" column does not exist in irrigation_scheduled_dates table. Please add it first:\n\n' +
            'ALTER TABLE irrigation_scheduled_dates ADD COLUMN time VARCHAR(20);'
          );
          return;
        }
        throw error;
      }

      // Immediately update the local state for today's schedules if any were added for today
      const today = new Date();
      const todayDay = today.getDate();
      const todayMonth = today.getMonth() + 1;
      const todayYear = today.getFullYear();
      
      // Check if any of the added schedules are for today
      const addedTodaySchedules = newScheduleDates.filter(day => {
        return day === todayDay && 
               currentMonth + 1 === todayMonth && 
               currentYear === todayYear;
      });
      
      if (addedTodaySchedules.length > 0) {
        // Immediately update dateSchedules for today to show in stats
        const todayDateKey = `${todayYear}-${todayMonth}-${todayDay}`;
        const currentSchedulesMap = new Map(dateSchedules);
        
        if (!currentSchedulesMap.has(todayDateKey)) {
          currentSchedulesMap.set(todayDateKey, {
            day: todayDay,
            month: todayMonth,
            year: todayYear,
            schedules: []
          });
        }
        
        const todaySchedule = currentSchedulesMap.get(todayDateKey)!;
        
        // Add new schedules for today
        newScheduleTimes.forEach(timeString => {
          // Find the inserted data entry for this time
          const insertedEntry = data?.find(d => {
            const dDate = new Date(d.scheduled_date);
            return dDate.getDate() === todayDay &&
                   dDate.getMonth() + 1 === todayMonth &&
                   dDate.getFullYear() === todayYear &&
                   d.time === timeString;
          });
          
          if (insertedEntry) {
            todaySchedule.schedules.push({
              id: insertedEntry.id,
              time: timeString
            });
          }
        });
        
        // Update state immediately for instant UI update (create new Map for React to detect change)
        setDateSchedules(new Map(currentSchedulesMap));
        
        // Force immediate stats update for instant feedback
        setTimeout(() => {
          updateTodayStats();
        }, 10);
      }
      
      // Then fetch all schedules to ensure everything is in sync (this will also update stats via useEffect)
      await fetchScheduledDates(currentScheduleId);
      setAddScheduleModalVisible(false);
      Alert.alert('Success', `Schedule added successfully for ${newScheduleDates.length} date(s)!`);
      
      // Stats will auto-update via useEffect when dateSchedules changes
    } catch (error) {
      console.error('Error adding schedule:', error);
      Alert.alert('Error', 'Failed to add schedule');
    }
  };

  const deleteScheduleDate = async (scheduleId: string) => {
    try {
      const { error } = await supabase
        .from('irrigation_scheduled_dates')
        .delete()
        .eq('id', scheduleId);

      if (error) throw error;

      // Refresh schedules
      if (currentScheduleId) {
        await fetchScheduledDates(currentScheduleId);
      }
      setScheduleInfoModalVisible(false);
      Alert.alert('Success', 'Schedule deleted');
      
      // Stats will auto-update via useEffect when dateSchedules changes
    } catch (error) {
      console.error('Error deleting schedule:', error);
      Alert.alert('Error', 'Failed to delete schedule');
    }
  };

  const handleSelectHour = (hour: string) => {
    setSelectedHour(hour);
    setNewScheduleTime(`${hour}:${selectedMinute}`);
  };

  const handleSelectMinute = (minute: string) => {
    setSelectedMinute(minute);
    setNewScheduleTime(`${selectedHour}:${minute}`);
  };

  const handleConfirmTime = () => {
    const timeString = `${selectedHour}:${selectedMinute} ${newSchedulePeriod}`;
    
    if (editingTimeIndex !== null) {
      // Update existing time
      const updatedTimes = [...newScheduleTimes];
      updatedTimes[editingTimeIndex] = timeString;
      setNewScheduleTimes(updatedTimes);
      setEditingTimeIndex(null);
    } else {
      // Add new time
      setNewScheduleTimes([...newScheduleTimes, timeString]);
    }
    
    setNewScheduleTime('08:00');
    setNewSchedulePeriod('AM');
    setSelectedHour('08');
    setSelectedMinute('00');
    setShowTimePicker(false);
  };

  const handleCancelTime = () => {
    setShowTimePicker(false);
    setEditingTimeIndex(null);
    const [hour, minute] = newScheduleTime.split(':');
    setSelectedHour(hour);
    setSelectedMinute(minute);
  };

  const handleAddTime = () => {
    setEditingTimeIndex(null);
    setNewScheduleTime('08:00');
    setNewSchedulePeriod('AM');
    setSelectedHour('08');
    setSelectedMinute('00');
    setShowTimePicker(true);
  };

  const handleEditTime = (index: number) => {
    const timeString = newScheduleTimes[index];
    const [timePart, period] = timeString.split(' ');
    const [hour, minute] = timePart.split(':');
    
    setEditingTimeIndex(index);
    setNewScheduleTime(timePart);
    setNewSchedulePeriod(period as 'AM' | 'PM');
    setSelectedHour(hour);
    setSelectedMinute(minute);
    setShowTimePicker(true);
  };

  const handleRemoveTime = (index: number) => {
    if (newScheduleTimes.length > 1) {
      setNewScheduleTimes(newScheduleTimes.filter((_, i) => i !== index));
    } else {
      Alert.alert('Error', 'At least one time is required');
    }
  };

  const toggleDateSelection = (day: number) => {
    if (newScheduleDates.includes(day)) {
      setNewScheduleDates(newScheduleDates.filter(d => d !== day));
    } else {
      setNewScheduleDates([...newScheduleDates, day]);
    }
  };

  const getAvailableDates = () => {
    const available: number[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      if (!isPastDate(day)) {
        available.push(day);
      }
    }
    return available;
  };

  // Convert time string (e.g., "08:00 PM") to minutes since midnight
  const timeToMinutes = (timeStr: string): number => {
    try {
      const [time, period] = timeStr.split(' ');
      const [hour, minute] = time.split(':').map(Number);
      let totalMinutes = hour * 60 + minute;
      
      if (period === 'PM' && hour !== 12) {
        totalMinutes += 12 * 60;
      } else if (period === 'AM' && hour === 12) {
        totalMinutes -= 12 * 60;
      }
      
      return totalMinutes;
    } catch (e) {
      return 0;
    }
  };

  // Get all scheduled times for today
  const getTodayScheduledTimes = (): Array<{ time: string; minutes: number }> => {
    const today = new Date();
    const todayDay = today.getDate();
    const todayMonth = today.getMonth() + 1;
    const todayYear = today.getFullYear();
    const dateKey = `${todayYear}-${todayMonth}-${todayDay}`;
    
    const todaySchedule = dateSchedules.get(dateKey);
    if (!todaySchedule) return [];
    
    return todaySchedule.schedules
      .map(s => ({
        time: s.time,
        minutes: timeToMinutes(s.time)
      }))
      .filter(s => s.minutes > 0)
      .sort((a, b) => a.minutes - b.minutes);
  };

  // Update today's stats and next schedule
  const updateTodayStats = () => {
    const todayTimes = getTodayScheduledTimes();
    setTodayScheduledTimesCount(todayTimes.length);
    
    if (todayTimes.length === 0) {
      setNextScheduleTime('No schedule');
      return;
    }
    
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    // Find next schedule time
    const nextSchedule = todayTimes.find(t => t.minutes > currentMinutes);
    
    if (nextSchedule) {
      setNextScheduleTime(nextSchedule.time);
    } else {
      // If all schedules have passed, show the first one tomorrow or "No more today"
      setNextScheduleTime('No more today');
    }
  };

  // Handle alarm OK button - delete the schedule
  const handleAlarmOK = async () => {
    if (!alarmScheduleData || !currentScheduleId) {
      setAlarmModalVisible(false);
      setAlarmScheduleData(null);
      return;
    }

    try {
      // Find the schedule entry to delete
      const dateKey = `${alarmScheduleData.year}-${alarmScheduleData.month}-${alarmScheduleData.day}`;
      const dateSchedule = dateSchedules.get(dateKey);
      
      let scheduleEntryId: string | null = null;
      
      if (dateSchedule) {
        // Find the schedule entry by matching time
        const scheduleEntry = dateSchedule.schedules.find(s => s.time === alarmScheduleData.time);
        if (scheduleEntry) {
          scheduleEntryId = scheduleEntry.id;
        }
      }
      
      // If not found in state, query database directly
      if (!scheduleEntryId) {
        const { data: scheduleData, error: queryError } = await supabase
          .from('irrigation_scheduled_dates')
          .select('id')
          .eq('schedule_id', currentScheduleId)
          .eq('day', alarmScheduleData.day)
          .eq('month', alarmScheduleData.month)
          .eq('year', alarmScheduleData.year)
          .eq('time', alarmScheduleData.time)
          .limit(1)
          .single();

        if (!queryError && scheduleData) {
          scheduleEntryId = scheduleData.id;
        }
      }

      // Delete the schedule entry
      if (scheduleEntryId) {
        const { error } = await supabase
          .from('irrigation_scheduled_dates')
          .delete()
          .eq('id', scheduleEntryId);

        if (error) throw error;
      } else {
        console.warn('Schedule entry not found for deletion');
      }

      // Refresh schedules to update UI and remove from calendar
      await fetchScheduledDates(currentScheduleId);
      
      // Close modal and clear data
      setAlarmModalVisible(false);
      setAlarmScheduleData(null);
      
      // Stats will auto-update via useEffect when dateSchedules changes
    } catch (error) {
      console.error('Error deleting schedule from alarm:', error);
      Alert.alert('Error', 'Failed to dismiss schedule');
      setAlarmModalVisible(false);
      setAlarmScheduleData(null);
    }
  };

  // Filter out past schedules from display
  const filterPastSchedules = (schedules: DateSchedule): DateSchedule => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const scheduleDate = new Date(schedules.year, schedules.month - 1, schedules.day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    scheduleDate.setHours(0, 0, 0, 0);
    
    // If schedule is for today, filter out past times
    if (scheduleDate.getTime() === today.getTime()) {
      return {
        ...schedules,
        schedules: schedules.schedules.filter(s => {
          const scheduleMinutes = timeToMinutes(s.time);
          return scheduleMinutes > currentMinutes;
        })
      };
    }
    
    // If schedule is in the past, return empty schedules
    if (scheduleDate < today) {
      return {
        ...schedules,
        schedules: []
      };
    }
    
    // Future dates, keep all schedules
    return schedules;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brandBlue} />
          <Text style={styles.loadingText}>Loading irrigation schedule...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome name="chevron-left" size={18} color={colors.dark} />
          </TouchableOpacity>

          <View style={styles.titleRow}>
            <Text style={styles.topBarTitle}>IRRIGATION SCHEDULE</Text>
          </View>

          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>

          <View style={styles.heroCard}>
            <View style={styles.heroStats}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Scheduled times today</Text>
                <Text style={styles.statValue}>{todayScheduledTimesCount}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Next schedule</Text>
                <Text style={styles.statValue}>{nextScheduleTime}</Text>
              </View>
            </View>
          </View>

          <View style={styles.calendarSection}>
            <View style={styles.monthNav}>
              {canGoPrevMonth() ? (
                <TouchableOpacity onPress={goToPrevMonth} style={styles.navButton}>
                  <FontAwesome name="chevron-left" size={16} color={colors.grayText} />
                </TouchableOpacity>
              ) : (
                <View style={[styles.navButton, styles.navButtonDisabled]} />
              )}
              <Text style={styles.monthTitle}>
                {MONTHS[currentMonth].toUpperCase()}
              </Text>
              <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
                <FontAwesome name="chevron-right" size={16} color={colors.grayText} />
              </TouchableOpacity>
            </View>

            <Text style={styles.yearText}>{currentYear}</Text>

            <View style={styles.dayHeaders}>
              {DAYS.map((day) => (
                <Text key={day} style={styles.dayHeader}>
                  {day.charAt(0)}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarDays.map((day, index) => {
                const isSelected = day !== null && isDateScheduled(day);
                const isTodayDate = day !== null && isToday(day);
                const isPast = day !== null && isPastDate(day);

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dayCell,
                      isSelected && styles.selectedDay,
                      isPast && styles.pastDay,
                    ]}
                    onPress={() => day && handleDateClick(day)}
                    disabled={day === null || isPast}>
                    <Text
                      style={[
                        styles.dayText,
                        day === null && styles.emptyDay,
                        isSelected && styles.selectedDayText,
                        isTodayDate && !isSelected && styles.todayText,
                        isPast && styles.pastDayText,
                      ]}>
                      {day || ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {(() => {
            // Check if there are any scheduled dates in the current month
            const hasScheduledDates = Array.from(dateSchedules.values()).some(
              schedule => schedule.month === currentMonth + 1 && schedule.year === currentYear
            );
            
            if (!hasScheduledDates) return null;
            
            return (
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                  <Text style={styles.legendText}>Scheduled</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.grayText }]} />
                  <Text style={styles.legendText}>Available</Text>
                </View>
              </View>
            );
          })()}

        </ScrollView>

        {/* Floating Action Button */}
        <TouchableOpacity 
          style={styles.fab}
          onPress={handleAddSchedule}
        >
          <FontAwesome name="plus" size={24} color={colors.white} />
        </TouchableOpacity>

        {/* Add Schedule Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={addScheduleModalVisible}
          onRequestClose={() => setAddScheduleModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.addScheduleModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Irrigation Schedule</Text>
                <TouchableOpacity onPress={() => setAddScheduleModalVisible(false)}>
                  <FontAwesome name="times" size={24} color={colors.dark} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Select Date(s) - Multiple selection allowed</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
                  {getAvailableDates().map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.dateOption,
                        newScheduleDates.includes(day) && styles.dateOptionSelected
                      ]}
                      onPress={() => toggleDateSelection(day)}
                    >
                      <Text style={[
                        styles.dateOptionText,
                        newScheduleDates.includes(day) && styles.dateOptionTextSelected
                      ]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {newScheduleDates.length > 0 && (
                  <Text style={styles.selectedDatesText}>
                    Selected: {newScheduleDates.sort((a, b) => a - b).join(', ')}
                  </Text>
                )}
              </View>

              <View style={styles.timeInputContainer}>
                <View style={styles.timeHeaderRow}>
                  <Text style={styles.inputLabel}>Time(s)</Text>
                  <TouchableOpacity 
                    style={styles.addTimeButton}
                    onPress={handleAddTime}
                  >
                    <FontAwesome name="plus" size={14} color={colors.primary} />
                    <Text style={styles.addTimeButtonText}>Add Time</Text>
                  </TouchableOpacity>
                </View>
                
                {/* Display selected times */}
                {newScheduleTimes.length > 0 && (
                  <View style={styles.timesList}>
                    {newScheduleTimes.map((time, index) => (
                      <View key={index} style={styles.timeItem}>
                        <Text style={styles.timeItemText}>{time}</Text>
                        <View style={styles.timeItemActions}>
                          <TouchableOpacity 
                            style={styles.timeItemButton}
                            onPress={() => handleEditTime(index)}
                          >
                            <FontAwesome name="pencil" size={12} color={colors.brandBlue} />
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={styles.timeItemButton}
                            onPress={() => handleRemoveTime(index)}
                          >
                            <FontAwesome name="times" size={12} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {showTimePicker && (
                  <View style={styles.timePickerSection}>
                    <Text style={styles.timePickerTitle}>
                      {editingTimeIndex !== null ? 'Edit Time' : 'Add New Time'}
                    </Text>
                    <View style={styles.timeInputRow}>
                      <TouchableOpacity 
                        style={styles.timeSelector}
                        onPress={() => setShowTimePicker(true)}
                      >
                        <Text style={styles.timeSelectorText}>{newScheduleTime}</Text>
                        <FontAwesome name="chevron-down" size={12} color={colors.grayText} />
                      </TouchableOpacity>
                      <View style={styles.periodButtons}>
                        <TouchableOpacity
                          style={[
                            styles.periodButton,
                            newSchedulePeriod === 'AM' && styles.periodButtonActive
                          ]}
                          onPress={() => setNewSchedulePeriod('AM')}
                        >
                          <Text style={[
                            styles.periodButtonText,
                            newSchedulePeriod === 'AM' && styles.periodButtonTextActive
                          ]}>AM</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.periodButton,
                            newSchedulePeriod === 'PM' && styles.periodButtonActive
                          ]}
                          onPress={() => setNewSchedulePeriod('PM')}
                        >
                          <Text style={[
                            styles.periodButtonText,
                            newSchedulePeriod === 'PM' && styles.periodButtonTextActive
                          ]}>PM</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                
                    <View style={styles.timePickerWrapper}>
                    <View style={styles.timePickerContainer}>
                      <View style={styles.timePickerColumn}>
                        <Text style={styles.timePickerLabel}>Hour</Text>
                        <ScrollView style={styles.timePickerScroll} showsVerticalScrollIndicator={false}>
                          {hours.map((hour) => (
                            <TouchableOpacity
                              key={hour}
                              style={[
                                styles.timePickerOption,
                                selectedHour === hour && styles.timePickerOptionSelected
                              ]}
                              onPress={() => handleSelectHour(hour)}
                            >
                              <Text style={[
                                styles.timePickerOptionText,
                                selectedHour === hour && styles.timePickerOptionTextSelected
                              ]}>{hour}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                      
                      <View style={styles.timePickerColumn}>
                        <Text style={styles.timePickerLabel}>Minute</Text>
                        <ScrollView style={styles.timePickerScroll} showsVerticalScrollIndicator={false}>
                          {minutes.map((minute) => (
                            <TouchableOpacity
                              key={minute}
                              style={[
                                styles.timePickerOption,
                                selectedMinute === minute && styles.timePickerOptionSelected
                              ]}
                              onPress={() => handleSelectMinute(minute)}
                            >
                              <Text style={[
                                styles.timePickerOptionText,
                                selectedMinute === minute && styles.timePickerOptionTextSelected
                              ]}>{minute}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    </View>
                    
                    <View style={styles.timePickerActions}>
                      <TouchableOpacity 
                        style={styles.timePickerCancelButton}
                        onPress={handleCancelTime}
                      >
                        <Text style={styles.timePickerCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.timePickerConfirmButton}
                        onPress={handleConfirmTime}
                      >
                        <Text style={styles.timePickerConfirmText}>Confirm</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  </View>
                )}
              </View>

              {!showTimePicker && (
                <View style={styles.addScheduleModalActions}>
                  <TouchableOpacity 
                    style={styles.cancelButton}
                    onPress={() => setAddScheduleModalVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[
                      styles.addButton,
                      (newScheduleDates.length === 0 || newScheduleTimes.length === 0) && styles.addButtonDisabled
                    ]}
                    onPress={addNewSchedule}
                    disabled={newScheduleDates.length === 0 || newScheduleTimes.length === 0}
                  >
                    <Text style={styles.addButtonText}>Add Schedule</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* Schedule Info Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={scheduleInfoModalVisible}
          onRequestClose={() => setScheduleInfoModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.infoModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Schedule Details</Text>
                <TouchableOpacity onPress={() => setScheduleInfoModalVisible(false)}>
                  <FontAwesome name="times" size={24} color={colors.dark} />
                </TouchableOpacity>
              </View>
              
              {selectedScheduleInfo && (() => {
                const filteredSchedule = filterPastSchedules(selectedScheduleInfo);
                if (filteredSchedule.schedules.length === 0) {
                  return (
                    <View style={styles.scheduleInfoBody}>
                      <Text style={styles.noSchedulesText}>No upcoming schedules for this date.</Text>
                    </View>
                  );
                }
                return (
                  <View style={styles.scheduleInfoBody}>
                    <View style={styles.infoRow}>
                      <FontAwesome name="calendar" size={20} color={colors.primary} />
                      <View style={styles.infoContent}>
                        <Text style={styles.infoLabel}>Date</Text>
                        <Text style={styles.infoValue}>
                          {MONTHS[currentMonth]} {selectedScheduleInfo.day}, {selectedScheduleInfo.year}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.infoRow}>
                      <FontAwesome name="clock-o" size={20} color={colors.primary} />
                      <View style={styles.infoContent}>
                        <Text style={styles.infoLabel}>Time(s)</Text>
                        <View style={styles.timesList}>
                          {filteredSchedule.schedules.map((schedule, index) => (
                            <View key={schedule.id} style={styles.timeItem}>
                              <Text style={styles.timeItemText}>{schedule.time}</Text>
                              <TouchableOpacity 
                                style={styles.timeItemDeleteButton}
                                onPress={() => deleteScheduleDate(schedule.id)}
                              >
                                <FontAwesome name="times" size={12} color="#EF4444" />
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })()}
            </View>
          </View>
        </Modal>

        {/* Alarm/Reminder Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={alarmModalVisible}
          onRequestClose={() => setAlarmModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.alarmModalContent}>
              <View style={styles.alarmIconContainer}>
                <FontAwesome name="bell" size={48} color={colors.primary} />
              </View>
              
              <Text style={styles.alarmTitle}>🌱 Irrigation Reminder</Text>
              
              {alarmScheduleData && (
                <>
                  <Text style={styles.alarmMessage}>
                    Time to irrigate your crops!
                  </Text>
                  
                  <View style={styles.alarmInfoContainer}>
                    <View style={styles.alarmInfoRow}>
                      <FontAwesome name="calendar" size={20} color={colors.grayText} />
                      <Text style={styles.alarmInfoText}>
                        {MONTHS[alarmScheduleData.month - 1]} {alarmScheduleData.day}, {alarmScheduleData.year}
                      </Text>
                    </View>
                    
                    <View style={styles.alarmInfoRow}>
                      <FontAwesome name="clock-o" size={20} color={colors.grayText} />
                      <Text style={styles.alarmInfoText}>
                        {alarmScheduleData.time}
                      </Text>
                    </View>
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.alarmOKButton}
                    onPress={handleAlarmOK}
                  >
                    <Text style={styles.alarmOKButtonText}>OK</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.grayLight,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.grayText,
  },
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.grayBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  backButton: {
    padding: 4,
    width: 32,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topBarTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.dark,
    letterSpacing: 0.5,
  },
  placeholder: {
    width: 32,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 18,
    paddingBottom: 80,
  },
  heroCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.grayBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },
  heroStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.grayLight,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.grayBorder,
  },
  statLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.grayText,
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.dark,
    marginTop: 6,
  },
  calendarSection: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.grayBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 3,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 4,
  },
  navButton: {
    padding: 8,
    backgroundColor: colors.grayLight,
    borderRadius: 10,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonDisabled: {
    backgroundColor: 'transparent',
  },
  monthTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.dark,
    letterSpacing: 1,
    minWidth: 140,
    textAlign: 'center',
  },
  yearText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.grayText,
    textAlign: 'center',
    marginBottom: 14,
  },
  dayHeaders: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.grayText,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 12,
    overflow: 'hidden',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: colors.grayBorder,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.white,
  },
  dayText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.dark,
  },
  emptyDay: {
    color: 'transparent',
  },
  selectedDay: {
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  selectedDayText: {
    color: colors.white,
    fontFamily: fonts.bold,
  },
  todayText: {
    color: colors.accent,
    fontFamily: fonts.bold,
  },
  pastDay: {
    backgroundColor: '#F7F7F7',
    opacity: 1,
  },
  pastDayText: {
    color: '#D1D5DB',
    opacity: 1,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.grayText,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  addScheduleModalContent: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  infoModalContent: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.dark,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.dark,
    marginBottom: 12,
  },
  dateScroll: {
    flexDirection: 'row',
  },
  dateOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: colors.grayLight,
    borderWidth: 1,
    borderColor: colors.grayBorder,
    marginRight: 8,
    minWidth: 50,
    alignItems: 'center',
  },
  dateOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dateOptionText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.dark,
  },
  dateOptionTextSelected: {
    color: colors.white,
    fontFamily: fonts.bold,
  },
  timeInputContainer: {
    marginBottom: 20,
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeSelector: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.grayBorder,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeSelectorText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.dark,
  },
  timePickerWrapper: {
    marginTop: 12,
  },
  timePickerContainer: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.grayLight,
    borderRadius: 10,
    padding: 12,
  },
  timePickerColumn: {
    flex: 1,
  },
  timePickerLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.grayText,
    marginBottom: 8,
    textAlign: 'center',
  },
  timePickerScroll: {
    maxHeight: 120,
  },
  timePickerOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.white,
    borderRadius: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.grayBorder,
  },
  timePickerOptionSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  timePickerOptionText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.dark,
    textAlign: 'center',
  },
  timePickerOptionTextSelected: {
    color: colors.primaryDark,
    fontFamily: fonts.semibold,
  },
  timePickerActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  timePickerCancelButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.grayLight,
    borderWidth: 1,
    borderColor: colors.grayBorder,
  },
  timePickerCancelText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.grayText,
  },
  timePickerConfirmButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  timePickerConfirmText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.white,
  },
  periodButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  periodButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.grayLight,
    borderWidth: 1,
    borderColor: colors.grayBorder,
  },
  periodButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  periodButtonText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.grayText,
  },
  periodButtonTextActive: {
    color: colors.white,
  },
  addScheduleModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.grayLight,
    borderWidth: 1,
    borderColor: colors.grayBorder,
  },
  cancelButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.grayText,
  },
  addButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  addButtonDisabled: {
    backgroundColor: colors.grayText,
  },
  addButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.white,
  },
  scheduleInfoBody: {
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: colors.grayLight,
    borderRadius: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.grayText,
    marginBottom: 4,
  },
  infoValue: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.dark,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    marginTop: 8,
  },
  deleteButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.white,
  },
  selectedDatesText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.grayText,
    marginTop: 8,
  },
  timeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  addTimeButtonText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.primaryDark,
  },
  timesList: {
    gap: 8,
    marginTop: 8,
  },
  timeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.grayLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.grayBorder,
  },
  timeItemText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.dark,
  },
  timeItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  timeItemButton: {
    padding: 4,
  },
  timeItemDeleteButton: {
    padding: 4,
  },
  timePickerSection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.grayLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.grayBorder,
  },
  timePickerTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.dark,
    marginBottom: 12,
  },
  alarmModalContent: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  alarmIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  alarmTitle: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.dark,
    marginBottom: 8,
    textAlign: 'center',
  },
  alarmMessage: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.grayText,
    marginBottom: 24,
    textAlign: 'center',
  },
  alarmInfoContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  alarmInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: colors.grayLight,
    borderRadius: 10,
  },
  alarmInfoText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.dark,
  },
  alarmOKButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  alarmOKButtonText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.white,
  },
  noSchedulesText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.grayText,
    textAlign: 'center',
    padding: 20,
  },
});