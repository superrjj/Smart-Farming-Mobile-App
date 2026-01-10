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
} from '@/lib/notifications';

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
  }, []);

  // Fetch user session
  useEffect(() => {
    fetchUserSession();
  }, [email]);

  // Fetch schedules when user is loaded
  useEffect(() => {
    if (userId) {
      fetchOrCreateSchedule();
    }
  }, [userId, currentMonth, currentYear]);

  // Update today's scheduled times and next schedule
  useEffect(() => {
    updateTodayStats();
    
    // Update every minute to show next schedule
    const interval = setInterval(() => {
      updateTodayStats();
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [dateSchedules, currentMonth, currentYear]);

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
      await fetchScheduledDates(scheduleId);
      
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

  const fetchScheduledDates = async (scheduleId: string) => {
    try {
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
          
          setScheduledDates(formattedDates);
          setDateSchedules(schedulesMap);
          
          // Update today's stats after fetching
          setTimeout(() => {
            updateTodayStats();
          }, 100);
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
      setScheduledDates(formattedDates);
      setDateSchedules(schedulesMap);
      
      // Schedule notifications for all fetched schedules
      if (scheduleId) {
        rescheduleNotificationsForDates(schedulesMap, scheduleId);
      }
      
      // Update today's stats after fetching
      setTimeout(() => {
        updateTodayStats();
      }, 100);
    } catch (error) {
      console.error('Error fetching scheduled dates:', error);
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

      // Refresh the schedules
      await fetchScheduledDates(currentScheduleId);
      setAddScheduleModalVisible(false);
      Alert.alert('Success', `Schedule added successfully for ${newScheduleDates.length} date(s)!`);
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
              
              {selectedScheduleInfo && (
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
                        {selectedScheduleInfo.schedules.map((schedule, index) => (
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
});