import { FontAwesome } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Dimensions,
  Image,
  ImageBackground,
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

import AsyncStorage from "@react-native-async-storage/async-storage";

import { isAdminRole } from "@/lib/isAdminRole";
import { clearAllStorage, getLoggedInEmail } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { getWeatherData } from "../../lib/weatherConfig";

// ── Config ─────────────────────────────────────────────────────────────────
const DEFAULT_COORDS = { latitude: 15.53, longitude: 120.6042 };

const AUTO_IRRIGATION_MODE_KEY = "dashboard_auto_irrigation_mode";
const AUTO_MODE_COLUMN = "auto_mode_enabled";
const DEFAULT_IRRIGATION_BRIDGE_URL =
  "https://arduino-bridge.commanderzale08.workers.dev";

const isMissingAutoModeColumnError = (error: unknown): boolean => {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  return message.toLowerCase().includes(AUTO_MODE_COLUMN);
};

type IrrigationSystemRow = {
  id: number;
  farm_id: number;
  system_name: string;
  pump_status: boolean;
  auto_mode_enabled?: boolean | null;
};

type UserProfileSource = {
  id?: string | number | null;
  user_id?: string | number | null;
  owner_id?: string | number | null;
};

const toOwnerIdCandidates = (
  profile: UserProfileSource,
): (string | number)[] => {
  const raw = [profile.id, profile.user_id, profile.owner_id];
  const unique = new Set<string | number>();
  raw.forEach((value) => {
    if (value == null) return;
    if (typeof value === "number" && Number.isFinite(value)) {
      unique.add(value);
      return;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) unique.add(trimmed);
    }
  });
  return Array.from(unique);
};

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

function formatScheduleDateOnly(
  day: number,
  month: number,
  year: number,
): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${mm}/${dd}/${year}`;
}

function formatScheduleDateFromValue(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return `${mm}/${dd}/${yyyy}`;
}

function normalizeScheduleTime(rawTime: string): string {
  const value = rawTime.trim();
  const m = value.match(/^(\d{1,2}):(\d{2})\s*([aApP][mM])$/);
  if (!m) return value;
  return `${m[1]}:${m[2]} ${m[3].toUpperCase()}`;
}

function toYmdLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getSoilSeverity(percent: number): string {
  if (percent < 40) return "Dry";
  if (percent <= 80) return "Optimal";
  return "Wet";
}

function getHumiditySeverity(value: number): string {
  if (value < 30) return "Low";
  if (value <= 50) return "Ideal";
  if (value <= 60) return "Moderate";
  if (value <= 70) return "High";
  return "Severe";
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
  const [sensorLoading, setSensorLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<
    {
      id: string;
      type: string;
      title: string;
      message: string;
      is_read: boolean | null;
      created_at: string | null;
    }[]
  >([]);
  const [readRemarkIds, setReadRemarkIds] = useState<string[]>([]);
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
          // Match admin conversion: higher raw = drier (inverted ADC scale)
          const percent = Math.round(((1023 - raw) / 1023) * 100);
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
      } finally {
        setSensorLoading(false);
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
  const [nextScheduleTime, setNextScheduleTime] = useState<string>("");
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [autoIrrigationModeOn, setAutoIrrigationModeOn] = useState(false);
  const [supportsAutoModeColumn, setSupportsAutoModeColumn] = useState(true);
  const [profileSource, setProfileSource] = useState<UserProfileSource | null>(
    null,
  );

  const [autoIrrigationConfirmOpen, setAutoIrrigationConfirmOpen] =
    useState(false);
  const [autoIrrigationPendingOn, setAutoIrrigationPendingOn] = useState(true);
  const [irrigationSystem, setIrrigationSystem] =
    useState<IrrigationSystemRow | null>(null);
  const drawerX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  const syncIrrigationStateToBridge = useCallback(
    async ({
      systemId,
      autoModeEnabled,
      pumpStatus,
    }: {
      systemId: number;
      autoModeEnabled: boolean;
      pumpStatus: boolean;
    }) => {
      const configuredBridgeUrl =
        process.env.EXPO_PUBLIC_ARDUINO_BRIDGE_URL?.trim() || "";
      const candidateBaseUrls = [
        configuredBridgeUrl,
        DEFAULT_IRRIGATION_BRIDGE_URL,
      ].filter((url, idx, arr): url is string => {
        const normalized = url.trim();
        if (!normalized) return false;
        return arr.findIndex((item) => item.trim() === normalized) === idx;
      });

      const payload = {
        system_id: systemId,
        auto_mode_enabled: autoModeEnabled,
        pump_status: pumpStatus,
      };
      let lastFailure:
        | {
            endpoint: string;
            status?: number;
            responseText?: string;
            bridgeError?: unknown;
          }
        | undefined;

      for (const baseUrl of candidateBaseUrls) {
        const endpoint = `${baseUrl.replace(/\/$/, "")}/api/irrigation-state`;
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const responseText = await response.text().catch(() => "");
          if (!response.ok) {
            lastFailure = {
              endpoint,
              status: response.status,
              responseText,
            };
            continue;
          }

          let parsed: {
            auto_mode_enabled?: unknown;
            pump_status?: unknown;
          } | null = null;
          try {
            parsed = responseText ? JSON.parse(responseText) : null;
          } catch {
            parsed = null;
          }

          const hasExpectedShape =
            !!parsed &&
            typeof parsed.auto_mode_enabled === "boolean" &&
            typeof parsed.pump_status === "boolean";
          if (hasExpectedShape) {
            return true;
          }

          // Some deployments may return {"ok":true} or plain text ("OK") but not state.
          // Treat those as unsuccessful so we can try the next candidate host.
          lastFailure = {
            endpoint,
            status: response.status,
            responseText,
          };
        } catch (bridgeError) {
          lastFailure = {
            endpoint,
            bridgeError,
          };
        }
      }

      console.warn("[AutoToggle] Bridge sync failed for all endpoints", {
        candidates: candidateBaseUrls,
        ...lastFailure,
      });
      return false;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let stored = await AsyncStorage.getItem(AUTO_IRRIGATION_MODE_KEY);
        if (stored == null) {
          stored = await AsyncStorage.getItem(
            "dashboard_prototype_auto_irrigation",
          );
        }
        if (!cancelled && stored === "1") setAutoIrrigationModeOn(true);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openAutoIrrigationConfirm = useCallback(() => {
    setAutoIrrigationPendingOn(!autoIrrigationModeOn);
    setAutoIrrigationConfirmOpen(true);
    void Haptics.selectionAsync();
  }, [autoIrrigationModeOn]);

  const cancelAutoIrrigationConfirm = useCallback(() => {
    setAutoIrrigationConfirmOpen(false);
  }, []);

  const getActiveScheduleId = useCallback(async (uid: string) => {
    const { data: schedules } = await supabase
      .from("irrigation_schedules")
      .select("id")
      .eq("user_id", uid)
      .eq("is_active", true)
      .limit(10);
    const scheduleIds = (schedules ?? []).map((s) => String(s.id));
    if (scheduleIds.length === 0) return null;

    const todayYmd = toYmdLocal(new Date());
    const { data: row } = await supabase
      .from("irrigation_scheduled_dates")
      .select("schedule_id, scheduled_date")
      .in("schedule_id", scheduleIds)
      .gte("scheduled_date", todayYmd)
      .order("scheduled_date", { ascending: true })
      .limit(1)
      .maybeSingle();

    return row?.schedule_id
      ? String(row.schedule_id)
      : (scheduleIds[0] ?? null);
  }, []);

  const applyAutoIrrigationMode = useCallback(
    async (on: boolean) => {
      try {
        let effectiveUserId = userId ?? null;
        let effectiveProfileSource = profileSource;
        console.log("[AutoToggle] Requested", {
          on,
          userId: effectiveUserId,
          currentSystemId: irrigationSystem?.id ?? null,
          currentPumpStatus: irrigationSystem?.pump_status ?? null,
          currentAutoMode: irrigationSystem?.auto_mode_enabled ?? null,
        });

        if (!effectiveUserId || !effectiveProfileSource) {
          console.log(
            "[AutoToggle] Missing profile context, attempting email/profile fallback",
          );
          const fallbackEmail = email || (await getLoggedInEmail()) || "";
          if (fallbackEmail) {
            const { data: profileData, error: profileError } = await supabase
              .from("user_profiles")
              .select("id, email")
              .eq("email", fallbackEmail)
              .maybeSingle();
            if (profileError) {
              console.error(
                "[AutoToggle] profile fallback lookup failed",
                profileError,
              );
            } else if (profileData) {
              effectiveUserId = String(profileData.id);
              effectiveProfileSource = profileData as UserProfileSource;
              setUserId(String(profileData.id));
              setProfileSource(profileData as UserProfileSource);
              console.log("[AutoToggle] profile fallback resolved", {
                fallbackEmail,
                effectiveUserId,
              });
            }
          } else {
            console.warn("[AutoToggle] No fallback email found");
          }
        }

        if (!effectiveUserId) {
          console.warn(
            "[AutoToggle] userId missing, continuing with nullable log user",
          );
        }

        let targetSystem = irrigationSystem;
        if (!targetSystem?.id && effectiveProfileSource) {
          console.log("[AutoToggle] Resolving system from profile", {
            profileSource: effectiveProfileSource,
          });
          const ownerCandidates = toOwnerIdCandidates(effectiveProfileSource);
          for (const ownerCandidate of ownerCandidates) {
            console.log("[AutoToggle] Trying owner candidate", {
              ownerCandidate,
            });
            const { data: farmData } = await supabase
              .from("farm")
              .select("id")
              .eq("owner_id", ownerCandidate)
              .maybeSingle();
            if (!farmData?.id) continue;
            console.log("[AutoToggle] Farm found", { farmId: farmData.id });

            const { data: resolvedSystem } = await supabase
              .from("irrigation_system")
              .select(
                "id, farm_id, system_name, pump_status, auto_mode_enabled",
              )
              .eq("farm_id", farmData.id)
              .eq("system_name", "Main Irrigation System")
              .maybeSingle();
            if (resolvedSystem?.id) {
              targetSystem = resolvedSystem as IrrigationSystemRow;
              setIrrigationSystem(targetSystem);
              console.log("[AutoToggle] Resolved target system", {
                systemId: targetSystem.id,
                pump_status: targetSystem.pump_status,
                auto_mode_enabled: targetSystem.auto_mode_enabled ?? null,
              });
              break;
            }
            const { data: resolvedFallbackSystem } = await supabase
              .from("irrigation_system")
              .select(
                "id, farm_id, system_name, pump_status, auto_mode_enabled",
              )
              .eq("farm_id", farmData.id)
              .order("id", { ascending: true })
              .limit(1)
              .maybeSingle();
            if (resolvedFallbackSystem?.id) {
              targetSystem = resolvedFallbackSystem as IrrigationSystemRow;
              setIrrigationSystem(targetSystem);
              console.log("[AutoToggle] Resolved fallback target system", {
                systemId: targetSystem.id,
                pump_status: targetSystem.pump_status,
                auto_mode_enabled: targetSystem.auto_mode_enabled ?? null,
              });
              break;
            }

            const { data: createdSystem, error: createSystemError } =
              await supabase
                .from("irrigation_system")
                .insert({
                  farm_id: farmData.id,
                  system_name: "Main Irrigation System",
                  hardware_model: null,
                  water_source_details: null,
                  pump_status: false,
                  auto_mode_enabled: false,
                })
                .select(
                  "id, farm_id, system_name, pump_status, auto_mode_enabled",
                )
                .single();

            if (!createSystemError && createdSystem?.id) {
              targetSystem = createdSystem as IrrigationSystemRow;
              setIrrigationSystem(targetSystem);
              console.log("[AutoToggle] Created target system", {
                systemId: targetSystem.id,
                farmId: farmData.id,
              });
              break;
            }

            if (
              createSystemError &&
              isMissingAutoModeColumnError(createSystemError)
            ) {
              const { data: createdNoAutoSystem, error: createdNoAutoError } =
                await supabase
                  .from("irrigation_system")
                  .insert({
                    farm_id: farmData.id,
                    system_name: "Main Irrigation System",
                    hardware_model: null,
                    water_source_details: null,
                    pump_status: false,
                  })
                  .select("id, farm_id, system_name, pump_status")
                  .single();
              if (!createdNoAutoError && createdNoAutoSystem?.id) {
                targetSystem = createdNoAutoSystem as IrrigationSystemRow;
                setIrrigationSystem(targetSystem);
                setSupportsAutoModeColumn(false);
                console.log(
                  "[AutoToggle] Created target system (no auto column)",
                  {
                    systemId: targetSystem.id,
                    farmId: farmData.id,
                  },
                );
                break;
              }
            }
          }
        }
        if (!targetSystem?.id && effectiveUserId) {
          console.log(
            "[AutoToggle] Attempting resolution from userId fallback",
            {
              userId: effectiveUserId,
            },
          );
          const ownerCandidates = [effectiveUserId];
          for (const ownerCandidate of ownerCandidates) {
            const { data: farmData } = await supabase
              .from("farm")
              .select("id")
              .eq("owner_id", ownerCandidate)
              .maybeSingle();
            if (!farmData?.id) continue;
            const { data: resolvedSystem } = await supabase
              .from("irrigation_system")
              .select(
                "id, farm_id, system_name, pump_status, auto_mode_enabled",
              )
              .eq("farm_id", farmData.id)
              .eq("system_name", "Main Irrigation System")
              .maybeSingle();
            if (resolvedSystem?.id) {
              targetSystem = resolvedSystem as IrrigationSystemRow;
              setIrrigationSystem(targetSystem);
              console.log("[AutoToggle] Resolved system from userId fallback", {
                systemId: targetSystem.id,
              });
              break;
            }
            const { data: resolvedFallbackSystem } = await supabase
              .from("irrigation_system")
              .select(
                "id, farm_id, system_name, pump_status, auto_mode_enabled",
              )
              .eq("farm_id", farmData.id)
              .order("id", { ascending: true })
              .limit(1)
              .maybeSingle();
            if (resolvedFallbackSystem?.id) {
              targetSystem = resolvedFallbackSystem as IrrigationSystemRow;
              setIrrigationSystem(targetSystem);
              console.log("[AutoToggle] Resolved fallback system from userId", {
                systemId: targetSystem.id,
              });
              break;
            }

            const { data: createdSystem, error: createSystemError } =
              await supabase
                .from("irrigation_system")
                .insert({
                  farm_id: farmData.id,
                  system_name: "Main Irrigation System",
                  hardware_model: null,
                  water_source_details: null,
                  pump_status: false,
                  auto_mode_enabled: false,
                })
                .select(
                  "id, farm_id, system_name, pump_status, auto_mode_enabled",
                )
                .single();

            if (!createSystemError && createdSystem?.id) {
              targetSystem = createdSystem as IrrigationSystemRow;
              setIrrigationSystem(targetSystem);
              console.log("[AutoToggle] Created system from userId fallback", {
                systemId: targetSystem.id,
                farmId: farmData.id,
              });
              break;
            }

            if (
              createSystemError &&
              isMissingAutoModeColumnError(createSystemError)
            ) {
              const { data: createdNoAutoSystem, error: createdNoAutoError } =
                await supabase
                  .from("irrigation_system")
                  .insert({
                    farm_id: farmData.id,
                    system_name: "Main Irrigation System",
                    hardware_model: null,
                    water_source_details: null,
                    pump_status: false,
                  })
                  .select("id, farm_id, system_name, pump_status")
                  .single();
              if (!createdNoAutoError && createdNoAutoSystem?.id) {
                targetSystem = createdNoAutoSystem as IrrigationSystemRow;
                setIrrigationSystem(targetSystem);
                setSupportsAutoModeColumn(false);
                console.log(
                  "[AutoToggle] Created system from userId fallback (no auto column)",
                  {
                    systemId: targetSystem.id,
                    farmId: farmData.id,
                  },
                );
                break;
              }
            }
          }
        }
        if (!targetSystem?.id) {
          console.warn("[AutoToggle] Abort: no target system");
          Alert.alert(
            "System Not Ready",
            "No irrigation system is linked yet for this farm. Please set up your farm and irrigation system first before using automatic irrigation.",
          );
          return;
        }

        const scheduleId = effectiveUserId
          ? await getActiveScheduleId(effectiveUserId)
          : null;
        const shouldStopPump = !on && targetSystem.pump_status;
        // Auto mode should own pump decisions from soil thresholds, so clear
        // manual pump command when auto is enabled.
        const nextPumpStatus = on
          ? false
          : shouldStopPump
            ? false
            : targetSystem.pump_status;
        console.log("[AutoToggle] Applying DB update", {
          systemId: targetSystem.id,
          scheduleId,
          shouldStopPump,
          nextPumpStatus,
          nextAutoMode: on,
        });

        const { error: systemError } = await supabase
          .from("irrigation_system")
          .update({
            pump_status: nextPumpStatus,
            auto_mode_enabled: on,
          })
          .eq("id", targetSystem.id);
        if (systemError) {
          console.error(
            "[AutoToggle] irrigation_system update failed",
            systemError,
          );
          if (isMissingAutoModeColumnError(systemError)) {
            setSupportsAutoModeColumn(false);
            Alert.alert(
              "Database Update Needed",
              "Please add irrigation_system.auto_mode_enabled in Supabase before using the automatic irrigation switch.",
            );
            return;
          }
          throw systemError;
        }
        console.log("[AutoToggle] irrigation_system update success");

        const nowIso = new Date().toISOString();
        const { error: logError } = await supabase
          .from("irrigation_log")
          .insert({
            system_id: targetSystem.id,
            triggered_by_user_id: effectiveUserId,
            trigger_type: "Automated",
            status: shouldStopPump ? "completed" : "idle",
            command: on ? "auto_mode_on" : "auto_mode_off",
            start_time: nowIso,
            end_time: shouldStopPump ? nowIso : null,
            duration_seconds: shouldStopPump ? 0 : null,
            schedule_id: scheduleId,
          });
        if (logError) {
          console.error("[AutoToggle] irrigation_log insert failed", logError);
          throw logError;
        }
        console.log("[AutoToggle] irrigation_log insert success");

        const bridgeSynced = await syncIrrigationStateToBridge({
          systemId: targetSystem.id,
          autoModeEnabled: on,
          pumpStatus: nextPumpStatus,
        });

        setIrrigationSystem((prev) =>
          prev
            ? {
                ...prev,
                pump_status: nextPumpStatus,
                auto_mode_enabled: on,
              }
            : prev,
        );
        setAutoIrrigationModeOn(on);
        await AsyncStorage.setItem(AUTO_IRRIGATION_MODE_KEY, on ? "1" : "0");
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        console.log("[AutoToggle] Completed", {
          systemId: targetSystem.id,
          on,
          bridgeSynced,
        });
        if (!bridgeSynced) {
          Alert.alert(
            "Saved, But Bridge Is Offline",
            "Automatic mode was saved to the database, but the hardware bridge did not confirm the update. Please check your bridge deployment endpoint.",
          );
        }
      } catch (error) {
        console.error("Failed to set automatic irrigation mode:", error);
        Alert.alert(
          "Update Failed",
          "Unable to change automatic irrigation mode. Please try again.",
        );
      } finally {
        setAutoIrrigationConfirmOpen(false);
      }
    },
    [
      getActiveScheduleId,
      irrigationSystem,
      profileSource,
      syncIrrigationStateToBridge,
      userId,
    ],
  );

  const timeToMinutes = (timeStr: string): number => {
    try {
      const normalized = normalizeScheduleTime(timeStr);
      const [time, periodRaw] = normalized.split(" ");
      const period = (periodRaw || "").toUpperCase();
      const [hour, minute] = time.split(":").map(Number);
      if (Number.isNaN(hour) || Number.isNaN(minute)) return -1;
      let total = hour * 60 + minute;
      if (period === "PM" && hour !== 12) total += 12 * 60;
      else if (period === "AM" && hour === 12) total -= 12 * 60;
      return total;
    } catch {
      return -1;
    }
  };

  const fetchNextSchedule = useCallback(async (uid: string) => {
    setScheduleLoading(true);
    try {
      const { data: userSchedules } = await supabase
        .from("irrigation_schedules")
        .select("id")
        .eq("user_id", uid)
        .eq("is_active", true)
        .limit(10);

      const scheduleIds = [...(userSchedules ?? []).map((s) => String(s.id))];

      if (scheduleIds.length === 0) {
        const { data: userSchedulesAny } = await supabase
          .from("irrigation_schedules")
          .select("id")
          .eq("user_id", uid)
          .limit(10);
        scheduleIds.push(...(userSchedulesAny ?? []).map((s) => String(s.id)));
      }

      if (scheduleIds.length === 0) {
        setNextScheduleTime("No scheduled time");
        return;
      }

      const now = new Date();
      const todayYmd = toYmdLocal(now);
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const { data: scheduleRows } = await supabase
        .from("irrigation_scheduled_dates")
        .select(
          "schedule_id, time, scheduled_date, day, month, year, approval_status",
        )
        .in("schedule_id", scheduleIds)
        .gte("scheduled_date", todayYmd)
        .order("scheduled_date", { ascending: true })
        .order("time", { ascending: true });

      const nextRow = (scheduleRows ?? [])
        .filter(
          (r) =>
            r.time &&
            r.time !== "Not set" &&
            (r.approval_status === null ||
              String(r.approval_status).toLowerCase() !== "rejected"),
        )
        .find((r) => {
          const dateValue =
            String(r.scheduled_date ?? "") ||
            toYmdLocal(
              new Date(Number(r.year), Number(r.month) - 1, Number(r.day)),
            );
          if (dateValue > todayYmd) return true;
          if (dateValue < todayYmd) return false;
          return timeToMinutes(String(r.time)) > currentMinutes;
        });

      if (nextRow) {
        const dateText =
          formatScheduleDateFromValue(String(nextRow.scheduled_date ?? "")) ??
          formatScheduleDateOnly(
            Number(nextRow.day),
            Number(nextRow.month),
            Number(nextRow.year),
          );
        setNextScheduleTime(
          `${dateText}, ${normalizeScheduleTime(String(nextRow.time))}`,
        );
        return;
      }

      setNextScheduleTime("No scheduled time");
    } catch (e) {
      console.error("Error fetching next schedule:", e);
      setNextScheduleTime("No scheduled time");
    } finally {
      setScheduleLoading(false);
    }
  }, []);

  const ensureIrrigationSystem = useCallback(
    async (profile: UserProfileSource): Promise<IrrigationSystemRow | null> => {
      const ownerCandidates = toOwnerIdCandidates(profile);
      let farm: { id: number | string } | null = null;
      let lastFarmError: { code?: string; message?: string } | null = null;

      for (const ownerCandidate of ownerCandidates) {
        const { data: farmData, error: farmError } = await supabase
          .from("farm")
          .select("id")
          .eq("owner_id", ownerCandidate)
          .maybeSingle();

        if (farmError) {
          if (farmError.code === "22P02") {
            lastFarmError = farmError;
            continue;
          }
          return null;
        }

        if (farmData?.id) {
          farm = farmData;
          break;
        }
      }

      if (!farm?.id) {
        if (lastFarmError?.code === "22P02") {
          console.error(
            "Failed to load farm: owner_id expects bigint but profile identifiers are non-numeric.",
          );
        }
        return null;
      }

      const { data: existing, error: existingError } = await supabase
        .from("irrigation_system")
        .select("id, farm_id, system_name, pump_status, auto_mode_enabled")
        .eq("farm_id", farm.id)
        .eq("system_name", "Main Irrigation System")
        .maybeSingle();
      if (existingError && !isMissingAutoModeColumnError(existingError)) {
        return null;
      }

      if (existingError && isMissingAutoModeColumnError(existingError)) {
        setSupportsAutoModeColumn(false);
        const { data: existingNoAuto, error: existingNoAutoError } =
          await supabase
            .from("irrigation_system")
            .select("id, farm_id, system_name, pump_status")
            .eq("farm_id", farm.id)
            .eq("system_name", "Main Irrigation System")
            .maybeSingle();
        if (existingNoAutoError) return null;
        if (existingNoAuto) {
          setIrrigationSystem(existingNoAuto as IrrigationSystemRow);
          setAutoIrrigationModeOn(false);
          return existingNoAuto as IrrigationSystemRow;
        }
      }

      if (existing) {
        setSupportsAutoModeColumn(true);
        setIrrigationSystem(existing as IrrigationSystemRow);
        setAutoIrrigationModeOn(Boolean(existing.auto_mode_enabled));
        return existing as IrrigationSystemRow;
      }

      const { data: existingFallback, error: existingFallbackError } =
        await supabase
          .from("irrigation_system")
          .select("id, farm_id, system_name, pump_status, auto_mode_enabled")
          .eq("farm_id", farm.id)
          .order("id", { ascending: true })
          .limit(1)
          .maybeSingle();
      if (!existingFallbackError && existingFallback) {
        setSupportsAutoModeColumn(true);
        setIrrigationSystem(existingFallback as IrrigationSystemRow);
        setAutoIrrigationModeOn(Boolean(existingFallback.auto_mode_enabled));
        return existingFallback as IrrigationSystemRow;
      }

      const { data: created, error: createError } = await supabase
        .from("irrigation_system")
        .insert({
          farm_id: farm.id,
          system_name: "Main Irrigation System",
          hardware_model: null,
          water_source_details: null,
          pump_status: false,
          auto_mode_enabled: false,
        })
        .select("id, farm_id, system_name, pump_status, auto_mode_enabled")
        .single();
      if (createError && isMissingAutoModeColumnError(createError)) {
        setSupportsAutoModeColumn(false);
        const { data: createdNoAuto, error: createdNoAutoError } =
          await supabase
            .from("irrigation_system")
            .insert({
              farm_id: farm.id,
              system_name: "Main Irrigation System",
              hardware_model: null,
              water_source_details: null,
              pump_status: false,
            })
            .select("id, farm_id, system_name, pump_status")
            .single();
        if (!createdNoAutoError && createdNoAuto) {
          setIrrigationSystem(createdNoAuto as IrrigationSystemRow);
          setAutoIrrigationModeOn(false);
          return createdNoAuto as IrrigationSystemRow;
        }
        return null;
      }
      if (!createError && created) {
        setSupportsAutoModeColumn(true);
        setIrrigationSystem(created as IrrigationSystemRow);
        setAutoIrrigationModeOn(Boolean(created.auto_mode_enabled));
        return created as IrrigationSystemRow;
      }
      return null;
    },
    [],
  );

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
      try {
        let lookupEmail = email;
        if (!lookupEmail) {
          const fallbackEmail = (await getLoggedInEmail()) ?? "";
          if (!fallbackEmail) {
            setLoadingName(false);
            setScheduleLoading(false);
            return;
          }
          lookupEmail = fallbackEmail;
          console.log("[Dashboard] Using auth email fallback", { lookupEmail });
        }

        const { data, error } = await supabase
          .from("user_profiles")
          .select("id, name, profile_picture, role")
          .eq("email", lookupEmail)
          .maybeSingle();
        if (!error && data) {
          if (isAdminRole(data.role)) {
            await clearAllStorage();
            router.replace({
              pathname: "/UserManagement/login",
              params: { blocked: "admin" },
            });
            return;
          }
          setFullName(data.name || "Farmer");
          setProfilePicture(data.profile_picture);
          setUserId(data.id);
          setProfileSource(data as UserProfileSource);
          fetchNextSchedule(data.id);
          void ensureIrrigationSystem(data as UserProfileSource);
        } else {
          console.warn("[Dashboard] Profile lookup failed", {
            lookupEmail,
            error,
          });
          setScheduleLoading(false);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        setScheduleLoading(false);
      } finally {
        setLoadingName(false);
      }
    };
    fetchProfile();
  }, [email, ensureIrrigationSystem, fetchNextSchedule]);

  useEffect(() => {
    if (!irrigationSystem?.id) return;
    const channel = supabase
      .channel(`dashboard-irrigation-system-${irrigationSystem.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "irrigation_system",
          filter: `id=eq.${irrigationSystem.id}`,
        },
        (payload) => {
          const next = payload.new as Partial<IrrigationSystemRow>;
          setIrrigationSystem((prev) =>
            prev
              ? {
                  ...prev,
                  pump_status: Boolean(next.pump_status),
                  auto_mode_enabled:
                    typeof next.auto_mode_enabled === "boolean"
                      ? next.auto_mode_enabled
                      : prev.auto_mode_enabled,
                }
              : prev,
          );
          if (typeof next.auto_mode_enabled === "boolean") {
            setAutoIrrigationModeOn(next.auto_mode_enabled);
            void AsyncStorage.setItem(
              AUTO_IRRIGATION_MODE_KEY,
              next.auto_mode_enabled ? "1" : "0",
            ).catch(() => {});
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "irrigation_log",
          filter: `system_id=eq.${irrigationSystem.id}`,
        },
        (payload) => {
          const row = payload.new as {
            command?: string | null;
            trigger_type?: string | null;
          };
          const command = String(row.command ?? "").toLowerCase();
          if (command === "auto_mode_on") {
            setAutoIrrigationModeOn(true);
            void AsyncStorage.setItem(AUTO_IRRIGATION_MODE_KEY, "1").catch(
              () => {},
            );
          } else if (command === "auto_mode_off") {
            setAutoIrrigationModeOn(false);
            void AsyncStorage.setItem(AUTO_IRRIGATION_MODE_KEY, "0").catch(
              () => {},
            );
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [irrigationSystem?.id]);

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
      const { data: recommendationRows, error } = await supabase
        .from("notifications")
        .select("id, type, title, message, is_read, created_at")
        .eq("user_id", userId)
        .eq("type", "recommendation")
        .order("created_at", { ascending: false })
        .limit(20);
      if (!error && recommendationRows) {
        const recommendationItems = recommendationRows.map((n) => ({
          id: `recommendation-${String(n.id)}`,
          type: n.type as string,
          title: n.title as string,
          message: n.message as string,
          is_read: n.is_read as boolean | null,
          created_at: (n.created_at as string | null) ?? null,
        }));

        const { data: scheduleRows } = await supabase
          .from("irrigation_schedules")
          .select("id")
          .eq("user_id", userId);
        const scheduleIds = (scheduleRows ?? []).map((row) => String(row.id));

        let remarkItems: {
          id: string;
          type: string;
          title: string;
          message: string;
          is_read: boolean | null;
          created_at: string | null;
        }[] = [];

        if (scheduleIds.length > 0) {
          const { data: scheduledDateRows } = await supabase
            .from("irrigation_scheduled_dates")
            .select("day, month, year")
            .in("schedule_id", scheduleIds);
          const userDateKeys = new Set(
            (scheduledDateRows ?? []).map(
              (row) => `${row.year}-${row.month}-${row.day}`,
            ),
          );

          if (userDateKeys.size > 0) {
            const { data: remarkRows } = await supabase
              .from("irrigation_remarks")
              .select("date_key, text, created_at")
              .order("created_at", { ascending: false })
              .limit(20);
            remarkItems = (remarkRows ?? [])
              .filter((row) => userDateKeys.has(String(row.date_key)))
              .map((row) => {
                const id = `remark-${String(row.date_key)}`;
                return {
                  id,
                  type: "admin_remark",
                  title: "Admin Remark",
                  message: String(row.text ?? ""),
                  is_read: readRemarkIds.includes(id),
                  created_at: (row.created_at as string | null) ?? null,
                };
              });
          }
        }

        const merged = [...recommendationItems, ...remarkItems]
          .sort(
            (a, b) =>
              new Date(b.created_at ?? 0).getTime() -
              new Date(a.created_at ?? 0).getTime(),
          )
          .slice(0, 20);
        setNotifications(merged);
        setUnreadCount(
          merged.filter((n) => n.is_read === false || n.is_read === null)
            .length,
        );
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  }, [readRemarkIds, userId]);

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
          setNotifications((prev) => [
            {
              id: `recommendation-${String(row.id)}`,
              type: row.type,
              title: row.title,
              message: row.message,
              is_read: row.is_read,
              created_at: row.created_at,
            },
            ...prev.slice(0, 19),
          ]);
          setUnreadCount((prev) => prev + 1);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "irrigation_remarks",
        },
        () => {
          void fetchNotifications();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchNotifications, userId]);

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
      const unreadRemarkIds = notifications
        .filter(
          (n) =>
            n.type === "admin_remark" &&
            (n.is_read === false || n.is_read === null),
        )
        .map((n) => n.id);
      if (unreadRemarkIds.length > 0) {
        setReadRemarkIds((prev) => [...new Set([...prev, ...unreadRemarkIds])]);
      }
      await fetchNotifications();
    } catch (error) {
      console.error("Error marking notifications as read:", error);
      Alert.alert("Error", "Failed to mark notifications as read.");
    }
  }, [fetchNotifications, notifications, userId]);

  const markNotificationAsRead = useCallback(
    async (id: string, type: string) => {
      if (!userId) return;
      try {
        if (type === "admin_remark") {
          if (!readRemarkIds.includes(id)) {
            setReadRemarkIds((prev) => [...prev, id]);
            setUnreadCount((prev) => Math.max(0, prev - 1));
          }
          return;
        }
        const rawId = Number(id.replace("recommendation-", ""));
        if (!Number.isFinite(rawId)) return;
        const { error } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", rawId)
          .eq("user_id", userId);
        if (error) throw error;
        await fetchNotifications();
      } catch (error) {
        console.error("Error marking notification as read:", error);
        Alert.alert("Error", "Failed to mark notification as read.");
      }
    },
    [fetchNotifications, readRemarkIds, userId],
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
  // FIX: use strict boundaries — <=40 Wet threshold raised to avoid
  // "Standby — Wet" triggering too early at mid-range values.
  const irrigStatus = sensorLoading
    ? null
    : soilMoisturePercent <= 25
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
        : soilMoisturePercent < 81
          ? {
              label: "Standby",
              chipStyle: styles.heroChipGood,
              textColor: "#059669",
              icon: "check-circle" as const,
            }
          : {
              label: "Standby",
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

  const bottomNavItems = MENU_ITEMS.slice(0, 4);
  const simplifiedDashboard = false;

  if (simplifiedDashboard) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.bgContainer}>
          <Image
            source={require("@/assets/images/bg_string_beans.png")}
            style={styles.bgImage}
            resizeMode="cover"
          />
          <View style={styles.bottomNav}>
            {bottomNavItems.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.bottomNavItem}
                activeOpacity={0.85}
                onPress={() => handleMenuNavigate(item.key)}
              >
                <FontAwesome name={item.icon as any} size={18} color="#fff" />
                <Text style={styles.bottomNavLabel} numberOfLines={1}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <ImageBackground
            source={require("@/assets/images/bg_string_beans.png")}
            style={styles.topHeroSection}
            imageStyle={styles.topHeroSectionImage}
            resizeMode="cover"
          >
            <View style={styles.topBar}>
              <TouchableOpacity
                onPress={() => setMenuOpen(true)}
                style={styles.iconCircleButton}
              >
                <FontAwesome name="bars" size={22} color="#000" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bellButton, styles.iconCircleButton]}
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

            {/* ── System Status Hero ── */}
            <View style={styles.heroBanner}>
              <View style={styles.heroLeft}>
                {loadingName ? (
                  <>
                    <View
                      style={[styles.skeletonBlock, styles.heroEyebrowSkeleton]}
                    />
                    <View
                      style={[
                        styles.skeletonBlock,
                        styles.heroGreetingSkeleton,
                      ]}
                    />
                    <View
                      style={[
                        styles.skeletonBlock,
                        styles.heroSubtitleSkeleton,
                      ]}
                    />
                  </>
                ) : (
                  <>
                    <Text style={styles.heroEyebrow}>SYSTEM STATUS</Text>
                    <Text style={styles.heroGreeting}>
                      Hi, {fullName.trim() || "Farmer"}
                    </Text>
                    <Text style={styles.heroSubtitle}>
                      Monitoring your string beans.
                    </Text>
                  </>
                )}
              </View>
              <View style={styles.heroRight}>
                <Pressable
                  onPress={openAutoIrrigationConfirm}
                  style={({ pressed }) => [
                    styles.heroAutoBadge,
                    autoIrrigationModeOn
                      ? styles.heroAutoBadgeOn
                      : styles.heroAutoBadgeOff,
                    pressed && styles.heroAutoBadgePressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    autoIrrigationModeOn
                      ? "Automatic irrigation is on, tap to change"
                      : "Automatic irrigation is off, tap to change"
                  }
                >
                  <FontAwesome
                    name={autoIrrigationModeOn ? "check" : "power-off"}
                    size={10}
                    color="#fff"
                  />
                  <Text style={styles.heroAutoBadgeText}>
                    {supportsAutoModeColumn
                      ? autoIrrigationModeOn
                        ? "On"
                        : "Off"
                      : "Setup"}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Status chips */}
            <View style={styles.heroChipsRow}>
              {sensorLoading || !irrigStatus ? (
                <View style={[styles.heroChip, styles.heroChipSkeleton]}>
                  <View
                    style={[styles.skeletonBlock, styles.chipSkeletonIcon]}
                  />
                  <View
                    style={[styles.skeletonBlock, styles.chipSkeletonText]}
                  />
                </View>
              ) : (
                <View style={[styles.heroChip, irrigStatus.chipStyle]}>
                  <FontAwesome
                    name={irrigStatus.icon}
                    size={11}
                    color={irrigStatus.textColor}
                  />
                  <Text
                    style={[
                      styles.heroChipText,
                      { color: irrigStatus.textColor },
                    ]}
                  >
                    {irrigStatus.label}
                  </Text>
                </View>
              )}
              {scheduleLoading ? (
                <View style={[styles.heroChipNeutral, styles.heroChipSkeleton]}>
                  <View
                    style={[styles.skeletonBlock, styles.chipSkeletonIcon]}
                  />
                  <View
                    style={[styles.skeletonBlock, styles.chipSkeletonText]}
                  />
                </View>
              ) : (
                <View style={styles.heroChipNeutral}>
                  <FontAwesome name="clock-o" size={11} color="#6B7280" />
                  <Text style={styles.heroChipNeutralText}>
                    {nextScheduleTime === "No scheduled time"
                      ? "No scheduled time"
                      : `Next: ${nextScheduleTime}`}
                  </Text>
                </View>
              )}
            </View>
          </ImageBackground>

          {/* ── Field Conditions Card ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Field Conditions</Text>
            {sensorLoading ? (
              <View style={styles.lastUpdatedSkeletonRow}>
                <View
                  style={[styles.skeletonBlock, styles.lastUpdatedSkeletonIcon]}
                />
                <View
                  style={[styles.skeletonBlock, styles.lastUpdatedSkeletonText]}
                />
              </View>
            ) : lastUpdated ? (
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
            ) : null}
            {sensorLoading ? (
              <View style={styles.gaugesRow}>
                {[0, 1, 2].map((key) => (
                  <View key={key} style={styles.gaugeSkeletonItem}>
                    <View style={styles.gaugeSkeletonCircle} />
                    <View
                      style={[styles.skeletonBlock, styles.gaugeSkeletonLabel]}
                    />
                    <View
                      style={[
                        styles.skeletonBlock,
                        styles.gaugeSkeletonSubLabel,
                      ]}
                    />
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.gaugesRow}>
                <CircularGauge
                  value={soilMoisturePercent}
                  maxValue={100}
                  gradientColors={["#34D399", "#10B981"]}
                  label="Soil Moisture"
                  subLabel={getSoilSeverity(soilMoisturePercent)}
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
                  subLabel={getHumiditySeverity(humidityPercent)}
                  unit="%"
                  icon={<FontAwesome name="tint" size={14} color="#A855F7" />}
                />
              </View>
            )}
          </View>

          {/* ── 7-Day Forecast Card ── */}
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
                {[0, 1, 2, 3].map((key) => (
                  <View key={key} style={styles.forecastSkeletonCard}>
                    <View
                      style={[
                        styles.skeletonBlock,
                        styles.forecastSkeletonLineSm,
                      ]}
                    />
                    <View
                      style={[
                        styles.skeletonBlock,
                        styles.forecastSkeletonLineXs,
                      ]}
                    />
                    <View style={styles.forecastSkeletonEmoji} />
                    <View
                      style={[
                        styles.skeletonBlock,
                        styles.forecastSkeletonLineSm,
                      ]}
                    />
                    <View
                      style={[
                        styles.skeletonBlock,
                        styles.forecastSkeletonLineMd,
                      ]}
                    />
                  </View>
                ))}
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
                <Text style={styles.notifTitle}>Notifications</Text>
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
                        await markNotificationAsRead(n.id, n.type);
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
                      name={n.type === "admin_remark" ? "comment" : "leaf"}
                      size={14}
                      color={
                        n.is_read
                          ? "#6B7280"
                          : n.type === "admin_remark"
                            ? colors.purple
                            : colors.brandGreen
                      }
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

        {/* ── Automatic irrigation confirm ── */}
        <Modal
          visible={autoIrrigationConfirmOpen}
          transparent
          animationType="fade"
          onRequestClose={cancelAutoIrrigationConfirm}
        >
          <View style={styles.popupBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={cancelAutoIrrigationConfirm}
            />
            <View style={styles.autoIrrigationModalCard}>
              <View
                style={[
                  styles.autoIrrigationModalIconWrap,
                  autoIrrigationPendingOn
                    ? styles.autoIrrigationModalIconOn
                    : styles.autoIrrigationModalIconOff,
                ]}
              >
                <FontAwesome
                  name={autoIrrigationPendingOn ? "toggle-on" : "toggle-off"}
                  size={22}
                  color={
                    autoIrrigationPendingOn ? colors.brandGreen : "#64748B"
                  }
                />
              </View>
              <Text style={styles.popupTitle}>
                {autoIrrigationPendingOn
                  ? "Turn on automatic irrigation?"
                  : "Turn off automatic irrigation?"}
              </Text>
              <Text style={styles.popupMessage}>
                {autoIrrigationPendingOn
                  ? "When automatic irrigation is on, your hardware controls the pump using soil moisture thresholds (dry/wet). Manual pump commands are paused until you switch this off."
                  : "Turning this off stops threshold-based automatic pumping. You can then control the pump manually from your app controls."}
              </Text>
              <View style={styles.autoIrrigationModalActions}>
                <TouchableOpacity
                  style={styles.autoIrrigationModalCancel}
                  onPress={cancelAutoIrrigationConfirm}
                  activeOpacity={0.85}
                >
                  <Text style={styles.autoIrrigationModalCancelText}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.autoIrrigationModalConfirm,
                    autoIrrigationPendingOn
                      ? styles.autoIrrigationModalConfirmOn
                      : styles.autoIrrigationModalConfirmOff,
                  ]}
                  onPress={() =>
                    applyAutoIrrigationMode(autoIrrigationPendingOn)
                  }
                  activeOpacity={0.85}
                >
                  <Text style={styles.autoIrrigationModalConfirmText}>
                    {autoIrrigationPendingOn ? "Turn on" : "Turn off"}
                  </Text>
                </TouchableOpacity>
              </View>
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
                      // FIX: close analytics dropdown and drawer before navigating
                      setAnalyticsOpen(false);
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
  bgContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  bgImage: {
    width: "100%",
    height: "100%",
  },
  bottomNav: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#DCE7D9",
  },
  bottomNavItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 4,
  },
  bottomNavLabel: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: "#9CA3AF",
    textAlign: "center",
  },
  bottomNavLabelActive: {
    color: colors.brandGreen,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    paddingVertical: 12,
    backgroundColor: "transparent",
  },
  iconCircleButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  topHeroSection: {
    borderRadius: 18,
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingBottom: 16,
    minHeight: 250,
    marginBottom: 2,
  },
  topHeroSectionImage: {
    borderRadius: 18,
  },

  // ── Hero Banner ──
  heroBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    paddingTop: 8,
    paddingBottom: 16,
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
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,1)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroEyebrowSkeleton: {
    width: 96,
    height: 10,
    marginBottom: 6,
  },
  heroGreetingSkeleton: {
    width: 180,
    height: 24,
    marginBottom: 6,
  },
  heroSubtitleSkeleton: {
    width: 210,
    height: 13,
  },
  heroRight: {
    alignItems: "center",
    gap: 8,
  },
  heroAutoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroAutoBadgeOn: {
    backgroundColor: colors.brandGreen,
  },
  heroAutoBadgeOff: {
    backgroundColor: "#94A3B8",
  },
  heroAutoBadgePressed: {
    opacity: 0.88,
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
  heroChipSkeleton: {
    borderColor: "#E5E7EB",
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
  skeletonBlock: {
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
  },
  chipSkeletonIcon: {
    width: 12,
    height: 12,
  },
  chipSkeletonText: {
    width: 120,
    height: 11,
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
  gaugeSkeletonItem: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  gaugeSkeletonCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: "#E5E7EB",
  },
  gaugeSkeletonLabel: {
    width: 72,
    height: 11,
  },
  gaugeSkeletonSubLabel: {
    width: 56,
    height: 10,
  },
  lastUpdatedSkeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: -6,
    marginBottom: 8,
  },
  lastUpdatedSkeletonIcon: {
    width: 11,
    height: 11,
  },
  lastUpdatedSkeletonText: {
    width: 170,
    height: 11,
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
    paddingVertical: 2,
  },
  forecastSkeletonCard: {
    width: 72,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  forecastSkeletonEmoji: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
  },
  forecastSkeletonLineXs: {
    width: 32,
    height: 8,
  },
  forecastSkeletonLineSm: {
    width: 46,
    height: 9,
  },
  forecastSkeletonLineMd: {
    width: 54,
    height: 9,
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
    fontSize: 22,
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
    textAlign: "justify",
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
    textAlign: "justify",
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

  autoIrrigationModalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    zIndex: 1,
  },
  autoIrrigationModalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    alignSelf: "center",
  },
  autoIrrigationModalIconOn: {
    backgroundColor: "#ECFDF5",
  },
  autoIrrigationModalIconOff: {
    backgroundColor: "#F1F5F9",
  },
  autoIrrigationModalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  autoIrrigationModalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
  },
  autoIrrigationModalCancelText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: "#374151",
  },
  autoIrrigationModalConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  autoIrrigationModalConfirmOn: {
    backgroundColor: colors.brandGreen,
  },
  autoIrrigationModalConfirmOff: {
    backgroundColor: "#64748B",
  },
  autoIrrigationModalConfirmText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: "#fff",
  },
});
