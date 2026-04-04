import { FontAwesome } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getWeatherData } from "../../lib/weatherConfig";

// ── Config ────────────────────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get("window");

const DEFAULT_COORDS = { latitude: 15.53, longitude: 120.6042 };
const DEFAULT_LABEL = "Dalayap, Tarlac City, Tarlac";

const TARLAC_BOUNDS = {
  minLat: 15.35,
  maxLat: 15.62,
  minLon: 120.5,
  maxLon: 120.7,
};

// ── Design tokens ─────────────────────────────────────────────────────────────
const colors = {
  brandBlue: "#3B82F6",
  brandBlueDark: "#1D4ED8",
  brandBlueLight: "#60A5FA",
  indigo: "#6366F1",
  red: "#EF4444",
  cyan: "#06B6D4",
  teal: "#14B8A6",
  orange: "#F97316",
  yellow: "#EAB308",
  emerald: "#10B981",
  grayText: "#94A3B8",
  grayBorder: "#E2E8F0",
  dark: "#0F172A",
  white: "#FFFFFF",
  surface: "#F8FAFC",
};

const fonts = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semibold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getWeatherIcon(code: number): string {
  if (code === 0) return "sun-o";
  if (code <= 2) return "cloud";
  if (code === 3) return "cloud";
  if (code >= 45 && code <= 48) return "low-vision";
  if (code >= 51 && code <= 67) return "tint";
  if (code >= 71 && code <= 77) return "asterisk";
  if (code >= 80 && code <= 82) return "tint";
  if (code >= 85 && code <= 86) return "asterisk";
  if (code >= 95) return "bolt";
  return "cloud";
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

function getUVLevel(uv: number): string {
  if (uv < 3) return "Low";
  if (uv < 6) return "Moderate";
  if (uv < 8) return "High";
  if (uv < 11) return "Very High";
  return "Extreme";
}

function getUVColor(uv: number): string {
  if (uv < 3) return colors.emerald;
  if (uv < 6) return colors.yellow;
  if (uv < 8) return colors.orange;
  if (uv < 11) return colors.red;
  return "#7C3AED";
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
    );
    const d = await res.json();
    if (d.city || d.locality)
      return `${d.city || d.locality}, ${d.principalSubdivision || d.countryName}`;
  } catch {
    /* ignore */
  }
  return `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

// Stat card used in the 2×4 grid
const StatCard = ({
  label,
  value,
  sub,
  iconName,
  iconColor,
  bg,
  border,
}: {
  label: string;
  value: string;
  sub: string;
  iconName: string;
  iconColor: string;
  bg: string;
  border: string;
}) => (
  <View style={[styles.statCard, { backgroundColor: bg, borderColor: border }]}>
    <View style={styles.statCardTop}>
      <Text style={styles.statCardLabel}>{label}</Text>
      <FontAwesome name={iconName as any} size={18} color={iconColor} />
    </View>
    <Text style={styles.statCardValue}>{value}</Text>
    <Text style={styles.statCardSub}>{sub}</Text>
  </View>
);

// Forecast day card
const ForecastCard = ({
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
  <View style={[styles.forecastCard, isToday && styles.forecastCardToday]}>
    <Text style={[styles.forecastDay, isToday && styles.forecastDayToday]}>
      {day}
    </Text>
    <Text style={[styles.forecastDate, isToday && styles.forecastDateToday]}>
      {date}
    </Text>
    <Text style={styles.forecastEmoji}>{getWeatherEmoji(code)}</Text>
    <Text
      style={[
        styles.forecastCondition,
        isToday && styles.forecastConditionToday,
      ]}
      numberOfLines={2}
    >
      {getWeatherDescription(code)}
    </Text>
    <View style={styles.forecastTemps}>
      <Text style={[styles.forecastHigh, isToday && { color: "#FED7AA" }]}>
        {high}°
      </Text>
      <Text style={[styles.forecastLow, isToday && { color: "#BFDBFE" }]}>
        {low}°
      </Text>
    </View>
    {precipitation > 0 && (
      <View style={styles.forecastRain}>
        <FontAwesome
          name="tint"
          size={10}
          color={isToday ? "#BFDBFE" : colors.brandBlue}
        />
        <Text
          style={[styles.forecastRainText, isToday && { color: "#BFDBFE" }]}
        >
          {precipitation.toFixed(1)}mm
        </Text>
      </View>
    )}
  </View>
);

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function WeatherUpdateScreen() {
  const router = useRouter();
  const [weatherData, setWeatherData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationName, setLocationName] = useState(DEFAULT_LABEL);
  const [coords, setCoords] = useState(DEFAULT_COORDS);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadWeather(DEFAULT_COORDS.latitude, DEFAULT_COORDS.longitude);
  }, []);

  const animateIn = () => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  };

  const loadWeather = async (lat: number, lon: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getWeatherData(lat, lon);
      setWeatherData(data);
      animateIn();
    } catch {
      setError("Failed to load weather data.");
    } finally {
      setLoading(false);
    }
  };

  const handleGPS = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Location permission is required to use GPS.",
        );
        setLocating(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = loc.coords;

      const inTarlac =
        latitude >= TARLAC_BOUNDS.minLat &&
        latitude <= TARLAC_BOUNDS.maxLat &&
        longitude >= TARLAC_BOUNDS.minLon &&
        longitude <= TARLAC_BOUNDS.maxLon;

      if (!inTarlac) {
        Alert.alert(
          "Outside Tarlac City",
          "Your location is outside Tarlac City. Showing weather for Tarlac City instead.",
          [{ text: "OK" }],
        );
        setLocationName(DEFAULT_LABEL);
        setCoords(DEFAULT_COORDS);
        await loadWeather(DEFAULT_COORDS.latitude, DEFAULT_COORDS.longitude);
      } else {
        const name = await reverseGeocode(latitude, longitude);
        setLocationName(name);
        setCoords({ latitude, longitude });
        await loadWeather(latitude, longitude);
      }
    } catch {
      Alert.alert(
        "Error",
        "Could not get GPS location. Using default location.",
      );
      await loadWeather(DEFAULT_COORDS.latitude, DEFAULT_COORDS.longitude);
    } finally {
      setLocating(false);
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.brandBlue} />
          <Text style={styles.loaderText}>Loading weather data…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ──
  if (error || !weatherData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <FontAwesome name="chevron-left" size={16} color={colors.dark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Weather Update</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.errorWrap}>
          <FontAwesome
            name="exclamation-triangle"
            size={48}
            color={colors.grayText}
          />
          <Text style={styles.errorText}>
            {error ?? "No weather data available"}
          </Text>
          <TouchableOpacity
            onPress={() => loadWeather(coords.latitude, coords.longitude)}
            style={styles.retryBtn}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Data ──
  const { current, daily } = weatherData;
  const currentTemp = Math.round(current.temperature_2m);
  const feelsLike = Math.round(current.apparent_temperature);
  const uvToday = daily.uv_index_max[0];
  const updatedTime = new Date(current.time).toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date();

  const dailyForecast = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    return {
      day: i === 0 ? "Today" : i === 1 ? "Tomorrow" : daysOfWeek[date.getDay()],
      date: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      code: daily.weather_code[i],
      high: Math.round(daily.temperature_2m_max[i]),
      low: Math.round(daily.temperature_2m_min[i]),
      precipitation: daily.precipitation_sum?.[i] ?? 0,
      uvIndex: daily.uv_index_max[i],
    };
  });

  const statCards = [
    {
      label: "Today's High",
      value: `${Math.round(daily.temperature_2m_max[0])}°C`,
      sub: "Max temperature",
      iconName: "thermometer",
      iconColor: colors.red,
      bg: "#FEF2F2",
      border: "#FECACA",
    },
    {
      label: "Today's Low",
      value: `${Math.round(daily.temperature_2m_min[0])}°C`,
      sub: "Min temperature",
      iconName: "thermometer-empty",
      iconColor: colors.brandBlue,
      bg: "#EFF6FF",
      border: "#BFDBFE",
    },
    {
      label: "Precipitation",
      value: `${(daily.precipitation_sum?.[0] ?? 0).toFixed(1)} mm`,
      sub: "Expected today",
      iconName: "cloud",
      iconColor: colors.indigo,
      bg: "#EEF2FF",
      border: "#C7D2FE",
    },
    {
      label: "UV Index",
      value: getUVLevel(uvToday),
      sub: `Max: ${uvToday.toFixed(1)}`,
      iconName: "sun-o",
      iconColor: getUVColor(uvToday),
      bg: "#FEFCE8",
      border: "#FEF08A",
    },
    {
      label: "Humidity",
      value: `${current.relative_humidity_2m}%`,
      sub:
        current.relative_humidity_2m > 70
          ? "Monitor fungal risk"
          : "Normal levels",
      iconName: "tint",
      iconColor: colors.cyan,
      bg: "#ECFEFF",
      border: "#A5F3FC",
    },
    {
      label: "Wind Speed",
      value: `${current.wind_speed_10m.toFixed(1)} km/h`,
      sub: current.wind_speed_10m > 30 ? "Check supports!" : "Calm conditions",
      iconName: "flag-o",
      iconColor: colors.teal,
      bg: "#F0FDFA",
      border: "#99F6E4",
    },
    {
      label: "Feels Like",
      value: `${feelsLike}°C`,
      sub: "Apparent temperature",
      iconName: "thermometer-half",
      iconColor: colors.orange,
      bg: "#FFF7ED",
      border: "#FED7AA",
    },
    {
      label: "Condition",
      value: getWeatherDescription(current.weather_code),
      sub: today.toLocaleDateString("en-US", { weekday: "long" }),
      iconName: getWeatherIcon(current.weather_code),
      iconColor: colors.grayText,
      bg: colors.surface,
      border: colors.grayBorder,
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome name="chevron-left" size={16} color={colors.dark} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Weather Update</Text>
          <Text style={styles.headerSub}>
            Real-time conditions for string bean farming
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleGPS}
          style={[styles.gpsBtn, locating && { opacity: 0.6 }]}
          disabled={locating}
        >
          {locating ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <FontAwesome name="location-arrow" size={15} color={colors.white} />
          )}
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        style={[styles.scroll, { opacity: fadeAnim }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Location row */}
        <View style={styles.locationRow}>
          <FontAwesome name="map-marker" size={14} color={colors.brandBlue} />
          <Text style={styles.locationName} numberOfLines={1}>
            {locationName}
          </Text>
          <Text style={styles.locationCoords}>
            {weatherData.latitude.toFixed(4)}°N,{" "}
            {weatherData.longitude.toFixed(4)}°E
          </Text>
        </View>

        {/* ── Main weather card ── */}
        <LinearGradient
          colors={["#3B82F6", "#4F46E5"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.mainCard}
        >
          {/* Label */}
          <Text style={styles.mainCardLabel}>RIGHT NOW</Text>

          {/* Top row: temp + emoji */}
          <View style={styles.mainTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.mainTemp}>{currentTemp}°</Text>
              <Text style={styles.mainCondition}>
                {getWeatherDescription(current.weather_code)}
              </Text>
              <Text style={styles.mainFeels}>Feels like {feelsLike}°C</Text>
            </View>
            <Text style={styles.mainEmoji}>
              {getWeatherEmoji(current.weather_code)}
            </Text>
          </View>

          {/* Divider */}
          <View style={styles.mainDivider} />

          {/* Bottom stats grid */}
          <View style={styles.mainStatsGrid}>
            {[
              {
                icon: "tint",
                label: "Humidity",
                value: `${current.relative_humidity_2m}%`,
              },
              {
                icon: "flag-o",
                label: "Wind",
                value: `${current.wind_speed_10m.toFixed(1)} km/h`,
              },
              { icon: "sun-o", label: "UV Index", value: getUVLevel(uvToday) },
              {
                icon: "umbrella",
                label: "Rain",
                value: `${current.precipitation.toFixed(1)} mm`,
              },
            ].map((s, i) => (
              <View key={i} style={styles.mainStatItem}>
                <FontAwesome
                  name={s.icon as any}
                  size={13}
                  color="rgba(255,255,255,0.7)"
                />
                <Text style={styles.mainStatLabel}>{s.label}</Text>
                <Text style={styles.mainStatValue}>{s.value}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.mainUpdated}>Updated {updatedTime}</Text>
        </LinearGradient>

        {/* ── 7-Day Forecast ── */}
        <View style={styles.forecastSection}>
          <View style={styles.forecastHeader}>
            <FontAwesome name="calendar" size={16} color={colors.brandBlue} />
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
              7-Day Forecast
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.forecastScroll}
          >
            {dailyForecast.map((f, i) => (
              <ForecastCard key={i} {...f} isToday={i === 0} />
            ))}
          </ScrollView>
        </View>

        {/* ── Stat cards grid (2×4) ── */}
        <Text style={styles.sectionTitle}>Today&apos;s Stats</Text>
        <View style={styles.statGrid}>
          {statCards.map((s, i) => (
            <StatCard key={i} {...s} />
          ))}
        </View>

        {/* ── Farming Alerts ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🌱 Farming Alerts</Text>
          <View style={{ gap: 8, marginTop: 6 }}>
            {current.wind_speed_10m > 30 && (
              <View
                style={[
                  styles.alertRow,
                  { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
                ]}
              >
                <Text style={styles.alertIcon}>🌀</Text>
                <Text style={styles.alertText}>
                  Strong winds ({current.wind_speed_10m.toFixed(1)} km/h) —
                  check plant supports and trellises.
                </Text>
              </View>
            )}
            {current.relative_humidity_2m > 75 && (
              <View
                style={[
                  styles.alertRow,
                  { backgroundColor: "#ECFEFF", borderColor: "#A5F3FC" },
                ]}
              >
                <Text style={styles.alertIcon}>💧</Text>
                <Text style={styles.alertText}>
                  High humidity ({current.relative_humidity_2m}%) — monitor for
                  fungal disease. Improve airflow.
                </Text>
              </View>
            )}
            {uvToday >= 8 && (
              <View
                style={[
                  styles.alertRow,
                  { backgroundColor: "#FEFCE8", borderColor: "#FEF08A" },
                ]}
              >
                <Text style={styles.alertIcon}>☀️</Text>
                <Text style={styles.alertText}>
                  High UV index ({uvToday.toFixed(1)}) — irrigate early morning
                  to reduce heat stress on plants.
                </Text>
              </View>
            )}
            {(daily.precipitation_sum?.[0] ?? 0) > 80 && (
              <View
                style={[
                  styles.alertRow,
                  { backgroundColor: "#EEF2FF", borderColor: "#C7D2FE" },
                ]}
              >
                <Text style={styles.alertIcon}>🌧️</Text>
                <Text style={styles.alertText}>
                  Heavy rain expected ({daily.precipitation_sum[0].toFixed(1)}
                  mm) — ensure drainage channels are clear.
                </Text>
              </View>
            )}
            {current.wind_speed_10m <= 30 &&
              current.relative_humidity_2m <= 75 &&
              uvToday < 8 &&
              (daily.precipitation_sum?.[0] ?? 0) <= 80 && (
                <View
                  style={[
                    styles.alertRow,
                    { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
                  ]}
                >
                  <Text style={styles.alertIcon}>✅</Text>
                  <Text style={styles.alertText}>
                    Conditions are favorable for string bean farming today. No
                    active weather alerts.
                  </Text>
                </View>
              )}
          </View>
        </View>

        <View style={{ height: 32 }} />
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const CARD_W = (SCREEN_W - 48) / 2; // 2-col grid with 16px padding + 8px gap

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },

  // Loading / Error
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loaderText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.grayText,
  },
  errorWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 24,
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.grayText,
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: colors.brandBlue,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.white,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayBorder,
  },
  backBtn: { padding: 8 },
  headerTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.dark },
  headerSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.grayText,
    marginTop: 1,
  },
  gpsBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.brandBlue,
    alignItems: "center",
    justifyContent: "center",
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 14 },

  // Location row
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  locationName: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.dark,
    flex: 1,
  },
  locationCoords: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.grayText,
  },

  // Main card
  mainCard: { borderRadius: 24, padding: 20 },
  mainCardLabel: {
    fontFamily: fonts.semibold,
    fontSize: 9,
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  mainTopRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  mainTemp: {
    fontFamily: fonts.bold,
    fontSize: 64,
    color: colors.white,
    lineHeight: 68,
  },
  mainCondition: {
    fontFamily: fonts.medium,
    fontSize: 18,
    color: "rgba(255,255,255,0.9)",
    marginTop: 2,
  },
  mainFeels: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginTop: 3,
  },
  mainEmoji: { fontSize: 56, lineHeight: 68 },
  mainDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginBottom: 16,
  },
  mainStatsGrid: { flexDirection: "row", justifyContent: "space-between" },
  mainStatItem: { alignItems: "center", gap: 4 },
  mainStatLabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: "rgba(255,255,255,0.65)",
  },
  mainStatValue: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.white,
  },
  mainUpdated: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    marginTop: 12,
    textAlign: "right",
  },

  // Section title
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.dark,
    marginBottom: 8,
  },

  // Stat grid
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statCard: {
    width: CARD_W,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  statCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  statCardLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.grayText,
  },
  statCardValue: { fontFamily: fonts.bold, fontSize: 18, color: colors.dark },
  statCardSub: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.grayText,
  },

  // Forecast section
  forecastSection: { gap: 10 },
  forecastHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  forecastScroll: { gap: 8, paddingVertical: 2 },
  forecastCard: {
    width: 100,
    borderRadius: 16,
    padding: 10,
    gap: 4,
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: colors.grayBorder,
  },
  forecastCardToday: {
    backgroundColor: colors.brandBlue,
    borderColor: colors.brandBlue,
  },
  forecastDay: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.grayText,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  forecastDayToday: { color: "rgba(255,255,255,0.7)" },
  forecastDate: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.grayText,
  },
  forecastDateToday: { color: "rgba(255,255,255,0.6)" },
  forecastEmoji: { fontSize: 26, lineHeight: 32 },
  forecastCondition: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.grayText,
    textAlign: "center",
    lineHeight: 14,
  },
  forecastConditionToday: { color: "rgba(255,255,255,0.8)" },
  forecastTemps: { flexDirection: "row", gap: 6 },
  forecastHigh: { fontFamily: fonts.bold, fontSize: 13, color: colors.red },
  forecastLow: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.brandBlue,
  },
  forecastRain: { flexDirection: "row", alignItems: "center", gap: 3 },
  forecastRainText: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.brandBlue,
  },

  // Alerts
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.grayBorder,
  },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.dark },
  alertRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  alertIcon: { fontSize: 16 },
  alertText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: "#374151",
    lineHeight: 18,
  },
});
