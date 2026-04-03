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

function formatPHTime(isoString: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(isoString));
}

const colors = {
  brandGreen: "#3E9B4F",
  brandBlue: "#007AFF",
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

// Menu items matching wireframe
const MENU_ITEMS = [
  { key: "soil", icon: "leaf", label: "Soil Moisture" },
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
  { key: "env", label: "Environmental Condition Pattern Analyzer" },
  { key: "seasonal", label: "Seasonal Irrigation Behavior Summary" },
];

const DRAWER_WIDTH = Math.min(320, Dimensions.get("window").width * 0.8);

// Circular Gauge Component
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
  const strokeDashoffset = circumference * (1 - progress * 0.75); // 75% of circle (270 degrees)

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
          {/* Background circle */}
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
          {/* Progress circle */}
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

export default function DashboardScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === "string" ? params.email : "";
  const router = useRouter();

  // Live sensor data from sensor_reading table
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
  const systemActive = true;
  const nextSchedule = "Today, 6:00 PM";

  useEffect(() => {
    const fetchSensorData = async () => {
      try {
        // Fetch latest soil moisture (sensor_id = 3)
        const { data: soilData } = await supabase
          .from("sensor_reading")
          .select("value, timestamp")
          .eq("sensor_id", 3)
          .order("timestamp", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (soilData) setSoilMoisturePercent(Math.round(soilData.value));

        // Fetch latest temperature (sensor_id = 1)
        const { data: tempData } = await supabase
          .from("sensor_reading")
          .select("value, timestamp")
          .eq("sensor_id", 1)
          .order("timestamp", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (tempData) setTemperatureValue(Math.round(tempData.value * 10) / 10);

        // Fetch latest humidity (sensor_id = 2)
        const { data: humidData } = await supabase
          .from("sensor_reading")
          .select("value, timestamp")
          .eq("sensor_id", 2)
          .order("timestamp", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (humidData) setHumidityPercent(Math.round(humidData.value));

        // Pick the most recent timestamp among all sensors
        const timestamps = [soilData?.timestamp, tempData?.timestamp, humidData?.timestamp]
          .filter(Boolean) as string[];
        if (timestamps.length > 0) {
          const latest = timestamps.reduce((a, b) => (new Date(a) > new Date(b) ? a : b));
          setLastUpdated(latest);
        }
      } catch (error) {
        console.error("Error fetching sensor data:", error);
      }
    };

    fetchSensorData();
  }, []);

  const [fullName, setFullName] = useState<string>("Farmer");
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [loadingName, setLoadingName] = useState<boolean>(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const drawerX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  // Disable Android hardware back when on dashboard (so user can't go back to login)
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        // Returning true tells React Native we've handled the back press
        return true;
      };

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
    }, [fetchNotifications, userId]),
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
    if (!userId || notifications.length === 0) return;

    try {
      const unreadIds = notifications
        .filter((n) => n.is_read === false || n.is_read === null)
        .map((n) => n.id);
      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .in("id", unreadIds)
        .eq("user_id", userId);

      if (error) throw error;

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking notifications as read:", error);
      Alert.alert("Error", "Failed to mark notifications as read.");
    }
  }, [notifications, userId]);

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
            // Clear logged in email but keep remember me credentials if user wants to use them again
            // Note: We're not clearing remember me credentials here, so if user has it checked,
            // they can still auto-login next time. If you want to clear everything on logout,
            // use clearAllStorage() instead.
            await clearAllStorage();
            // Small delay to show loader; navigation time still depends on device/network
            await new Promise((resolve) => setTimeout(resolve, 600));
            router.replace("/UserManagement/login");
          } catch (error) {
            console.error("Error during logout:", error);
            // Still navigate to login even if storage clear fails
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
      router.push({
        pathname: "/UserManagement/humidity",
        params: { email },
      });
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
      router.push({
        pathname: "/UserManagement/settings",
        params: { email },
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top App Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setMenuOpen(true)}>
            <FontAwesome name="bars" size={22} color="#000" />
          </TouchableOpacity>
          {/* Notification Bell */}
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

        {/* Main dashboard content */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* System Status Card */}
          <View style={[styles.card, styles.systemCard]}>
            <Text style={styles.systemCardTitle}>System Status</Text>

            <View style={styles.systemHeaderRow}>
              <View style={styles.systemHeaderText}>
                <Text style={styles.greetingText}>
                  Hi,{" "}
                  {(() => {
                    const nameParts = fullName
                      .trim()
                      .split(/\s+/)
                      .filter((part) => part.length > 0);
                    if (nameParts.length === 0) return "Farmer";
                    if (nameParts.length === 1) return nameParts[0];
                    return `${nameParts[0]} ${nameParts[1]}`;
                  })()}
                </Text>
                <Text style={styles.systemSubtitle}>
                  Auto-irrigation is monitoring your string beans.
                </Text>
              </View>

              <View style={styles.systemBadge}>
                <View style={[styles.statusIcon, styles.statusIconActive]}>
                  <FontAwesome name="refresh" size={16} color="#fff" />
                </View>
                <Text style={styles.statusBadgeText}>Auto</Text>
              </View>
            </View>

            {/* Soil-moisture-based irrigation trigger */}
            <View style={styles.autoIrrigRow}>
              <View style={styles.autoIrrigLeft}>
                <FontAwesome name="tint" size={13} color="rgba(255,255,255,0.9)" />
                <Text style={styles.autoIrrigLabel}>Irrigation trigger</Text>
              </View>
              <View style={[
                styles.autoIrrigBadge,
                soilMoisturePercent <= 40
                  ? styles.autoIrrigBadgeOn
                  : styles.autoIrrigBadgeOff,
              ]}>
                <Text style={styles.autoIrrigBadgeText}>
                  {soilMoisturePercent <= 25
                    ? "🔴 Irrigating — Critical"
                    : soilMoisturePercent <= 40
                    ? "🟠 Irrigating — Low"
                    : soilMoisturePercent <= 60
                    ? "🟡 Standby — Moderate"
                    : soilMoisturePercent <= 75
                    ? "🟢 Standby — Ideal"
                    : "🔵 Standby — Very High"}
                </Text>
              </View>
            </View>
          </View>

          {/* Field Conditions Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Field Conditions</Text>
            {lastUpdated && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: -6, marginBottom: 8 }}>
                <FontAwesome name="clock-o" size={11} color={colors.brandGrayText} />
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.brandGrayText }}>
                  Last updated: {formatPHTime(lastUpdated)}
                </Text>
              </View>
            )}

            {/* Soil Moisture */}
            {(() => {
              const s = soilMoisturePercent;
              const { dot, label, barColor } =
                s <= 25 ? { dot: "🔴", label: "Very Low — Critical", barColor: "#EF4444" }
                : s <= 40 ? { dot: "🟠", label: "Low — Warning",     barColor: "#F97316" }
                : s <= 60 ? { dot: "🟡", label: "Moderate — Normal", barColor: "#EAB308" }
                : s <= 75 ? { dot: "🟢", label: "Ideal — Good",      barColor: "#22C55E" }
                :           { dot: "🔵", label: "Very High — Risk",  barColor: "#3B82F6" };
              return (
                <View style={styles.sensorRow}>
                  <View style={styles.sensorRowHeader}>
                    <View style={styles.sensorRowLeft}>
                      <FontAwesome name="leaf" size={14} color="#22C55E" />
                      <Text style={styles.sensorRowTitle}>Soil Moisture</Text>
                    </View>
                    <Text style={styles.sensorRowValue}>{s}%</Text>
                  </View>
                  <View style={styles.severityBar}>
                    <View style={[styles.severityFill, { width: `${Math.min(s, 100)}%` as any, backgroundColor: barColor }]} />
                  </View>
                  <Text style={styles.severityLabel}>{dot} {label}</Text>
                </View>
              );
            })()}

            {/* Temperature */}
            {(() => {
              const t = temperatureValue;
              const { dot, label, barColor } =
                t < 15 ? { dot: "🔵", label: "Very Low — Critical",   barColor: "#3B82F6" }
                : t < 21 ? { dot: "🟢", label: "Low — Slight Stress",  barColor: "#22C55E" }
                : t <= 30 ? { dot: "🟡", label: "Ideal — Good",         barColor: "#EAB308" }
                : t <= 35 ? { dot: "🟠", label: "High — Warning",       barColor: "#F97316" }
                :           { dot: "🔴", label: "Very High — Critical", barColor: "#EF4444" };
              const pct = Math.min(Math.max(((t - 10) / 30) * 100, 2), 100);
              return (
                <View style={styles.sensorRow}>
                  <View style={styles.sensorRowHeader}>
                    <View style={styles.sensorRowLeft}>
                      <FontAwesome name="thermometer" size={14} color="#F97316" />
                      <Text style={styles.sensorRowTitle}>Temperature</Text>
                    </View>
                    <Text style={styles.sensorRowValue}>{t.toFixed(1)}°C</Text>
                  </View>
                  <View style={styles.severityBar}>
                    <View style={[styles.severityFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
                  </View>
                  <Text style={styles.severityLabel}>{dot} {label}</Text>
                </View>
              );
            })()}

            {/* Humidity */}
            {(() => {
              const h = humidityPercent;
              const { dot, label, barColor } =
                h < 40 ? { dot: "🔴", label: "Very Low — Critical",  barColor: "#EF4444" }
                : h <= 55 ? { dot: "🟠", label: "Low — Warning",       barColor: "#F97316" }
                : h <= 70 ? { dot: "🟡", label: "Moderate — Normal",   barColor: "#EAB308" }
                : h <= 80 ? { dot: "🟢", label: "Ideal — Good",        barColor: "#22C55E" }
                :           { dot: "🔵", label: "Very High — Risk",    barColor: "#3B82F6" };
              return (
                <View style={styles.sensorRow}>
                  <View style={styles.sensorRowHeader}>
                    <View style={styles.sensorRowLeft}>
                      <FontAwesome name="tint" size={14} color="#A855F7" />
                      <Text style={styles.sensorRowTitle}>Humidity</Text>
                    </View>
                    <Text style={styles.sensorRowValue}>{h}%</Text>
                  </View>
                  <View style={styles.severityBar}>
                    <View style={[styles.severityFill, { width: `${Math.min(h, 100)}%` as any, backgroundColor: barColor }]} />
                  </View>
                  <Text style={styles.severityLabel}>{dot} {label}</Text>
                </View>
              );
            })()}
          </View>

          {/* Irrigation Controls Card */}
        </ScrollView>

        {/* Recommendation Notification Panel */}
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
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  {unreadCount > 0 && (
                    <TouchableOpacity onPress={markAllAsRead}>
                      <Text style={styles.markAllReadText}>Mark all as read</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => setNotifOpen(false)}>
                    <FontAwesome name="times" size={16} color="#6B7280" />
                  </TouchableOpacity>
                </View>
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
                    onPress={() =>
                      setSelectedRecommendation({
                        title: n.title,
                        message: n.message,
                      })
                    }
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
            </View>
          </View>
        </Modal>

        {/* Recommendation detail popup (on click) */}
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

        {/* Backdrop for drawer */}
        {menuOpen && (
          <Pressable
            style={styles.backdrop}
            onPress={() => setMenuOpen(false)}
          />
        )}

        {/* Sliding sidebar menu */}
        <Animated.View
          style={[
            styles.drawer,
            {
              transform: [{ translateX: drawerX }],
            },
          ]}
        >
          <ScrollView
            contentContainerStyle={styles.drawerContent}
            showsVerticalScrollIndicator={false}
          >
            {/* User header inside drawer */}
            <View style={styles.userHeader}>
              {profilePicture ? (
                <Image
                  source={{ uri: profilePicture }}
                  style={styles.profilePicture}
                  onError={(e) => {
                    console.log(
                      "Profile picture failed to load:",
                      profilePicture,
                    );
                  }}
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

            {/* Main menu + logout */}
            <View style={styles.menuSection}>
              <Text style={styles.menuTitle}>Menu</Text>

              {/* Analytics & Reporting */}
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

              {/* Settings */}
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

              {/* Logout */}
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
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
    fontSize: 16,
    color: "#1F2937",
    marginBottom: 12,
  },
  // System overview card
  systemCard: {
    backgroundColor: colors.brandGreen,
    padding: 18,
  },
  systemCardTitle: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  systemHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  systemHeaderText: {
    flex: 1,
    paddingRight: 12,
  },
  greetingText: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: "#ffffff",
    marginBottom: 4,
  },
  systemSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
  },
  systemBadge: {
    alignItems: "center",
  },
  statusBadgeText: {
    marginTop: 6,
    fontFamily: fonts.medium,
    fontSize: 13,
    color: "#ECFDF5",
  },
  // System Status
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  statusLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#9CA3AF",
    justifyContent: "center",
    alignItems: "center",
  },
  statusIconActive: {
    backgroundColor: colors.brandGreen,
  },
  statusText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: "#1F2937",
  },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  scheduleLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
  },
  scheduleTime: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: "#ffffff",
  },
  pauseButton: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  pauseButtonText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: "#ffffff",
  },
  // Gauges
  gaugesRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-start",
    paddingVertical: 8,
  },
  // Quick Controls
  controlsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  controlButton: {
    alignItems: "center",
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.cardBg,
  },
  controlIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  controlLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: "#1F2937",
    textAlign: "center",
  },
  menuGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    marginTop: 4,
  },
  menuTile: {
    width: "48%",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  menuTileIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },
  menuTileLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: "#111827",
    textAlign: "center",
  },
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
  userInfo: {
    marginTop: 12,
  },
  userLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.brandGrayText,
  },
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
  // Auto-irrigation trigger row (system status card)
  autoIrrigRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    backgroundColor: "rgba(0,0,0,0.12)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  autoIrrigLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  autoIrrigLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
  },
  autoIrrigBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  autoIrrigBadgeOn: {
    backgroundColor: "rgba(239,68,68,0.25)",
  },
  autoIrrigBadgeOff: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  autoIrrigBadgeText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: "#ffffff",
  },
  // Sensor severity rows (field conditions card)
  sensorRow: {
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  sensorRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sensorRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sensorRowTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: "#1F2937",
  },
  sensorRowValue: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: "#1F2937",
  },
  severityBar: {
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    overflow: "hidden",
  },
  severityFill: {
    height: 6,
    borderRadius: 3,
  },
  severityLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.brandGrayText,
  },
  // Notification bell
  bellButton: {
    padding: 6,
    position: "relative",
  },
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
  // Recommendation panel
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
  notifCritical: {
    backgroundColor: "#FEF2F2",
  },
  notifWarning: {
    backgroundColor: "#FFF7ED",
  },
  notifInfo: {
    backgroundColor: "#EFF6FF",
  },
  notifGood: {
    backgroundColor: "#F0FDF4",
  },
  notifRead: {
    backgroundColor: "#F9FAFB",
  },
  notifUnread: {
    backgroundColor: "#ECFEFF",
  },
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
