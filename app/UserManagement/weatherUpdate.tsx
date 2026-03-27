import { fontScale, scale } from "@/lib/responsive";
import { FontAwesome } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getWeatherData } from "../../lib/weatherConfig";

const colors = {
  brandBlue: "#007AFF",
  brandBlueDark: "#004E92",
  brandBlueLight: "#4FACFE",
  brandGrayText: "#8A8A8E",
  brandGrayBorder: "#D1D1D6",
  cardBg: "#111827",
};

const fonts = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semibold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
};

// Tarlac City boundaries (approximate)
const TARLAC_CITY_BOUNDS = {
  minLat: 15.35,
  maxLat: 15.62,
  minLon: 120.5,
  maxLon: 120.7,
};

const FIXED_LOCATION_LABEL = "Dalayap, Tarlac City, Tarlac";

export default function WeatherUpdateScreen() {
  const router = useRouter();
  const [weatherData, setWeatherData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationName, setLocationName] =
    useState<string>(FIXED_LOCATION_LABEL);

  useEffect(() => {
    loadWeatherWithLocation();
  }, []);

  async function loadWeatherWithLocation() {
    try {
      setLoading(true);
      setError(null);

      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        console.log("Permission denied, using default Tarlac City coordinates");
        await loadWeatherForDefaultLocation();
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;

      // Check if within Tarlac City bounds (for validation only)
      const isInTarlacCity =
        latitude >= TARLAC_CITY_BOUNDS.minLat &&
        latitude <= TARLAC_CITY_BOUNDS.maxLat &&
        longitude >= TARLAC_CITY_BOUNDS.minLon &&
        longitude <= TARLAC_CITY_BOUNDS.maxLon;

      if (!isInTarlacCity) {
        Alert.alert(
          "Outside Tarlac City",
          "Your current location is outside Tarlac City. Showing weather for Tarlac City center instead.",
          [{ text: "OK" }],
        );
        await loadWeatherForDefaultLocation();
        return;
      }

      // Always use fixed farm location label in UI for consistency
      setLocationName(FIXED_LOCATION_LABEL);

      // Fetch weather data for current location
      const data = await getWeatherData(latitude, longitude);
      setWeatherData(data);
    } catch (err) {
      console.error("Failed to load weather:", err);
      setError("Failed to load weather data");
      // Fallback to default location
      await loadWeatherForDefaultLocation();
    } finally {
      setLoading(false);
    }
  }

  async function loadWeatherForDefaultLocation() {
    try {
      const data = await getWeatherData(); // Uses default project coordinates
      setWeatherData(data);
      setLocationName(FIXED_LOCATION_LABEL);
    } catch (err) {
      console.error("Failed to load default weather:", err);
      setError("Failed to load weather data");
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color={colors.brandBlue} />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !weatherData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, styles.centerContent]}>
          <FontAwesome
            name="exclamation-triangle"
            size={48}
            color={colors.brandGrayText}
          />
          <Text style={styles.errorText}>
            {error || "No weather data available"}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadWeatherWithLocation}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Get forecast for next 4 days including today
  const forecastDays = [];
  const today = new Date();
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (let i = 0; i < 4; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dayName = i === 0 ? "Today" : daysOfWeek[date.getDay()];
    forecastDays.push(dayName);
  }

  const forecast = forecastDays.map((day, idx) => ({
    day,
    temp: `${Math.round(weatherData.daily.temperature_2m_max[idx])}°`,
    icon: getWeatherIcon(weatherData.daily.weather_code[idx]),
  }));

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top App Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <FontAwesome name="chevron-left" size={20} color="#000" />
          </TouchableOpacity>

          <Text style={styles.topBarTitle}>Weather Update</Text>

          <View style={styles.topBarRight}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={loadWeatherWithLocation}
            >
              <FontAwesome name="location-arrow" size={18} color="#000" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Location row */}
          <View style={styles.locationRow}>
            <View>
              <Text style={styles.locationText}>{locationName}</Text>
              <Text style={styles.locationCoords}>
                {weatherData.latitude.toFixed(4)}°N,{" "}
                {weatherData.longitude.toFixed(4)}°E
              </Text>
            </View>
            <View style={styles.locationRight}>
              <FontAwesome
                name="map-marker"
                size={16}
                color={colors.brandBlue}
              />
            </View>
          </View>

          {/* Main weather card */}
          <LinearGradient
            colors={[colors.brandBlueLight, colors.brandBlueDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.mainCard}
          >
            <View style={styles.mainTopRow}>
              <View>
                <Text style={styles.mainTemp}>
                  {Math.round(weatherData.current.temperature_2m)}°
                </Text>
                <Text style={styles.mainCondition}>
                  {getWeatherCondition(weatherData.current.weather_code)}
                </Text>
                <Text style={styles.mainDetail}>
                  Feels like{" "}
                  {Math.round(weatherData.current.apparent_temperature)}°
                </Text>
              </View>
              <View style={styles.mainIconCircle}>
                <FontAwesome
                  name={getWeatherIcon(weatherData.current.weather_code) as any}
                  size={38}
                  color="#fff"
                />
              </View>
            </View>

            <View style={styles.mainBottomRow}>
              <View style={styles.infoPill}>
                <FontAwesome name="tint" size={14} color="#fff" />
                <Text style={styles.infoPillText}>
                  Humidity{" "}
                  {Math.round(weatherData.current.relative_humidity_2m)}%
                </Text>
              </View>
              <View style={styles.infoPill}>
                <FontAwesome name="flag-o" size={14} color="#fff" />
                <Text style={styles.infoPillText}>
                  Wind {Math.round(weatherData.current.wind_speed_10m)} km/h
                </Text>
              </View>
            </View>
          </LinearGradient>

          {/* Today summary */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Rain</Text>
              <Text style={styles.summaryValue}>
                {Math.round(weatherData.current.precipitation)} mm
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Wind</Text>
              <Text style={styles.summaryValue}>
                {Math.round(weatherData.current.wind_speed_10m)} km/h
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>UV Index</Text>
              <Text style={styles.summaryValue}>
                {Math.round(weatherData.daily.uv_index_max[0])} (Moderate)
              </Text>
            </View>
          </View>

          {/* Forecast list */}
          <View style={styles.forecastCard}>
            <Text style={styles.forecastTitle}>Next days</Text>
            {forecast.map((f, idx) => (
              <View
                key={f.day}
                style={[
                  styles.forecastRow,
                  idx !== 0 && styles.forecastRowDivider,
                ]}
              >
                <Text style={styles.forecastDay}>{f.day}</Text>
                <View style={styles.forecastRight}>
                  <FontAwesome
                    name={f.icon as any}
                    size={18}
                    color={colors.brandBlueLight}
                  />
                  <Text style={styles.forecastTemp}>{f.temp}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// Helper function to get weather icon based on WMO code
function getWeatherIcon(code: number): string {
  if (code === 0) return "sun-o";
  if (code <= 3) return "cloud";
  if (code <= 67) return "tint";
  if (code <= 77) return "asterisk";
  if (code <= 82) return "tint";
  if (code <= 86) return "asterisk";
  if (code >= 95) return "bolt";
  return "cloud";
}

// Helper function to get weather condition text
function getWeatherCondition(code: number): string {
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  if (code >= 95) return "Thunderstorm";
  return "Cloudy";
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.brandGrayText,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.brandGrayText,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.brandBlue,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.brandGrayBorder,
  },
  topBarTitle: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: "#000",
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    paddingHorizontal: 4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  locationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  locationText: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: "#000",
  },
  locationCoords: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.brandGrayText,
    marginTop: 2,
  },
  locationRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mainCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  mainTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mainTemp: {
    fontFamily: fonts.bold,
    fontSize: fontScale(52),
    color: "#fff",
  },
  mainCondition: {
    fontFamily: fonts.medium,
    fontSize: fontScale(18),
    color: "#E5E7EB",
  },
  mainDetail: {
    marginTop: 4,
    fontFamily: fonts.regular,
    fontSize: fontScale(13),
    color: "#E5E7EB",
  },
  mainIconCircle: {
    width: scale(72),
    height: scale(72),
    borderRadius: scale(36),
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  mainBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  infoPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    gap: 6,
  },
  infoPillText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: "#fff",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    paddingVertical: 8,
  },
  summaryLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.brandGrayText,
    marginBottom: 4,
  },
  summaryValue: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: "#000",
  },
  forecastCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.brandGrayBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  forecastTitle: {
    fontFamily: fonts.medium,
    fontSize: 15,
    marginBottom: 6,
    color: "#000",
  },
  forecastRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  forecastRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.brandGrayBorder,
  },
  forecastDay: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: "#000",
  },
  forecastRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  forecastTemp: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: "#000",
  },
});
