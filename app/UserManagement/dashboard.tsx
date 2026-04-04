import { FontAwesome } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, {
  Circle,
  Defs,
  Stop,
  LinearGradient as SvgLinearGradient,
} from "react-native-svg";

import { clearAllStorage } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { getWeatherData } from "../../lib/weatherConfig";

// ── Config ─────────────────────────────────────────────────────────────────
const DEFAULT_COORDS = { latitude: 15.53, longitude: 120.6042 };

// ── Helpers ─────────────────────────────────────────────────────────────────
function formatPHTime(isoString: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(isoString));
}

function getWeatherEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code === 1) return "🌤️";
  if (code === 2) return "⛅";
  if (code === 3) return "☁️";
  if (code >= 45 && code <= 48) return "🌫️";
  if (code >= 51 && code <= 55) return "🌦️";
  if (code >= 56 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "🌨️";
  if (code >= 80 && code <= 82) return "🌧️";
  if (code >= 85 && code <= 86) return "❄️";
  if (code === 95) return "⛈️";
  if (code >= 96) return "🌩️";
  return "🌡️";
}

function getWeatherDescription(code: number): string {
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code >= 45 && code <= 48) return "Foggy";
  if (code >= 51 && code <= 55) return "Drizzle";
  if (code >= 56 && code <= 57) return "Freezing drizzle";
  if (code >= 61 && code <= 65) return "Rain";
  if (code >= 66 && code <= 67) return "Freezing rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code >= 85 && code <= 86) return "Snow showers";
  if (code === 95) return "Thunderstorm";
  if (code >= 96) return "Thunderstorm w/ hail";
  return "Cloudy";
}

// ── Design tokens ───────────────────────────────────────────────────────────
const colors = {
  brandGreen: "#3E9B4F",
  brandBlue: "#007AFF",
  brandBlueAlt: "#3B82F6",
  brandGrayText: "#6B7280",
  brandGrayBorder: "#E5E7EB",
  cardBg: "#F9FAFB",
  orange: "#F97316",
  purple: "#A855F7",
};

const fonts = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semibold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
};

const MENU_ITEMS = [
  { key: "soil", icon: "globe", label: "Soil Moisture" },
  { key: "temp", icon: "thermometer", label: "Temperature" },
  { key: "humidity", icon: "tint", label: "Humidity" },
  { key: "weather", icon: "cloud", label: "Weather Update" },
  {
    key: "automated-irrigation",
    icon: "refresh",
    label: "Automated Irrigation",
  },
  { key: "monitoring", icon: "line-chart", label: "Monitoring & Adjustments" },
  { key: "water-requirement", icon: "percent", label: "Water Requirement" },
  {
    key: "irrigation-history",
    icon: "folder",
    label: "Irrigation & Water Logging",
  },
];

const ANALYTICS_SUB_ITEMS = [
  { key: "env", label: "Pattern Analyzer" },
  { key: "seasonal", label: "Seasonal Summary" },
];

const DRAWER_WIDTH = Math.min(320, Dimensions.get("window").width * 0.8);

// ── Circular Gauge ──────────────────────────────────────────────────────────
interface GaugeProps {
  value: number;
  maxValue: number;
  size?: number;
  strokeWidth?: number;
  gradientColors: string[];
  label: string;
  subLabel: string;
  unit?: string;
  icon?: React.ReactNode;
}

function CircularGauge({
  value,
  maxValue,
  size = 90,
  strokeWidth = 8,
  gradientColors,
  label,
  subLabel,
  unit = "%",
  icon,
}: GaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / maxValue, 1);
  const strokeDashoffset = circumference * (1 - progress * 0.75);

  return (
    <View style={gaugeStyles.container}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Defs>
            <SvgLinearGradient
              id={`grad-${label}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <Stop offset="0%" stopColor={gradientColors[0]} />
              <Stop offset="100%" stopColor={gradientColors[1]} />
            </SvgLinearGradient>
          </Defs>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#E5E7EB"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * 0.25}
            rotation={135}
            origin={`${size / 2}, ${size / 2}`}
            strokeLinecap="round"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={`url(#grad-${label})`}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            rotation={135}
            origin={`${size / 2}, ${size / 2}`}
            strokeLinecap="round"
          />
        </Svg>
        <View style={gaugeStyles.centerContent}>
          {icon}
          <Text style={gaugeStyles.valueText}>
            {value}
            {unit}
          </Text>
        </View>
      </View>
      <Text style={gaugeStyles.label}>{label}</Text>
      <Text style={gaugeStyles.subLabel}>{subLabel}</Text>
    </View>
  );
}

const gaugeStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
  },
  centerContent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  valueText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: "#1F2937",
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: "#1F2937",
    marginTop: 4,
  },
  subLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.brandGrayText,
  },
});

// ── Forecast Mini Card ──────────────────────────────────────────────────────
const ForecastMiniCard = ({
  day,
  date,
  code,
  high,
  low,
  precipitation,
  isToday,
}: {
  day: string;
  date: string;
  code: number;
  high: number;
  low: number;
  precipitation: number;
  isToday: boolean;
}) => (
  <View style={[fStyles.card, isToday && fStyles.cardToday]}>
    <Text style={[fStyles.day, isToday && fStyles.dayToday]}>{day}</Text>
    <Text style={[fStyles.date, isToday && fStyles.dateToday]}>{date}</Text>
    <Text style={fStyles.emoji}>{getWeatherEmoji(code)}</Text>
    <Text
      style={[fStyles.desc, isToday && fStyles.descToday]}
      numberOfLines={2}
    >
      {getWeatherDescription(code)}
    </Text>
    <View style={fStyles.temps}>
      <Text style={[fStyles.high, isToday && { color: "#FED7AA" }]}>
        {high}°
      </Text>
      <Text style={[fStyles.low, isToday && { color: "#BFDBFE" }]}>{low}°</Text>
    </View>
    {precipitation > 0 && (
      <View style={fStyles.rain}>
        <FontAwesome
          name="tint"
          size={9}
          color={isToday ? "#BFDBFE" : colors.brandBlueAlt}
        />
        <Text style={[fStyles.rainText, isToday && { color: "#BFDBFE" }]}>
          {precipitation.toFixed(1)}mm
        </Text>
      </View>
    )}
  </View>
);

const fStyles = StyleSheet.create({
  card: {
    width: 88,
    borderRadius: 14,
    padding: 9,
    gap: 3,
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardToday: {
    backgroundColor: colors.brandBlueAlt,
    borderColor: colors.brandBlueAlt,
  },
  day: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dayToday: { color: "rgba(255,255,255,0.7)" },
  date: { fontFamily: fonts.regular, fontSize: 9, color: "#94A3B8" },
  dateToday: { color: "rgba(255,255,255,0.6)" },
  emoji: { fontSize: 22, lineHeight: 28 },
  desc: {
    fontFamily: fonts.regular,
    fontSize: 9,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 13,
  },
  descToday: { color: "rgba(255,255,255,0.8)" },
  temps: { flexDirection: "row", gap: 5 },
  high: { fontFamily: fonts.bold, fontSize: 12, color: "#EF4444" },
  low: { fontFamily: fonts.bold, fontSize: 12, color: colors.brandBlueAlt },
  rain: { flexDirection: "row", alignItems: "center", gap: 3 },
  rainText: {
    fontFamily: fonts.regular,
    fontSize: 9,
    color: colors.brandBlueAlt,
  },
});

// ── Main Screen ─────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === "string" ? params.email : "";
  const router = useRouter();

  const [soilMoisturePercent, setSoilMoisturePercent] = useState<number>(0);
  const [temperatureValue, setTemperatureValue] = useState<number>(0);
  const [humidityPercent, setHumidityPercent] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<
    {
      id: number;
      type: string;
      title: string;
      message: string;
      is_read: boolean | null;
      created_at: string | null;
    }[]
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedRecommendation, setSelectedRecommendation] = useState<{
    title: string;
    message: string;
  } | null>(null);

  // ── Forecast state ──
  const [forecastData, setForecastData] = useState<any>(null);
  const [forecastLoading, setForecastLoading] = useState(true);

  // ── Fetch sensor data ──
  useEffect(() => {
    const fetchSensorData = async () => {
      try {
        const { data: soilData } = await supabase
          .from("sensor_reading")
          .select("value, timestamp")
          .eq("sensor_id", 3)
          .order("timestamp", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (soilData) {
          const raw = Number(soilData.value);
          const percent = Math.round((raw / 1023) * 100);
          const clamped = Math.min(100, Math.max(0, percent));
          setSoilMoisturePercent(clamped);
        }

        const { data: tempData } = await supabase
          .from("sensor_reading")
          .select("value, timestamp")
          .eq("sensor_id", 1)
          .order("timestamp", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (tempData) setTemperatureValue(Math.round(tempData.value * 10) / 10);

        const { data: humidData } = await supabase
          .from("sensor_reading")
          .select("value, timestamp")
          .eq("sensor_id", 2)
          .order("timestamp", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (humidData) setHumidityPercent(Math.round(humidData.value));

        const timestamps = [
          soilData?.timestamp,
          tempData?.timestamp,
          humidData?.timestamp,
        ].filter(Boolean) as string[];
        if (timestamps.length > 0) {
          const latest = timestamps.reduce((a, b) =>
            new Date(a) > new Date(b) ? a : b,
          );
          setLastUpdated(latest);
        }
      } catch (error) {
        console.error("Error fetching sensor data:", error);
      }
    };

    fetchSensorData();
  }, []);

  // ── Fetch 7-day forecast ──
  useEffect(() => {
    getWeatherData(DEFAULT_COORDS.latitude, DEFAULT_COORDS.longitude)
      .then(setForecastData)
      .catch(() => {})
      .finally(() => setForecastLoading(false));
  }, []);

  const [fullName, setFullName] = useState<string>("Farmer");
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [loadingName, setLoadingName] = useState<boolean>(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [nextScheduleTime, setNextScheduleTime] =
    useState<string>("No scheduled time");
  const drawerX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  const timeToMinutes = (timeStr: string): number => {
    try {
      const [time, period] = timeStr.trim().split(" ");
      const [hour, minute] = time.split(":").map(Number);
      let total = hour * 60 + minute;
      if (period === "PM" && hour !== 12) total += 12 * 60;
      else if (period === "AM" && hour === 12) total -= 12 * 60;
      return total;
    } catch {
      return -1;
    }
  };

  const fetchNextSchedule = useCallback(async (uid: string) => {
    try {
      const { data: scheduleData } = await supabase
        .from("irrigation_schedules")
        .select("id")
        .eq("user_id", uid)
        .eq("is_active", true)
        .maybeSingle();

      if (!scheduleData) {
        setNextScheduleTime("No scheduled time");
        return;
      }

      const now = new Date();
      const todayDay = now.getDate();
      const todayMonth = now.getMonth() + 1;
      const todayYear = now.getFullYear();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const { data: todayRows } = await supabase
        .from("irrigation_scheduled_dates")
        .select("time")
        .eq("schedule_id", scheduleData.id)
        .eq("day", todayDay)
        .eq("month", todayMonth)
        .eq("year", todayYear)
        .order("time");

      if (todayRows && todayRows.length > 0) {
        const upcoming = todayRows
          .map((r) => r.time as string)
          .filter((t) => t && t !== "Not set")
          .sort((a, b) => timeToMinutes(a) - timeToMinutes(b))
          .find((t) => timeToMinutes(t) > currentMinutes);
        if (upcoming) {
          setNextScheduleTime(upcoming);
          return;
        }
      }

      const { data: futureRows } = await supabase
        .from("irrigation_scheduled_dates")
        .select("day, month, year, time")
        .eq("schedule_id", scheduleData.id)
        .gte("year", todayYear)
        .order("year")
        .order("month")
        .order("day")
        .order("time");

      if (futureRows && futureRows.length > 0) {
        const future = futureRows.find((r) => {
          if (!r.time || r.time === "Not set") return false;
          const rDate = new Date(r.year, r.month - 1, r.day);
          const today = new Date(todayYear, todayMonth - 1, todayDay);
          rDate.setHours(0, 0, 0, 0);
          today.setHours(0, 0, 0, 0);
          if (rDate > today) return true;
          if (rDate.getTime() === today.getTime())
            return timeToMinutes(r.time) > currentMinutes;
          return false;
        });
        if (future) {
          setNextScheduleTime(future.time);
          return;
        }
      }

      setNextScheduleTime("No scheduled time");
    } catch (e) {
      console.error("Error fetching next schedule:", e);
      setNextScheduleTime("No scheduled time");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => true;
      const sub = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );
      return () => sub.remove();
    }, []),
  );

  useEffect(() => {
    const fetchProfile = async () => {
      if (!email) {
        setLoadingName(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("user_profiles")
          .select("id, name, profile_picture")
          .eq("email", email)
          .maybeSingle();
        if (!error && data) {
          setFullName(data.name || "Farmer");
          setProfilePicture(data.profile_picture);
          setUserId(data.id);
          fetchNextSchedule(data.id);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoadingName(false);
      }
    };
    fetchProfile();
  }, [email]);

  useEffect(() => {
    Animated.timing(drawerX, {
      toValue: menuOpen ? 0 : -DRAWER_WIDTH,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [menuOpen, drawerX]);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, type, title, message, is_read, created_at")
        .eq("user_id", userId)
        .eq("type", "recommendation")
        .order("created_at", { ascending: false })
        .limit(20);
      if (!error && data) {
        setNotifications(
          data.map((n) => ({
            id: n.id as number,
            type: n.type as string,
            title: n.title as string,
            message: n.message as string,
            is_read: n.is_read as boolean | null,
            created_at: (n.created_at as string | null) ?? null,
          })),
        );
        setUnreadCount(
          data.filter((n) => n.is_read === false || n.is_read === null).length,
        );
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      fetchNotifications();
      fetchNextSchedule(userId);
    }, [fetchNotifications, fetchNextSchedule, userId]),
  );

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`dashboard-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: number;
            type: string;
            title: string;
            message: string;
            is_read: boolean | null;
            created_at: string | null;
          };
          if (row.type !== "recommendation") return;
          setNotifications((prev) => [row, ...prev.slice(0, 19)]);
          setUnreadCount((prev) => prev + 1);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("type", "recommendation")
        .neq("is_read", true);
      if (error) throw error;
      await fetchNotifications();
    } catch (error) {
      console.error("Error marking notifications as read:", error);
      Alert.alert("Error", "Failed to mark notifications as read.");
    }
  }, [fetchNotifications, userId]);

  const markNotificationAsRead = useCallback(
    async (id: number) => {
      if (!userId) return;
      try {
        const { error } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", id)
          .eq("user_id", userId);
        if (error) throw error;
        await fetchNotifications();
      } catch (error) {
        console.error("Error marking notification as read:", error);
        Alert.alert("Error", "Failed to mark notification as read.");
      }
    },
    [fetchNotifications, userId],
  );

  const handleLogout = () => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          setMenuOpen(false);
          setLoggingOut(true);
          try {
            await clearAllStorage();
            await new Promise((resolve) => setTimeout(resolve, 600));
            router.replace("/UserManagement/login");
          } catch (error) {
            console.error("Error during logout:", error);
            router.replace("/UserManagement/login");
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  const handleMenuNavigate = (itemKey: string) => {
    setMenuOpen(false);
    if (itemKey === "weather") {
      router.push({
        pathname: "/UserManagement/weatherUpdate",
        params: { email },
      });
    } else if (itemKey === "humidity") {
      router.push({ pathname: "/UserManagement/humidity", params: { email } });
    } else if (itemKey === "temp") {
      router.push({
        pathname: "/UserManagement/temperature",
        params: { email },
      });
    } else if (itemKey === "soil") {
      router.push({
        pathname: "/UserManagement/soilMoisture",
        params: { email },
      });
    } else if (itemKey === "water") {
      router.push({
        pathname: "/UserManagement/waterDistribution",
        params: { email },
      });
    } else if (itemKey === "schedule") {
      router.push({
        pathname: "/UserManagement/irrigationSchedule",
        params: { email },
      });
    } else if (itemKey === "water-requirement") {
      router.push({
        pathname: "/UserManagement/waterRequirement",
        params: { email },
      });
    } else if (itemKey === "irrigation-history") {
      router.push({
        pathname: "/UserManagement/historyIrrigationLogging",
        params: { email },
      });
    } else if (itemKey === "automated-irrigation") {
      router.push({
        pathname: "/UserManagement/waterDistribution",
        params: { email },
      });
    } else if (itemKey === "monitoring") {
      router.push({
        pathname: "/UserManagement/irrigationSchedule",
        params: { email },
      });
    } else if (itemKey === "settings") {
      router.push({ pathname: "/UserManagement/settings", params: { email } });
    }
  };

  // ── Irrigation status ──
  const irrigStatus =
    soilMoisturePercent <= 25
      ? {
          label: "Irrigating — Critical",
          chipStyle: styles.heroChipCritical,
          textColor: "#DC2626",
          icon: "tint" as const,
        }
      : soilMoisturePercent <= 40
        ? {
            label: "Irrigating — Low",
            chipStyle: styles.heroChipAlert,
            textColor: "#EA580C",
            icon: "tint" as const,
          }
        : soilMoisturePercent <= 80
          ? {
              label: "Standby — Optimal",
              chipStyle: styles.heroChipGood,
              textColor: "#059669",
              icon: "check-circle" as const,
            }
          : {
              label: "Standby — Wet",
              chipStyle: styles.heroChipInfo,
              textColor: "#2563EB",
              icon: "tint" as const,
            };

  // ── Build 7-day forecast items ──
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date();
  const dailyForecast = forecastData
    ? Array.from({ length: 7 }, (_, i) => {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        return {
          day:
            i === 0
              ? "Today"
              : i === 1
                ? "Tomorrow"
                : daysOfWeek[date.getDay()],
          date: date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          code: forecastData.daily.weather_code[i],
          high: Math.round(forecastData.daily.temperature_2m_max[i]),
          low: Math.round(forecastData.daily.temperature_2m_min[i]),
          precipitation: forecastData.daily.precipitation_sum?.[i] ?? 0,
        };
      })
    : [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top App Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setMenuOpen(true)}>
            <FontAwesome name="bars" size={22} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bellButton}
            onPress={() => setNotifOpen(true)}
          >
            <FontAwesome name="bell" size={20} color="#1F2937" />
            {unreadCount > 0 && (
              <View style={styles.bellBadgeCount}>
                <Text style={styles.bellBadgeText}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── System Status Hero ── */}
          <View style={styles.heroBanner}>
            <View style={styles.heroLeft}>
              <Text style={styles.heroEyebrow}>SYSTEM STATUS</Text>
              <Text style={styles.heroGreeting}>
                Hi, {fullName.trim() || "Farmer"}
              </Text>
              <Text style={styles.heroSubtitle}>
                Monitoring your string beans.
              </Text>
            </View>
            <View style={styles.heroRight}>
              <View style={styles.heroAutoBadge}>
                <FontAwesome name="refresh" size={10} color="#fff" />
                <Text style={styles.heroAutoBadgeText}>AUTO</Text>
              </View>
            </View>
          </View>

          {/* Status chips */}
          <View style={styles.heroChipsRow}>
            <View style={[styles.heroChip, irrigStatus.chipStyle]}>
              <FontAwesome
                name={irrigStatus.icon}
                size={11}
                color={irrigStatus.textColor}
              />
              <Text
                style={[styles.heroChipText, { color: irrigStatus.textColor }]}
              >
                {irrigStatus.label}
              </Text>
            </View>
            <View style={styles.heroChipNeutral}>
              <FontAwesome name="clock-o" size={11} color="#6B7280" />
              <Text style={styles.heroChipNeutralText}>
                {nextScheduleTime === "No scheduled time"
                  ? "No scheduled time"
                  : `Next: ${nextScheduleTime}`}
              </Text>
            </View>
          </View>

          {/* ── Field Conditions Card ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Field Conditions</Text>
            {lastUpdated && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  marginTop: -6,
                  marginBottom: 8,
                }}
              >
                <FontAwesome
                  name="clock-o"
                  size={11}
                  color={colors.brandGrayText}
                />
                <Text
                  style={{
                    fontFamily: fonts.regular,
                    fontSize: 11,
                    color: colors.brandGrayText,
                  }}
                >
                  Last updated: {formatPHTime(lastUpdated)}
                </Text>
              </View>
            )}
            <View style={styles.gaugesRow}>
              <CircularGauge
                value={soilMoisturePercent}
                maxValue={100}
                gradientColors={["#34D399", "#10B981"]}
                label="Soil Moisture"
                subLabel={
                  soilMoisturePercent < 60
                    ? "Dry"
                    : soilMoisturePercent <= 80
                      ? "Optimal"
                      : "Wet"
                }
                unit="%"
                icon={<FontAwesome name="globe" size={14} color="#22C55E" />}
              />
              <CircularGauge
                value={temperatureValue}
                maxValue={52}
                gradientColors={["#F59E0B", "#EF4444"]}
                label="Temperature"
                subLabel={
                  temperatureValue < 27
                    ? "Normal"
                    : temperatureValue <= 32
                      ? "Caution"
                      : temperatureValue <= 41
                        ? "Danger"
                        : "Extreme Danger"
                }
                unit="°C"
                icon={
                  <FontAwesome name="thermometer" size={14} color="#F97316" />
                }
              />
              <CircularGauge
                value={humidityPercent}
                maxValue={100}
                gradientColors={["#A78BFA", "#7C3AED"]}
                label="Humidity"
                subLabel={
                  humidityPercent < 40
                    ? "Very Low"
                    : humidityPercent <= 55
                      ? "Low"
                      : humidityPercent <= 70
                        ? "Moderate"
                        : humidityPercent <= 80
                          ? "High"
                          : "Very High"
                }
                unit="%"
                icon={<FontAwesome name="tint" size={14} color="#A855F7" />}
              />
            </View>
          </View>

          {/* ── 7-Day Forecast Card (own separate card) ── */}
          <View style={styles.card}>
            <View style={styles.forecastCardHeader}>
              <FontAwesome
                name="calendar"
                size={15}
                color={colors.brandBlueAlt}
              />
              <Text style={styles.forecastCardTitle}>7-Day Forecast</Text>
            </View>

            {forecastLoading ? (
              <View style={styles.forecastLoadingWrap}>
                <ActivityIndicator size="small" color={colors.brandBlueAlt} />
                <Text style={styles.forecastLoadingText}>
                  Loading forecast…
                </Text>
              </View>
            ) : forecastData ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.forecastScroll}
              >
                {dailyForecast.map((f, i) => (
                  <ForecastMiniCard key={i} {...f} isToday={i === 0} />
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.forecastUnavailable}>
                Forecast unavailable.
              </Text>
            )}
          </View>
        </ScrollView>

        {/* ── Notification Panel ── */}
        <Modal
          visible={notifOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setNotifOpen(false)}
        >
          <View style={styles.notifBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setNotifOpen(false)}
            />
            <View style={styles.notifPanel}>
              <View style={styles.notifHeader}>
                <Text style={styles.notifTitle}>Recommendations</Text>
                <TouchableOpacity onPress={() => setNotifOpen(false)}>
                  <FontAwesome name="times" size={16} color="#6B7280" />
                </TouchableOpacity>
              </View>
              {notifications.length === 0 ? (
                <Text style={styles.notifEmptyText}>
                  No recommendations yet.
                </Text>
              ) : (
                notifications.map((n) => (
                  <TouchableOpacity
                    key={n.id}
                    activeOpacity={0.8}
                    onPress={async () => {
                      if (n.is_read === false || n.is_read === null) {
                        await markNotificationAsRead(n.id);
                      }
                      setSelectedRecommendation({
                        title: n.title,
                        message: n.message,
                      });
                    }}
                    style={[
                      styles.notifItem,
                      n.is_read ? styles.notifRead : styles.notifUnread,
                    ]}
                  >
                    <FontAwesome
                      name="leaf"
                      size={14}
                      color={n.is_read ? "#6B7280" : colors.brandGreen}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.notifTitleText}>{n.title}</Text>
                      <Text style={styles.notifText}>{n.message}</Text>
                      {n.created_at && (
                        <Text style={styles.notifTimeText}>
                          {formatPHTime(n.created_at)}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))
              )}
              {unreadCount > 0 && (
                <View style={styles.notifFooter}>
                  <TouchableOpacity onPress={markAllAsRead}>
                    <Text style={styles.markAllReadText}>Mark all as read</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* ── Recommendation Detail Popup ── */}
        <Modal
          visible={!!selectedRecommendation}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedRecommendation(null)}
        >
          <View style={styles.popupBackdrop}>
            <View style={styles.popupCard}>
              <Text style={styles.popupTitle}>
                {selectedRecommendation?.title ?? "Recommendation"}
              </Text>
              <Text style={styles.popupMessage}>
                {selectedRecommendation?.message ?? ""}
              </Text>
              <TouchableOpacity
                style={styles.popupOkButton}
                onPress={() => setSelectedRecommendation(null)}
              >
                <Text style={styles.popupOkButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {menuOpen && (
          <Pressable
            style={styles.backdrop}
            onPress={() => setMenuOpen(false)}
          />
        )}

        {/* ── Drawer ── */}
        <Animated.View
          style={[styles.drawer, { transform: [{ translateX: drawerX }] }]}
        >
          <ScrollView
            contentContainerStyle={styles.drawerContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.userHeader}>
              {profilePicture ? (
                <Image
                  source={{ uri: profilePicture }}
                  style={styles.profilePicture}
                />
              ) : (
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarInitial}>
                    {fullName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.userInfo}>
                {loadingName ? (
                  <ActivityIndicator size="small" color={colors.brandBlue} />
                ) : (
                  <Text style={styles.userName}>{fullName}</Text>
                )}
              </View>
            </View>

            <View style={styles.menuSection}>
              <Text style={styles.menuTitle}>Menu</Text>

              <TouchableOpacity
                style={styles.analyticsHeader}
                activeOpacity={0.8}
                onPress={() => setAnalyticsOpen((prev) => !prev)}
              >
                <View style={styles.menuItemLeft}>
                  <FontAwesome
                    name="bar-chart"
                    size={18}
                    color={colors.brandBlue}
                  />
                  <Text style={styles.menuItemLabel}>
                    Analytics &amp; Reporting
                  </Text>
                </View>
                <FontAwesome
                  name={analyticsOpen ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={colors.brandGrayText}
                />
              </TouchableOpacity>

              {analyticsOpen &&
                ANALYTICS_SUB_ITEMS.map((sub) => (
                  <TouchableOpacity
                    key={sub.key}
                    style={styles.subMenuItem}
                    activeOpacity={0.8}
                    onPress={() => {
                      setMenuOpen(false);
                      if (sub.key === "env") {
                        router.push({
                          pathname: "/UserManagement/patternAnalyzer",
                          params: { email },
                        });
                      } else if (sub.key === "seasonal") {
                        router.push({
                          pathname: "/UserManagement/seasonalSummary",
                          params: { email },
                        });
                      }
                    }}
                  >
                    <Text style={styles.subMenuItemLabel}>{sub.label}</Text>
                  </TouchableOpacity>
                ))}

              {MENU_ITEMS.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={styles.menuItem}
                  activeOpacity={0.8}
                  onPress={() => handleMenuNavigate(item.key)}
                >
                  <View style={styles.menuItemLeft}>
                    <FontAwesome
                      name={item.icon as any}
                      size={18}
                      color={colors.brandBlue}
                    />
                    <Text style={styles.menuItemLabel}>{item.label}</Text>
                  </View>
                  <FontAwesome
                    name="chevron-right"
                    size={14}
                    color={colors.brandGrayText}
                  />
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={styles.menuItem}
                activeOpacity={0.8}
                onPress={() => handleMenuNavigate("settings")}
              >
                <View style={styles.menuItemLeft}>
                  <FontAwesome name="cog" size={18} color={colors.brandBlue} />
                  <Text style={styles.menuItemLabel}>Settings</Text>
                </View>
                <FontAwesome
                  name="chevron-right"
                  size={14}
                  color={colors.brandGrayText}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.logoutItem}
                activeOpacity={0.8}
                onPress={handleLogout}
              >
                <View style={styles.menuItemLeft}>
                  <FontAwesome name="sign-out" size={18} color="#FF3B30" />
                  <Text style={styles.logoutLabel}>Log Out</Text>
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>

        {loggingOut && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Logging out...</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F3F4F6",
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },

  // ── Hero Banner ──
  heroBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 12,
  },
  heroLeft: {
    flex: 1,
    paddingRight: 12,
  },
  heroEyebrow: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.brandGreen,
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  heroGreeting: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: "#111827",
    marginBottom: 2,
  },
  heroSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.brandGrayText,
  },
  heroRight: {
    alignItems: "center",
    gap: 8,
  },
  heroAutoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandGreen,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroAutoBadgeText: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    color: "#fff",
    letterSpacing: 0.8,
  },

  // Status chips
  heroChipsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
    marginTop: -4,
    marginBottom: 4,
  },
  heroChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  heroChipCritical: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  heroChipAlert: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FED7AA",
  },
  heroChipGood: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
  },
  heroChipInfo: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  heroChipText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  heroChipNeutral: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  heroChipNeutralText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: "#6B7280",
  },

  // ── Cards ──
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: "#1F2937",
    marginBottom: 12,
  },
  gaugesRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-start",
    paddingVertical: 8,
  },

  // ── Forecast card ──
  forecastCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  forecastCardTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: "#1F2937",
  },
  forecastScroll: {
    gap: 8,
    paddingVertical: 2,
    paddingBottom: 4,
  },
  forecastLoadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
  },
  forecastLoadingText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.brandGrayText,
  },
  forecastUnavailable: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.brandGrayText,
    paddingVertical: 8,
  },

  // ── Drawer ──
  userHeader: {
    alignItems: "center",
    paddingVertical: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.brandGrayBorder,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#E6F4FE",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.brandBlue,
  },
  profilePicture: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "transparent",
  },
  userInfo: { marginTop: 12 },
  userName: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: "#111827",
  },
  menuSection: {
    borderRadius: 12,
    paddingVertical: 8,
  },
  menuTitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.brandGrayText,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.brandGrayBorder,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.brandGrayBorder,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  menuItemLabel: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: "#000",
  },
  analyticsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.brandGrayBorder,
    backgroundColor: "#F7F7F8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  subMenuItem: {
    paddingLeft: 40,
    paddingRight: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.brandGrayBorder,
  },
  subMenuItemLabel: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.brandGrayText,
  },
  logoutItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 4,
  },
  logoutLabel: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: "#FF3B30",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  drawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  drawerContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 8,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: "#fff",
  },

  // ── Bell ──
  bellButton: { padding: 6, position: "relative" },
  bellBadgeCount: {
    position: "absolute",
    top: -2,
    right: -6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  bellBadgeText: {
    color: "#fff",
    fontFamily: fonts.bold,
    fontSize: 9,
  },

  // ── Notification panel ──
  notifBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 60,
    paddingRight: 12,
  },
  notifPanel: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    width: 300,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    gap: 10,
  },
  notifHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  notifFooter: { marginTop: 2, alignItems: "flex-end" },
  notifTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: "#1F2937",
  },
  markAllReadText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.brandBlue,
  },
  notifItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 10,
    padding: 10,
  },
  notifRead: { backgroundColor: "#F9FAFB" },
  notifUnread: { backgroundColor: "#ECFEFF" },
  notifText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: "#374151",
    lineHeight: 18,
  },
  notifTitleText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: "#111827",
    marginBottom: 2,
  },
  notifTimeText: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.brandGrayText,
  },
  notifEmptyText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.brandGrayText,
  },

  // ── Popup ──
  popupBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  popupCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
  },
  popupTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: "#111827",
    marginBottom: 8,
  },
  popupMessage: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  popupOkButton: {
    marginTop: 16,
    alignSelf: "flex-end",
    backgroundColor: colors.brandBlue,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  popupOkButtonText: {
    fontFamily: fonts.medium,
    color: "#fff",
    fontSize: 13,
  },
});
