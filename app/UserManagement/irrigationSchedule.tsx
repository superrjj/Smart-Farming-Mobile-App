import {
  philippinesCalendarCompare,
  requestNotificationPermissions,
  rescheduleNotificationsForDates,
  setNotificationReceivedHandler,
  setNotificationResponseHandler,
} from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import { FontAwesome } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const colors = {
  primary: "#22C55E",
  primaryLight: "#BBF7D0",
  primaryDark: "#16A34A",
  brandBlue: "#3B82F6",
  brandBlueLight: "#DBEAFE",
  accent: "#0EA5E9",
  grayText: "#94A3B8",
  grayBorder: "#E2E8F0",
  grayLight: "#F8FAFC",
  dark: "#0F172A",
  white: "#FFFFFF",
  warning: "#F59E0B",
  warningLight: "#FEF3C7",
  humidityLight: "#DCFCE7",
  purple: "#7C3AED",
  purpleLight: "#EDE9FE",
};

const fonts = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semibold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(month: number, year: number) {
  return new Date(year, month, 1).getDay();
}

/** YYYY-MM-DD from calendar fields — never use Date#toISOString() for `scheduled_date` (UTC shifts the day). */
function toScheduledDateString(
  year: number,
  month1Based: number,
  day: number,
): string {
  return `${year}-${String(month1Based).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface ScheduleDate {
  id: string;
  day: number;
  month: number;
  year: number;
  time: string;
  times?: string[];
}

interface DateSchedule {
  day: number;
  month: number;
  year: number;
  schedules: { id: string; time: string }[];
}

// ─── Sensor Progress Card ─────────────────────────────────────────────────────

const SensorCard = ({
  label,
  value,
  max,
  unit,
  trackColor,
  fillColor,
  icon,
  iconColor,
  iconBg,
  alert,
}: {
  label: string;
  value: number;
  max: number;
  unit: string;
  trackColor: string;
  fillColor: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  alert?: boolean;
}) => {
  const percent = Math.min(value / max, 1);

  return (
    <View style={sensorStyles.card}>
      <View style={sensorStyles.row}>
        <View style={[sensorStyles.iconWrap, { backgroundColor: iconBg }]}>
          <FontAwesome name={icon as any} size={16} color={iconColor} />
        </View>
        <Text style={sensorStyles.label}>{label}</Text>
        <Text style={[sensorStyles.value, { color: iconColor }]}>
          {value}
          {unit}
        </Text>
        {alert && <View style={sensorStyles.alertDot} />}
      </View>
      <View style={[sensorStyles.track, { backgroundColor: trackColor }]}>
        <View
          style={[
            sensorStyles.fill,
            { width: `${percent * 100}%` as any, backgroundColor: fillColor },
          ]}
        />
        <View
          style={[
            sensorStyles.thumb,
            {
              left: `${percent * 100}%` as any,
              backgroundColor: fillColor,
            },
          ]}
        />
      </View>
    </View>
  );
};

const sensorStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.grayBorder,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.dark,
  },
  value: {
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  track: {
    height: 8,
    borderRadius: 4,
    position: "relative",
    justifyContent: "center",
  },
  fill: {
    height: 8,
    borderRadius: 4,
    position: "absolute",
    left: 0,
    top: 0,
  },
  thumb: {
    width: 14,
    height: 14,
    borderRadius: 7,
    position: "absolute",
    top: -3,
    marginLeft: -7,
    borderWidth: 2,
    borderColor: colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function IrrigationScheduleScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === "string" ? params.email : "";
  const router = useRouter();
  const today = new Date();
  const [nowTick, setNowTick] = useState(() => new Date());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [scheduledDates, setScheduledDates] = useState<ScheduleDate[]>([]);
  const [dateSchedules, setDateSchedules] = useState<Map<string, DateSchedule>>(
    new Map(),
  );
  const [schedules, setSchedules] = useState<any[]>([]);
  const [addScheduleModalVisible, setAddScheduleModalVisible] = useState(false);
  const [scheduleInfoModalVisible, setScheduleInfoModalVisible] =
    useState(false);
  const [selectedScheduleInfo, setSelectedScheduleInfo] =
    useState<DateSchedule | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [newScheduleDates, setNewScheduleDates] = useState<number[]>([]);
  const [newScheduleTimes, setNewScheduleTimes] = useState<string[]>([]);
  const [newScheduleTime, setNewScheduleTime] = useState("08:00");
  const [newSchedulePeriod, setNewSchedulePeriod] = useState<"AM" | "PM">("AM");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedHour, setSelectedHour] = useState("08");
  const [selectedMinute, setSelectedMinute] = useState("00");
  const [editingTimeIndex, setEditingTimeIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentScheduleId, setCurrentScheduleId] = useState<string | null>(
    null,
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [todayScheduledTimesCount, setTodayScheduledTimesCount] = useState(0);
  const [nextScheduleTime, setNextScheduleTime] =
    useState<string>("No schedule");
  const [alarmModalVisible, setAlarmModalVisible] = useState(false);
  const [alarmScheduleData, setAlarmScheduleData] = useState<{
    day: number;
    month: number;
    year: number;
    time: string;
    scheduleId: string;
  } | null>(null);
  const realtimeRefreshTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const [soilMoisture, setSoilMoisture] = useState(0);
  const [temperature, setTemperature] = useState(0);
  const [humidity, setHumidity] = useState(0);

  const fetchLatestSensorData = async () => {
    try {
      const sensorIds = [1, 2, 3];
      const results = await Promise.all(
        sensorIds.map((id) =>
          supabase
            .from("sensor_reading")
            .select("sensor_id, value, unit")
            .eq("sensor_id", id)
            .order("timestamp", { ascending: false })
            .limit(1)
            .single(),
        ),
      );

      results.forEach(({ data, error }) => {
        if (error || !data) return;
        if (data.sensor_id === 1) {
          const raw = Number(data.value);
          // Match dashboard: round to 1 decimal place
          setTemperature(Math.round(raw * 10) / 10);
        } else if (data.sensor_id === 2) {
          const raw = Number(data.value);
          // Match dashboard: humidity as integer %
          setHumidity(Math.round(raw));
        } else if (data.sensor_id === 3) {
          const raw = Number(data.value);
          // Match dashboard admin conversion: higher raw = drier (inverted ADC scale)
          const percent = Math.round(((1023 - raw) / 1023) * 100);
          const clamped = Math.min(100, Math.max(0, percent));
          setSoilMoisture(clamped);
        }
      });
    } catch (error) {
      console.error("Error fetching sensor data:", error);
    }
  };

  useEffect(() => {
    fetchLatestSensorData();
    const interval = setInterval(fetchLatestSensorData, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowTick(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const hours = Array.from({ length: 12 }, (_, i) =>
    String(i + 1).padStart(2, "0"),
  );
  const minutes = Array.from({ length: 60 }, (_, i) =>
    String(i).padStart(2, "0"),
  );

  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDay = getFirstDayOfMonth(currentMonth, currentYear);

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  useEffect(() => {
    requestNotificationPermissions();
    setNotificationResponseHandler((response) => {
      const data = response.notification.request.content.data as any;
      if (data?.scheduleId && typeof data.day === "number") {
        const notificationDate = new Date(data.year, data.month - 1, data.day);
        const todayDate = new Date();
        if (
          notificationDate.getMonth() !== todayDate.getMonth() ||
          notificationDate.getFullYear() !== todayDate.getFullYear()
        ) {
          setCurrentMonth(notificationDate.getMonth());
          setCurrentYear(notificationDate.getFullYear());
        }
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
    setNotificationReceivedHandler((notification) => {
      const data = notification.request.content.data as any;
      if (data?.scheduleId && typeof data.day === "number") {
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

  useEffect(() => {
    fetchUserSession();
  }, [email]);

  useEffect(() => {
    if (userId && !currentScheduleId) fetchOrCreateSchedule();
  }, [userId]);

  useEffect(() => {
    if (currentScheduleId && userId) fetchScheduledDates(currentScheduleId);
  }, [currentMonth, currentYear, currentScheduleId]);

  useEffect(() => {
    updateTodayStats();
  }, [dateSchedules, nowTick]);

  useEffect(() => {
    if (!currentScheduleId || !userId) return;

    const refreshScheduleState = () => {
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
      // Batch bursts of realtime events into one refresh.
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        void fetchTimeSchedules(currentScheduleId);
        void fetchScheduledDates(currentScheduleId);
      }, 150);
    };

    const channel = supabase
      .channel(`irrigation-schedule-live-${currentScheduleId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "irrigation_scheduled_dates",
          filter: `schedule_id=eq.${currentScheduleId}`,
        },
        refreshScheduleState,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "irrigation_time_schedules",
          filter: `schedule_id=eq.${currentScheduleId}`,
        },
        refreshScheduleState,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "irrigation_schedules",
          filter: `id=eq.${currentScheduleId}`,
        },
        refreshScheduleState,
      )
      .subscribe();

    return () => {
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
        realtimeRefreshTimeoutRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [currentScheduleId, userId, currentMonth, currentYear]);

  const fetchUserSession = async () => {
    if (!email) {
      Alert.alert("Error", "No email provided");
      setLoading(false);
      return;
    }
    try {
      const { data: userData, error } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("email", email)
        .single();
      if (error || !userData) {
        Alert.alert("Error", "User not found");
        setLoading(false);
        return;
      }
      setUserId(userData.id);
    } catch {
      Alert.alert("Error", "Failed to load user session");
      setLoading(false);
    }
  };

  const fetchOrCreateSchedule = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data: existingSchedule, error: scheduleError } = await supabase
        .from("irrigation_schedules")
        .select("id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();
      if (scheduleError && scheduleError.code !== "PGRST116")
        throw scheduleError;
      let scheduleId = existingSchedule?.id;
      if (!existingSchedule) {
        const { data: newSchedule, error: createError } = await supabase
          .from("irrigation_schedules")
          .insert({
            user_id: userId,
            schedule_name: "My Irrigation Schedule",
            is_active: true,
          })
          .select()
          .single();
        if (createError) throw createError;
        scheduleId = newSchedule.id;
      }
      setCurrentScheduleId(scheduleId);
      await fetchTimeSchedules(scheduleId);
      await fetchScheduledDates(scheduleId, true);
    } catch {
      Alert.alert("Error", "Failed to load irrigation schedule");
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeSchedules = async (scheduleId: string) => {
    try {
      const { data, error } = await supabase
        .from("irrigation_time_schedules")
        .select("*")
        .eq("schedule_id", scheduleId)
        .order("time");
      if (error) throw error;
      setSchedules(data || []);
    } catch (error) {
      console.error("Error fetching time schedules:", error);
    }
  };

  /** Reschedule local notifications from all future irrigation rows (not just the visible month). */
  const syncIrrigationNotifications = async (scheduleId: string) => {
    try {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        console.warn(
          "[irrigationSchedule] Notification permission not granted; reminders not scheduled.",
        );
        return;
      }
      const { data, error } = await supabase
        .from("irrigation_scheduled_dates")
        .select("id, day, month, year, time")
        .eq("schedule_id", scheduleId);
      if (error) {
        console.error("syncIrrigationNotifications:", error);
        return;
      }
      const map = new Map<string, DateSchedule>();
      for (const d of data || []) {
        const time = d.time || "";
        if (!time || time === "Not set") continue;
        if (philippinesCalendarCompare(d.year, d.month, d.day) < 0) continue;
        const dateKey = `${d.year}-${d.month}-${d.day}`;
        if (!map.has(dateKey)) {
          map.set(dateKey, {
            day: d.day,
            month: d.month,
            year: d.year,
            schedules: [],
          });
        }
        map.get(dateKey)!.schedules.push({ id: d.id, time });
      }
      await rescheduleNotificationsForDates(map, scheduleId);
    } catch (e) {
      console.error("syncIrrigationNotifications:", e);
    }
  };

  const fetchScheduledDates = async (
    scheduleId: string,
    showLoading = false,
  ) => {
    try {
      if (showLoading) setLoading(true);
      const todayDate = new Date();
      const todayMonth = todayDate.getMonth() + 1;
      const todayYear = todayDate.getFullYear();
      const todayDay = todayDate.getDate();

      const { data, error } = await supabase
        .from("irrigation_scheduled_dates")
        .select("id, day, month, year, time")
        .eq("schedule_id", scheduleId)
        .eq("month", currentMonth + 1)
        .eq("year", currentYear)
        .order("day, time");

      if (error) {
        if (error.code === "42703" && error.message.includes("time")) {
          const { data: d2, error: e2 } = await supabase
            .from("irrigation_scheduled_dates")
            .select("id, day, month, year")
            .eq("schedule_id", scheduleId)
            .eq("month", currentMonth + 1)
            .eq("year", currentYear)
            .order("day");
          if (e2) throw e2;
          const schedulesMap = new Map<string, DateSchedule>();
          (d2 || []).forEach((d) => {
            const dateKey = `${d.year}-${d.month}-${d.day}`;
            if (!schedulesMap.has(dateKey))
              schedulesMap.set(dateKey, {
                day: d.day,
                month: d.month,
                year: d.year,
                schedules: [],
              });
            schedulesMap
              .get(dateKey)!
              .schedules.push({ id: d.id, time: "Not set" });
          });
          setScheduledDates(
            (d2 || []).map((d) => ({
              id: d.id,
              day: d.day,
              month: d.month,
              year: d.year,
              time: "Not set",
            })),
          );
          setDateSchedules(new Map(schedulesMap));
          await syncIrrigationNotifications(scheduleId);
          return;
        }
        throw error;
      }

      const schedulesMap = new Map<string, DateSchedule>();
      (data || []).forEach((d) => {
        const dateKey = `${d.year}-${d.month}-${d.day}`;
        const time = d.time || "Not set";
        if (!schedulesMap.has(dateKey))
          schedulesMap.set(dateKey, {
            day: d.day,
            month: d.month,
            year: d.year,
            schedules: [],
          });
        schedulesMap.get(dateKey)!.schedules.push({ id: d.id, time });
      });

      const formattedDates: ScheduleDate[] = (data || []).map((d) => ({
        id: d.id,
        day: d.day,
        month: d.month,
        year: d.year,
        time: d.time || "Not set",
      }));

      const { data: todayData, error: todayError } = await supabase
        .from("irrigation_scheduled_dates")
        .select("id, day, month, year, time")
        .eq("schedule_id", scheduleId)
        .eq("month", todayMonth)
        .eq("year", todayYear)
        .eq("day", todayDay)
        .order("time");

      if (!todayError && todayData && todayData.length > 0) {
        const todayDateKey = `${todayYear}-${todayMonth}-${todayDay}`;
        if (!schedulesMap.has(todayDateKey))
          schedulesMap.set(todayDateKey, {
            day: todayDay,
            month: todayMonth,
            year: todayYear,
            schedules: [],
          });
        const todaySchedule = schedulesMap.get(todayDateKey)!;
        todaySchedule.schedules = [];
        todayData.forEach((d) => {
          todaySchedule.schedules.push({ id: d.id, time: d.time || "Not set" });
          if (!formattedDates.find((fd) => fd.id === d.id)) {
            formattedDates.push({
              id: d.id,
              day: d.day,
              month: d.month,
              year: d.year,
              time: d.time || "Not set",
            });
          }
        });
      } else if (!todayError) {
        const todayDateKey = `${todayYear}-${todayMonth}-${todayDay}`;
        if (schedulesMap.has(todayDateKey)) schedulesMap.delete(todayDateKey);
      }

      const newSchedulesMap = new Map(schedulesMap);
      setScheduledDates(formattedDates);
      setDateSchedules(newSchedulesMap);
      if (scheduleId) await syncIrrigationNotifications(scheduleId);
    } catch (error) {
      console.error("Error fetching scheduled dates:", error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const canGoPrevMonth = () => {
    const currentDate = new Date();
    const prevMonthDate =
      currentMonth === 0
        ? new Date(currentYear - 1, 11)
        : new Date(currentYear, currentMonth - 1);
    return (
      prevMonthDate >=
      new Date(currentDate.getFullYear(), currentDate.getMonth())
    );
  };

  const goToPrevMonth = () => {
    if (!canGoPrevMonth()) return;
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else setCurrentMonth(currentMonth - 1);
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else setCurrentMonth(currentMonth + 1);
  };

  const isPastDate = (day: number) => {
    const selectedDate = new Date(currentYear, currentMonth, day);
    const todayDate = new Date();
    selectedDate.setHours(0, 0, 0, 0);
    todayDate.setHours(0, 0, 0, 0);
    return selectedDate < todayDate;
  };

  const isDateScheduled = (day: number) => {
    const dateKey = `${currentYear}-${currentMonth + 1}-${day}`;
    const schedule = dateSchedules.get(dateKey);
    if (!schedule) return false;
    return schedule.schedules.some(
      (entry) =>
        !isScheduleTimePast(
          schedule.year,
          schedule.month,
          schedule.day,
          entry.time,
        ),
    );
  };

  const handleDateClick = (day: number) => {
    const dateKey = `${currentYear}-${currentMonth + 1}-${day}`;
    const scheduled = dateSchedules.get(dateKey);
    if (scheduled) {
      setSelectedScheduleInfo(scheduled);
      setSelectedDateKey(dateKey);
      setScheduleInfoModalVisible(true);
    }
  };

  const isToday = (day: number) =>
    day === today.getDate() &&
    currentMonth === today.getMonth() &&
    currentYear === today.getFullYear();

  const handleAddSchedule = () => {
    setNewScheduleDates([]);
    setNewScheduleTimes([]);
    setNewScheduleTime("08:00");
    setNewSchedulePeriod("AM");
    setSelectedHour("08");
    setSelectedMinute("00");
    setEditingTimeIndex(null);
    setAddScheduleModalVisible(true);
  };

  /** Keep `irrigation_time_schedules` in sync (varchar(10) per DB). No duplicates per (schedule_id, time). */
  const syncTimeScheduleTemplates = async (
    scheduleId: string,
    timeStrings: string[],
  ) => {
    const seen = new Set<string>();
    for (const raw of timeStrings) {
      const t = raw.trim().slice(0, 10);
      if (!t || seen.has(t)) continue;
      seen.add(t);
      const { data: existing } = await supabase
        .from("irrigation_time_schedules")
        .select("id")
        .eq("schedule_id", scheduleId)
        .eq("time", t)
        .maybeSingle();
      if (existing) continue;
      const { error } = await supabase
        .from("irrigation_time_schedules")
        .insert({
          schedule_id: scheduleId,
          time: t,
          enabled: true,
        });
      if (error) {
        console.warn(
          "[irrigationSchedule] irrigation_time_schedules insert:",
          error.message,
        );
      }
    }
  };

  const addNewSchedule = async () => {
    if (
      !currentScheduleId ||
      newScheduleDates.length === 0 ||
      newScheduleTimes.length === 0
    ) {
      Alert.alert("Error", "Please select at least one date and one time");
      return;
    }
    if (isSubmitting) return; // guard against double-tap
    setIsSubmitting(true);
    try {
      const insertData: Record<string, unknown>[] = [];
      const skipped: string[] = [];

      const uniqueByClock = new Map<number, string>();
      for (const t of newScheduleTimes) {
        const m = timeToMinutes(t);
        if (!uniqueByClock.has(m)) uniqueByClock.set(m, t);
      }
      const uniqueScheduleTimes = [...uniqueByClock.values()];

      for (const day of newScheduleDates) {
        const dateKey = `${currentYear}-${currentMonth + 1}-${day}`;
        const existing = dateSchedules.get(dateKey);
        const existingMinutes = new Set(
          (existing?.schedules ?? []).map((s) => timeToMinutes(s.time)),
        );

        for (const timeString of uniqueScheduleTimes) {
          const m = timeToMinutes(timeString);
          if (existingMinutes.has(m)) {
            skipped.push(`${MONTHS[currentMonth]} ${day} @ ${timeString}`);
            continue;
          }
          insertData.push({
            schedule_id: currentScheduleId,
            scheduled_date: toScheduledDateString(
              currentYear,
              currentMonth + 1,
              day,
            ),
            month: currentMonth + 1,
            year: currentYear,
            day,
            time: timeString,
            approval_status: "approved",
          });
        }
      }

      if (insertData.length === 0) {
        Alert.alert(
          "Already Scheduled",
          skipped.length > 0
            ? `The following slot(s) already exist and were not added:\n${skipped.join("\n")}`
            : "All selected date/time combinations are already scheduled.",
        );
        setIsSubmitting(false);
        return;
      }

      const { data, error } = await supabase
        .from("irrigation_scheduled_dates")
        .insert(insertData)
        .select();
      if (error) {
        if (error.code === "42703" && error.message.includes("time")) {
          Alert.alert(
            "Database Schema Error",
            'The "time" column does not exist. Please add it:\n\nALTER TABLE irrigation_scheduled_dates ADD COLUMN time VARCHAR(20);',
          );
          return;
        }
        throw error;
      }

      await syncTimeScheduleTemplates(currentScheduleId, uniqueScheduleTimes);

      const todayDate = new Date();
      const todayDay = todayDate.getDate();
      const todayMonth = todayDate.getMonth() + 1;
      const todayYear = todayDate.getFullYear();
      const addedToday = newScheduleDates.filter(
        (day) =>
          day === todayDay &&
          currentMonth + 1 === todayMonth &&
          currentYear === todayYear,
      );
      if (addedToday.length > 0) {
        const todayDateKey = `${todayYear}-${todayMonth}-${todayDay}`;
        const currentMap = new Map(dateSchedules);
        if (!currentMap.has(todayDateKey))
          currentMap.set(todayDateKey, {
            day: todayDay,
            month: todayMonth,
            year: todayYear,
            schedules: [],
          });
        const todaySchedule = currentMap.get(todayDateKey)!;
        uniqueScheduleTimes.forEach((timeString) => {
          const inserted = data?.find((d) => {
            const dDate = new Date(d.scheduled_date);
            return (
              dDate.getDate() === todayDay &&
              dDate.getMonth() + 1 === todayMonth &&
              dDate.getFullYear() === todayYear &&
              d.time === timeString
            );
          });
          if (inserted)
            todaySchedule.schedules.push({ id: inserted.id, time: timeString });
        });
        setDateSchedules(new Map(currentMap));
        setTimeout(() => updateTodayStats(), 10);
      }
      await fetchScheduledDates(currentScheduleId);
      setAddScheduleModalVisible(false);
      Alert.alert(
        "Success",
        `Schedule added for ${newScheduleDates.length} date(s)!`,
      );
    } catch (error) {
      console.error("Error adding schedule:", error);
      Alert.alert("Error", "Failed to add schedule");
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteScheduleDate = async (scheduleId: string) => {
    try {
      const { error } = await supabase
        .from("irrigation_scheduled_dates")
        .delete()
        .eq("id", scheduleId);
      if (error) throw error;
      if (currentScheduleId) await fetchScheduledDates(currentScheduleId);
      setScheduleInfoModalVisible(false);
      Alert.alert("Success", "Schedule deleted");
    } catch (error) {
      console.error("Error deleting schedule:", error);
      Alert.alert("Error", "Failed to delete schedule");
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

    // If today is one of the selected dates, block past times
    const todayDate = new Date();
    const todayDay = todayDate.getDate();
    const todayMonth = todayDate.getMonth() + 1;
    const todayYear = todayDate.getFullYear();
    const todayIsSelected =
      currentMonth + 1 === todayMonth &&
      currentYear === todayYear &&
      newScheduleDates.includes(todayDay);

    if (todayIsSelected) {
      let hour = Number(selectedHour);
      const minute = Number(selectedMinute);
      if (newSchedulePeriod === "PM" && hour !== 12) hour += 12;
      if (newSchedulePeriod === "AM" && hour === 12) hour = 0;
      const selectedTotalMinutes = hour * 60 + minute;
      const nowTotalMinutes =
        todayDate.getHours() * 60 + todayDate.getMinutes();
      if (selectedTotalMinutes <= nowTotalMinutes) {
        Alert.alert(
          "Past Time",
          `${timeString} has already passed for today. Please select a future time.`,
        );
        return;
      }
    }

    const duplicateInList = newScheduleTimes.some((t, i) => {
      if (editingTimeIndex !== null && i === editingTimeIndex) return false;
      return timesMatchClock(t, timeString);
    });
    if (duplicateInList) {
      Alert.alert(
        "Duplicate time",
        "That time is already in your list. Choose a different time or remove the existing one first.",
      );
      return;
    }

    if (editingTimeIndex !== null) {
      const updated = [...newScheduleTimes];
      updated[editingTimeIndex] = timeString;
      setNewScheduleTimes(updated);
      setEditingTimeIndex(null);
    } else {
      setNewScheduleTimes([...newScheduleTimes, timeString]);
    }
    setNewScheduleTime("08:00");
    setNewSchedulePeriod("AM");
    setSelectedHour("08");
    setSelectedMinute("00");
    setShowTimePicker(false);
  };

  const handleCancelTime = () => {
    setShowTimePicker(false);
    setEditingTimeIndex(null);
    const [hour, minute] = newScheduleTime.split(":");
    setSelectedHour(hour);
    setSelectedMinute(minute);
  };
  const handleAddTime = () => {
    setEditingTimeIndex(null);
    setNewScheduleTime("08:00");
    setNewSchedulePeriod("AM");
    setSelectedHour("08");
    setSelectedMinute("00");
    setShowTimePicker(true);
  };

  const handleEditTime = (index: number) => {
    const timeString = newScheduleTimes[index];
    // If today is selected as a target date, do not allow editing a time that already passed.
    const todayIsSelected =
      currentMonth === nowTick.getMonth() &&
      currentYear === nowTick.getFullYear() &&
      newScheduleDates.includes(nowTick.getDate());
    if (todayIsSelected) {
      const currentMinutes = nowTick.getHours() * 60 + nowTick.getMinutes();
      if (timeToMinutes(timeString) <= currentMinutes) {
        Alert.alert(
          "Past time",
          "That time has already passed for today. Please add a new future time instead.",
        );
        return;
      }
    }
    const [timePart, period] = timeString.split(" ");
    const [hour, minute] = timePart.split(":");
    setEditingTimeIndex(index);
    setNewScheduleTime(timePart);
    setNewSchedulePeriod(period as "AM" | "PM");
    setSelectedHour(hour);
    setSelectedMinute(minute);
    setShowTimePicker(true);
  };

  const handleRemoveTime = (index: number) => {
    setNewScheduleTimes(newScheduleTimes.filter((_, i) => i !== index));
  };

  const toggleDateSelection = (day: number) => {
    if (newScheduleDates.includes(day))
      setNewScheduleDates(newScheduleDates.filter((d) => d !== day));
    else setNewScheduleDates([...newScheduleDates, day]);
  };

  const getAvailableDates = () => {
    const available: number[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      if (!isPastDate(day)) available.push(day);
    }
    return available;
  };

  const timeToMinutes = (timeStr: string): number => {
    try {
      const [time, period] = timeStr.split(" ");
      const [hour, minute] = time.split(":").map(Number);
      let total = hour * 60 + minute;
      if (period === "PM" && hour !== 12) total += 12 * 60;
      else if (period === "AM" && hour === 12) total -= 12 * 60;
      return total;
    } catch {
      return 0;
    }
  };

  /** Same clock time (avoids duplicate "08:00 AM" vs "8:00 AM" if formats differ). */
  const timesMatchClock = (a: string, b: string): boolean =>
    timeToMinutes(a) === timeToMinutes(b);

  const getTodayScheduledTimes = (): { time: string; minutes: number }[] => {
    const dateKey = `${nowTick.getFullYear()}-${nowTick.getMonth() + 1}-${nowTick.getDate()}`;
    const todaySchedule = dateSchedules.get(dateKey);
    if (!todaySchedule) return [];
    const currentMinutes = nowTick.getHours() * 60 + nowTick.getMinutes();
    return todaySchedule.schedules
      .map((s) => ({ time: s.time, minutes: timeToMinutes(s.time) }))
      .filter((s) => s.minutes > currentMinutes)
      .sort((a, b) => a.minutes - b.minutes);
  };

  const updateTodayStats = () => {
    const todayTimes = getTodayScheduledTimes();
    setTodayScheduledTimesCount(todayTimes.length);
    if (todayTimes.length === 0) {
      setNextScheduleTime("No schedule");
      return;
    }
    const currentMinutes = nowTick.getHours() * 60 + nowTick.getMinutes();
    const next = todayTimes.find((t) => t.minutes > currentMinutes);
    setNextScheduleTime(next ? next.time : "No more today");
  };

  const handleAlarmOK = async () => {
    if (!alarmScheduleData || !currentScheduleId) {
      setAlarmModalVisible(false);
      setAlarmScheduleData(null);
      return;
    }
    try {
      const dateKey = `${alarmScheduleData.year}-${alarmScheduleData.month}-${alarmScheduleData.day}`;
      const dateSchedule = dateSchedules.get(dateKey);
      let scheduleEntryId: string | null = null;
      if (dateSchedule) {
        const entry = dateSchedule.schedules.find(
          (s) => s.time === alarmScheduleData.time,
        );
        if (entry) scheduleEntryId = entry.id;
      }
      if (!scheduleEntryId) {
        const { data: sd, error: qe } = await supabase
          .from("irrigation_scheduled_dates")
          .select("id")
          .eq("schedule_id", currentScheduleId)
          .eq("day", alarmScheduleData.day)
          .eq("month", alarmScheduleData.month)
          .eq("year", alarmScheduleData.year)
          .eq("time", alarmScheduleData.time)
          .limit(1)
          .single();
        if (!qe && sd) scheduleEntryId = sd.id;
      }
      if (scheduleEntryId) {
        const { error } = await supabase
          .from("irrigation_scheduled_dates")
          .delete()
          .eq("id", scheduleEntryId);
        if (error) throw error;
      }
      await fetchScheduledDates(currentScheduleId);
      setAlarmModalVisible(false);
      setAlarmScheduleData(null);
    } catch (error) {
      console.error("Error deleting schedule from alarm:", error);
      Alert.alert("Error", "Failed to dismiss schedule");
      setAlarmModalVisible(false);
      setAlarmScheduleData(null);
    }
  };

  /** True if this date+time is already over (for gray styling; delete still allowed). */
  const isScheduleTimePast = (
    year: number,
    month: number,
    day: number,
    timeStr: string,
  ): boolean => {
    if (!timeStr || timeStr === "Not set") return false;
    const now = nowTick;
    const dayStart = new Date(year, month - 1, day);
    dayStart.setHours(0, 0, 0, 0);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    if (dayStart.getTime() < todayStart.getTime()) return true;
    if (dayStart.getTime() > todayStart.getTime()) return false;
    const timeMin = timeToMinutes(timeStr);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return timeMin <= currentMinutes;
  };

  // Get today's scheduled times list for TIME SCHEDULE card
  const todayTimes = getTodayScheduledTimes();

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
        {/* ── Header ── */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <FontAwesome name="chevron-left" size={18} color={colors.dark} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>IRRIGATION SCHEDULE</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Calendar ── */}
          <View style={styles.calendarSection}>
            <View style={styles.monthNav}>
              {canGoPrevMonth() ? (
                <TouchableOpacity
                  onPress={goToPrevMonth}
                  style={styles.navButton}
                >
                  <FontAwesome
                    name="chevron-left"
                    size={16}
                    color={colors.grayText}
                  />
                </TouchableOpacity>
              ) : (
                <View style={[styles.navButton, styles.navButtonDisabled]} />
              )}
              <Text style={styles.monthTitle}>
                {MONTHS[currentMonth].toUpperCase()}
              </Text>
              <TouchableOpacity
                onPress={goToNextMonth}
                style={styles.navButton}
              >
                <FontAwesome
                  name="chevron-right"
                  size={16}
                  color={colors.grayText}
                />
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
                    disabled={
                      day === null || (isPast && !isDateScheduled(day ?? 0))
                    }
                  >
                    <Text
                      style={[
                        styles.dayText,
                        day === null && styles.emptyDay,
                        isSelected && styles.selectedDayText,
                        isTodayDate && !isSelected && styles.todayText,
                        isPast && styles.pastDayText,
                      ]}
                    >
                      {day || ""}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {Array.from(dateSchedules.values()).some(
            (s) => s.month === currentMonth + 1 && s.year === currentYear,
          ) && (
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: colors.primary },
                  ]}
                />
                <Text style={styles.legendText}>Scheduled</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: colors.grayText },
                  ]}
                />
                <Text style={styles.legendText}>Available</Text>
              </View>
            </View>
          )}

          {/* ── TIME SCHEDULE Card ── */}
          <View style={styles.timeScheduleCard}>
            <View style={styles.timeScheduleLeft}>
              <Text style={styles.timeScheduleLabel}>TIME{"\n"}SCHEDULE</Text>
            </View>
            <View style={styles.timeScheduleDivider} />
            <View style={styles.timeScheduleRight}>
              {todayTimes.length > 0 ? (
                todayTimes.map((t, i) => (
                  <Text key={i} style={styles.timeScheduleItem}>
                    {t.time}
                  </Text>
                ))
              ) : (
                <Text style={styles.timeScheduleEmpty}>No schedule today</Text>
              )}
            </View>
          </View>

          {/* ── Sensor Cards ── */}
          <SensorCard
            label="Soil Moisture"
            value={soilMoisture}
            max={100}
            unit="%"
            trackColor={colors.grayBorder}
            fillColor="#10B981"
            icon="tint"
            iconColor="#22C55E"
            iconBg={colors.primaryLight}
          />
          <SensorCard
            label="Temperature"
            value={temperature}
            max={50}
            unit="°C"
            trackColor={colors.grayBorder}
            fillColor="#EF4444"
            icon="thermometer-half"
            iconColor="#F97316"
            iconBg={colors.warningLight}
          />
          <SensorCard
            label="Humidity"
            value={humidity}
            max={100}
            unit="%"
            trackColor={colors.grayBorder}
            fillColor="#7C3AED"
            icon="leaf"
            iconColor="#A855F7"
            iconBg={colors.purpleLight}
          />
        </ScrollView>

        {/* ── FAB ── */}
        <TouchableOpacity style={styles.fab} onPress={handleAddSchedule}>
          <FontAwesome name="plus" size={24} color={colors.white} />
        </TouchableOpacity>

        {/* ── Add Schedule Modal ── */}
        <Modal
          animationType="fade"
          transparent
          visible={addScheduleModalVisible}
          onRequestClose={() => setAddScheduleModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.addScheduleModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Irrigation Schedule</Text>
                <TouchableOpacity
                  onPress={() => setAddScheduleModalVisible(false)}
                >
                  <FontAwesome name="times" size={24} color={colors.dark} />
                </TouchableOpacity>
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  Select Date(s) - Multiple selection allowed
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.dateScroll}
                >
                  {getAvailableDates().map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.dateOption,
                        newScheduleDates.includes(day) &&
                          styles.dateOptionSelected,
                      ]}
                      onPress={() => toggleDateSelection(day)}
                    >
                      <Text
                        style={[
                          styles.dateOptionText,
                          newScheduleDates.includes(day) &&
                            styles.dateOptionTextSelected,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {newScheduleDates.length > 0 && (
                  <Text style={styles.selectedDatesText}>
                    Selected:{" "}
                    {newScheduleDates.sort((a, b) => a - b).join(", ")}
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
                {newScheduleTimes.length > 0 && (
                  <View style={styles.timesList}>
                    {newScheduleTimes
                      .filter((time) => {
                        const todayIsSelected =
                          currentMonth === nowTick.getMonth() &&
                          currentYear === nowTick.getFullYear() &&
                          newScheduleDates.includes(nowTick.getDate());
                        if (!todayIsSelected) return true;
                        const currentMinutes =
                          nowTick.getHours() * 60 + nowTick.getMinutes();
                        return timeToMinutes(time) > currentMinutes;
                      })
                      .map((time, index) => (
                        <View key={index} style={styles.timeItem}>
                          <Text style={styles.timeItemText}>{time}</Text>
                          <View style={styles.timeItemActions}>
                            <TouchableOpacity
                              style={styles.timeItemButton}
                              onPress={() => handleEditTime(index)}
                            >
                              <FontAwesome
                                name="pencil"
                                size={12}
                                color={colors.brandBlue}
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.timeItemButton}
                              onPress={() => handleRemoveTime(index)}
                            >
                              <FontAwesome
                                name="times"
                                size={12}
                                color="#EF4444"
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                  </View>
                )}
                {showTimePicker && (
                  <View style={styles.timePickerSection}>
                    <Text style={styles.timePickerTitle}>
                      {editingTimeIndex !== null ? "Edit Time" : "Add New Time"}
                    </Text>
                    <View style={styles.timeInputRow}>
                      <TouchableOpacity style={styles.timeSelector}>
                        <Text style={styles.timeSelectorText}>
                          {newScheduleTime}
                        </Text>
                        <FontAwesome
                          name="chevron-down"
                          size={12}
                          color={colors.grayText}
                        />
                      </TouchableOpacity>
                      <View style={styles.periodButtons}>
                        {(["AM", "PM"] as const).map((p) => (
                          <TouchableOpacity
                            key={p}
                            style={[
                              styles.periodButton,
                              newSchedulePeriod === p &&
                                styles.periodButtonActive,
                            ]}
                            onPress={() => setNewSchedulePeriod(p)}
                          >
                            <Text
                              style={[
                                styles.periodButtonText,
                                newSchedulePeriod === p &&
                                  styles.periodButtonTextActive,
                              ]}
                            >
                              {p}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    <View style={styles.timePickerWrapper}>
                      <View style={styles.timePickerContainer}>
                        <View style={styles.timePickerColumn}>
                          <Text style={styles.timePickerLabel}>Hour</Text>
                          <ScrollView
                            style={styles.timePickerScroll}
                            showsVerticalScrollIndicator={false}
                          >
                            {hours.map((hour) => (
                              <TouchableOpacity
                                key={hour}
                                style={[
                                  styles.timePickerOption,
                                  selectedHour === hour &&
                                    styles.timePickerOptionSelected,
                                ]}
                                onPress={() => handleSelectHour(hour)}
                              >
                                <Text
                                  style={[
                                    styles.timePickerOptionText,
                                    selectedHour === hour &&
                                      styles.timePickerOptionTextSelected,
                                  ]}
                                >
                                  {hour}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                        <View style={styles.timePickerColumn}>
                          <Text style={styles.timePickerLabel}>Minute</Text>
                          <ScrollView
                            style={styles.timePickerScroll}
                            showsVerticalScrollIndicator={false}
                          >
                            {minutes.map((minute) => (
                              <TouchableOpacity
                                key={minute}
                                style={[
                                  styles.timePickerOption,
                                  selectedMinute === minute &&
                                    styles.timePickerOptionSelected,
                                ]}
                                onPress={() => handleSelectMinute(minute)}
                              >
                                <Text
                                  style={[
                                    styles.timePickerOptionText,
                                    selectedMinute === minute &&
                                      styles.timePickerOptionTextSelected,
                                  ]}
                                >
                                  {minute}
                                </Text>
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
                          <Text style={styles.timePickerCancelText}>
                            Cancel
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.timePickerConfirmButton}
                          onPress={handleConfirmTime}
                        >
                          <Text style={styles.timePickerConfirmText}>
                            Confirm
                          </Text>
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
                    disabled={isSubmitting}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.addButton,
                      (newScheduleDates.length === 0 ||
                        newScheduleTimes.length === 0 ||
                        isSubmitting) &&
                        styles.addButtonDisabled,
                    ]}
                    onPress={addNewSchedule}
                    disabled={
                      newScheduleDates.length === 0 ||
                      newScheduleTimes.length === 0 ||
                      isSubmitting
                    }
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Text style={styles.addButtonText}>Add Schedule</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* ── Schedule Info Modal ── */}
        <Modal
          animationType="fade"
          transparent
          visible={scheduleInfoModalVisible}
          onRequestClose={() => setScheduleInfoModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.infoModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Schedule Details</Text>
                <TouchableOpacity
                  onPress={() => setScheduleInfoModalVisible(false)}
                >
                  <FontAwesome name="times" size={24} color={colors.dark} />
                </TouchableOpacity>
              </View>
              {selectedScheduleInfo &&
                (() => {
                  const rows = selectedScheduleInfo.schedules;

                  const now = new Date();
                  const currentMinutes = now.getHours() * 60 + now.getMinutes();

                  const selectedStart = new Date(
                    selectedScheduleInfo.year,
                    selectedScheduleInfo.month - 1,
                    selectedScheduleInfo.day,
                  );
                  selectedStart.setHours(0, 0, 0, 0);

                  const todayStart = new Date();
                  todayStart.setHours(0, 0, 0, 0);

                  const isTodaySelected =
                    selectedScheduleInfo.year === now.getFullYear() &&
                    selectedScheduleInfo.month === now.getMonth() + 1 &&
                    selectedScheduleInfo.day === now.getDate();

                  // Hide schedules when:
                  // - the selected date is in the past, OR
                  // - the selected date is today and the time has already passed.
                  const filteredRows =
                    selectedStart.getTime() < todayStart.getTime()
                      ? []
                      : isTodaySelected
                        ? rows.filter(
                            (r) => timeToMinutes(r.time) > currentMinutes,
                          )
                        : rows;

                  if (filteredRows.length === 0)
                    return (
                      <View style={styles.scheduleInfoBody}>
                        <Text style={styles.noSchedulesText}>
                          No upcoming schedules for this date.
                        </Text>
                      </View>
                    );

                  return (
                    <View style={styles.scheduleInfoBody}>
                      <View style={styles.infoRow}>
                        <FontAwesome
                          name="calendar"
                          size={20}
                          color={colors.primary}
                        />
                        <View style={styles.infoContent}>
                          <Text style={styles.infoLabel}>Date</Text>
                          <Text style={styles.infoValue}>
                            {MONTHS[selectedScheduleInfo.month - 1]}{" "}
                            {selectedScheduleInfo.day},{" "}
                            {selectedScheduleInfo.year}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.infoRow}>
                        <FontAwesome
                          name="clock-o"
                          size={20}
                          color={colors.primary}
                        />
                        <View style={styles.infoContent}>
                          <Text style={styles.infoLabel}>Time(s)</Text>
                          <Text style={styles.infoHintPast}>
                            Past dates/times are hidden.
                          </Text>
                          <View style={styles.timesList}>
                            {filteredRows.map((schedule) => (
                              <View key={schedule.id} style={styles.timeItem}>
                                <Text style={styles.timeItemText}>
                                  {schedule.time}
                                </Text>
                                <TouchableOpacity
                                  style={styles.timeItemDeleteButton}
                                  onPress={() =>
                                    deleteScheduleDate(schedule.id)
                                  }
                                  accessibilityLabel="Delete schedule"
                                >
                                  <FontAwesome
                                    name="times"
                                    size={12}
                                    color="#EF4444"
                                  />
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

        {/* ── Alarm Modal ── */}
        <Modal
          animationType="fade"
          transparent
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
                      <FontAwesome
                        name="calendar"
                        size={20}
                        color={colors.grayText}
                      />
                      <Text style={styles.alarmInfoText}>
                        {MONTHS[alarmScheduleData.month - 1]}{" "}
                        {alarmScheduleData.day}, {alarmScheduleData.year}
                      </Text>
                    </View>
                    <View style={styles.alarmInfoRow}>
                      <FontAwesome
                        name="clock-o"
                        size={20}
                        color={colors.grayText}
                      />
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
  safeArea: { flex: 1, backgroundColor: colors.grayLight },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: {
    marginTop: 12,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.grayText,
  },
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.grayLight,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.grayBorder,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  backButton: { padding: 4, width: 32 },
  topBarTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.dark,
    letterSpacing: 0.5,
  },
  placeholder: { width: 32 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 14, paddingBottom: 100 },

  // Calendar
  calendarSection: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.grayBorder,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 3,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    marginBottom: 4,
  },
  navButton: {
    padding: 8,
    backgroundColor: colors.grayLight,
    borderRadius: 10,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  navButtonDisabled: { backgroundColor: "transparent" },
  monthTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.dark,
    letterSpacing: 1,
    minWidth: 140,
    textAlign: "center",
  },
  yearText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.grayText,
    textAlign: "center",
    marginBottom: 14,
  },
  dayHeaders: { flexDirection: "row", marginBottom: 8 },
  dayHeader: {
    flex: 1,
    textAlign: "center",
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.grayText,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderRadius: 12,
    overflow: "hidden",
  },
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderColor: colors.grayBorder,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.white,
  },
  dayText: { fontFamily: fonts.regular, fontSize: 14, color: colors.dark },
  emptyDay: { color: "transparent" },
  selectedDay: {
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  selectedDayText: { color: colors.white, fontFamily: fonts.bold },
  todayText: { color: colors.accent, fontFamily: fonts.bold },
  pastDay: { backgroundColor: "#F7F7F7" },
  pastDayText: { color: "#D1D5DB" },
  legend: { flexDirection: "row", justifyContent: "center", gap: 24 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.grayText,
  },

  // TIME SCHEDULE card
  timeScheduleCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.grayBorder,
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  timeScheduleLeft: {
    paddingVertical: 16,
    paddingHorizontal: 14,
    justifyContent: "center",
    backgroundColor: colors.grayLight,
  },
  timeScheduleLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.dark,
    letterSpacing: 0.5,
    lineHeight: 20,
  },
  timeScheduleDivider: { width: 1, backgroundColor: colors.grayBorder },
  timeScheduleRight: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: "center",
    gap: 4,
  },
  timeScheduleItem: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.dark,
  },
  timeScheduleEmpty: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.grayText,
    fontStyle: "italic",
  },

  // FAB
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  addScheduleModalContent: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 20,
    width: "100%",
    maxWidth: 400,
  },
  infoModalContent: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 20,
    width: "100%",
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.dark },
  inputContainer: { marginBottom: 20 },
  inputLabel: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.dark,
    marginBottom: 12,
  },
  dateScroll: { flexDirection: "row" },
  dateOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: colors.grayLight,
    borderWidth: 1,
    borderColor: colors.grayBorder,
    marginRight: 8,
    minWidth: 50,
    alignItems: "center",
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
  dateOptionTextSelected: { color: colors.white, fontFamily: fonts.bold },
  selectedDatesText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.grayText,
    marginTop: 8,
  },
  timeInputContainer: { marginBottom: 20 },
  timeHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  addTimeButton: {
    flexDirection: "row",
    alignItems: "center",
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
  timesList: { gap: 8, marginTop: 8 },
  timeItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.grayLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.grayBorder,
  },
  timeItemText: { fontFamily: fonts.medium, fontSize: 14, color: colors.dark },
  timeItemPast: {
    backgroundColor: "#F1F5F9",
    borderColor: colors.grayBorder,
    opacity: 0.95,
  },
  timeItemTextPast: { color: colors.grayText },
  timeItemActions: { flexDirection: "row", gap: 8 },
  timeItemButton: { padding: 4 },
  timeItemDeleteButton: { padding: 4 },
  timeInputRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  timeSelector: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.grayBorder,
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeSelectorText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.dark,
  },
  periodButtons: { flexDirection: "row", gap: 8 },
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
  periodButtonTextActive: { color: colors.white },
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
  timePickerWrapper: { marginTop: 12 },
  timePickerContainer: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.grayLight,
    borderRadius: 10,
    padding: 12,
  },
  timePickerColumn: { flex: 1 },
  timePickerLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.grayText,
    marginBottom: 8,
    textAlign: "center",
  },
  timePickerScroll: { maxHeight: 120 },
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
    textAlign: "center",
  },
  timePickerOptionTextSelected: {
    color: colors.primaryDark,
    fontFamily: fonts.semibold,
  },
  timePickerActions: { flexDirection: "row", gap: 12, marginTop: 12 },
  timePickerCancelButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
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
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  timePickerConfirmText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.white,
  },
  addScheduleModalActions: { flexDirection: "row", gap: 12, marginTop: 24 },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
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
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  addButtonDisabled: { backgroundColor: colors.grayText },
  addButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.white,
  },
  scheduleInfoBody: { gap: 16 },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    backgroundColor: colors.grayLight,
    borderRadius: 12,
  },
  infoContent: { flex: 1 },
  infoLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.grayText,
    marginBottom: 4,
  },
  infoHintPast: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.grayText,
    marginBottom: 8,
    opacity: 0.9,
  },
  infoValue: { fontFamily: fonts.semibold, fontSize: 16, color: colors.dark },
  noSchedulesText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.grayText,
    textAlign: "center",
    padding: 20,
  },
  alarmModalContent: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  alarmIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  alarmTitle: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.dark,
    marginBottom: 8,
    textAlign: "center",
  },
  alarmMessage: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.grayText,
    marginBottom: 24,
    textAlign: "center",
  },
  alarmInfoContainer: { width: "100%", gap: 12, marginBottom: 24 },
  alarmInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: colors.grayLight,
    borderRadius: 10,
  },
  alarmInfoText: { fontFamily: fonts.medium, fontSize: 14, color: colors.dark },
  alarmOKButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  alarmOKButtonText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.white,
  },
});
