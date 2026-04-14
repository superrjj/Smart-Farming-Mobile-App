import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_W } = Dimensions.get("window");

const LOCATION = { name: "Tarlac Province", lat: 15.4755, lon: 120.5963 };

const colors = {
  primary: "#22C55E",
  primaryDark: "#16A34A",
  blue: "#3B82F6",
  orange: "#F97316",
  amber: "#F59E0B",
  red: "#EF4444",
  grayText: "#94A3B8",
  grayBorder: "#E2E8F0",
  dark: "#0F172A",
  white: "#FFFFFF",
  surface: "#F8FAFC",
  cardBg: "#FFFFFF",
};

const fonts = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semibold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
};

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const TYPHOON_MONTHS = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];

// ── Derivation helpers ────────────────────────────────────────────────────────
const deriveSoilMoisture = (rainfall: number, temp: number) =>
  Math.max(
    10,
    Math.round(
      Math.min(100, (rainfall / 150) * 100) - Math.max(0, (temp - 28) * 2),
    ),
  );

const deriveScarcity = (rainfall: number, temp: number) =>
  Math.min(
    100,
    Math.round(
      (Math.max(0, 100 - rainfall / 2) + Math.max(0, (temp - 24) * 5)) / 2,
    ),
  );

const deriveIrrigationNeed = (rainfall: number) =>
  Math.max(0, Math.round(100 - rainfall));

// ── Types ─────────────────────────────────────────────────────────────────────
interface MonthData {
  month: string;
  rainfall: number;
  avgTemp: number;
  avgHumidity: number;
  soilMoistureProxy: number;
  scarcityIndex: number;
  irrigationNeed: number;
}

// ── Data fetch ────────────────────────────────────────────────────────────────
const fetchLocationData = async (year: number): Promise<MonthData[]> => {
  const now = new Date();
  const isCurrentYear = year === now.getFullYear();
  const endDay = isCurrentYear
    ? new Date(now.getTime() - 86400000).toISOString().split("T")[0]
    : `${year}-12-31`;
  const start = `${year}-01-01`;
  if (start > endDay)
    return MONTH_LABELS.map((month) => ({
      month,
      rainfall: 0,
      avgTemp: 0,
      avgHumidity: 0,
      soilMoistureProxy: 0,
      scarcityIndex: 0,
      irrigationNeed: 0,
    }));

  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${LOCATION.lat}&longitude=${LOCATION.lon}&start_date=${start}&end_date=${endDay}&daily=temperature_2m_mean,relative_humidity_2m_mean,precipitation_sum&timezone=Asia%2FManila`;
  const res = await fetch(url);
  const json = await res.json();
  const {
    time,
    temperature_2m_mean,
    relative_humidity_2m_mean,
    precipitation_sum,
  } = json.daily;

  const grouped: Record<
    number,
    { temps: number[]; hums: number[]; rains: number[] }
  > = {};
  time.forEach((dateStr: string, i: number) => {
    const m = new Date(dateStr).getMonth();
    if (!grouped[m]) grouped[m] = { temps: [], hums: [], rains: [] };
    if (temperature_2m_mean[i] != null)
      grouped[m].temps.push(temperature_2m_mean[i]);
    if (relative_humidity_2m_mean[i] != null)
      grouped[m].hums.push(relative_humidity_2m_mean[i]);
    if (precipitation_sum[i] != null)
      grouped[m].rains.push(precipitation_sum[i]);
  });

  const currentMonth = isCurrentYear ? now.getMonth() : 11;
  return MONTH_LABELS.map((month, i) => {
    if (isCurrentYear && i > currentMonth)
      return {
        month,
        rainfall: 0,
        avgTemp: 0,
        avgHumidity: 0,
        soilMoistureProxy: 0,
        scarcityIndex: 0,
        irrigationNeed: 0,
      };
    const g = grouped[i] ?? { temps: [], hums: [], rains: [] };
    const avg = (arr: number[]) =>
      arr.length
        ? Math.round((arr.reduce((a, b) => a + b) / arr.length) * 10) / 10
        : 0;
    const sum = (arr: number[]) =>
      Math.round(arr.reduce((a, b) => a + b, 0) * 10) / 10;
    const rainfall = sum(g.rains);
    const avgTemp = avg(g.temps);
    const avgHumidity = avg(g.hums);
    return {
      month,
      rainfall,
      avgTemp,
      avgHumidity,
      soilMoistureProxy: deriveSoilMoisture(rainfall, avgTemp),
      scarcityIndex: deriveScarcity(rainfall, avgTemp),
      irrigationNeed: deriveIrrigationNeed(rainfall),
    };
  });
};

// ── Progress Bar ──────────────────────────────────────────────────────────────
const ProgressBar = ({ value, color }: { value: number; color: string }) => (
  <View
    style={{
      height: 6,
      backgroundColor: "#F1F5F9",
      borderRadius: 3,
      overflow: "hidden",
      flex: 1,
    }}
  >
    <View
      style={{
        height: "100%",
        width: `${Math.min(100, value)}%`,
        backgroundColor: color,
        borderRadius: 3,
      }}
    />
  </View>
);

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({
  icon,
  iconColor,
  label,
  value,
  sub,
}: {
  icon: string;
  iconColor: string;
  label: string;
  value: string;
  sub: string;
}) => (
  <View style={styles.statCard}>
    <View style={[styles.statIcon, { backgroundColor: iconColor + "20" }]}>
      <FontAwesome name={icon as any} size={14} color={iconColor} />
    </View>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statSub}>{sub}</Text>
  </View>
);

// ── Chart types ───────────────────────────────────────────────────────────────
type ChartKey =
  | "rainfall"
  | "moisture"
  | "scarcity"
  | "irrigation"
  | "temp"
  | "humidity";

const CHART_TABS: { key: ChartKey; label: string }[] = [
  { key: "rainfall", label: "Rainfall" },
  { key: "moisture", label: "Moisture" },
  { key: "temp", label: "Temp" },
  { key: "humidity", label: "Humidity" },
  { key: "scarcity", label: "Scarcity" },
  { key: "irrigation", label: "Irrigate" },
];

// ── Bar Chart ─────────────────────────────────────────────────────────────────
const BarChart = ({
  data,
  color,
  height = 130,
}: {
  data: { month: string; value: number }[];
  color: string;
  height?: number;
}) => {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const BAR_W = Math.max(20, (SCREEN_W - 64) / data.length - 4);
  const Y_LABEL_W = 32;
  return (
    <View style={{ flexDirection: "row" }}>
      {/* Fixed Y-axis labels on the LEFT */}
      <View
        style={{
          width: Y_LABEL_W,
          height: height + 28,
          position: "relative",
        }}
      >
        {[0.25, 0.5, 0.75, 1].map((pct) => (
          <Text
            key={pct}
            style={{
              position: "absolute",
              left: 0,
              top: height * (1 - pct) - 7,
              fontSize: 8,
              color: colors.grayText,
              fontFamily: fonts.regular,
              textAlign: "left",
            }}
          >
            {Math.round(maxVal * pct)}
          </Text>
        ))}
      </View>
      {/* Scrollable bars area */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
        <View
          style={{
            width: Math.max(SCREEN_W - 64 - Y_LABEL_W, data.length * (BAR_W + 4)),
            height: height + 28,
          }}
        >
          {[0.25, 0.5, 0.75, 1].map((pct) => (
            <View
              key={pct}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: height * (1 - pct),
                height: 1,
                backgroundColor: "#E2E8F0",
              }}
            />
          ))}
          {data.map((d, i) => {
            const barH = Math.max(2, (d.value / maxVal) * height);
            const isTyphoon = TYPHOON_MONTHS.includes(d.month);
            return (
              <View
                key={i}
                style={{
                  position: "absolute",
                  bottom: 20,
                  left: i * (BAR_W + 4),
                  width: BAR_W,
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    width: BAR_W,
                    height: barH,
                    backgroundColor: isTyphoon ? colors.orange : color,
                    borderRadius: 4,
                    opacity: 0.85,
                  }}
                />
              </View>
            );
          })}
          {data.map((d, i) => (
            <Text
              key={i}
              style={{
                position: "absolute",
                bottom: 0,
                left: i * (BAR_W + 4),
                width: BAR_W,
                textAlign: "center",
                fontSize: 9,
                color: TYPHOON_MONTHS.includes(d.month)
                  ? colors.orange
                  : colors.grayText,
                fontFamily: fonts.regular,
              }}
            >
              {d.month}
            </Text>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function SeasonalSummaryScreen() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [months, setMonths] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChart, setActiveChart] = useState<ChartKey>("rainfall");
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const yearOptions = [
    currentYear,
    currentYear - 1,
    currentYear - 2,
    currentYear - 3,
  ];
  const isCurrentYear = selectedYear === currentYear;
  const visibleCount = isCurrentYear ? currentMonth + 1 : 12;
  const visibleMonths = months.slice(0, visibleCount);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      fadeAnim.setValue(0);
      try {
        const data = await fetchLocationData(selectedYear);
        setMonths(data);
      } catch (e) {
        console.error("Failed to load seasonal data", e);
      } finally {
        setLoading(false);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }
    };
    load();
  }, [selectedYear]);

  const activeData = visibleMonths.map((m) => ({
    month: m.month,
    value:
      activeChart === "rainfall"
        ? m.rainfall
        : activeChart === "moisture"
          ? m.soilMoistureProxy
          : activeChart === "scarcity"
            ? m.scarcityIndex
            : activeChart === "irrigation"
              ? m.irrigationNeed
              : activeChart === "temp"
                ? m.avgTemp
                : m.avgHumidity,
  }));

  const activeColor =
    activeChart === "rainfall"
      ? colors.blue
      : activeChart === "moisture"
        ? colors.primary
        : activeChart === "scarcity"
          ? colors.red
          : activeChart === "irrigation"
            ? colors.blue
            : activeChart === "temp"
              ? colors.orange
              : "#06B6D4";

  const validMonths = visibleMonths.filter((m) => m.scarcityIndex > 0);
  const avgScarcity = validMonths.length
    ? Math.round(
        validMonths.reduce((s, m) => s + m.scarcityIndex, 0) /
          validMonths.length,
      )
    : 0;
  const dryMonths = visibleMonths.filter((m) => m.scarcityIndex > 60).length;
  const peakIrrigation = visibleMonths
    .filter((m) => m.irrigationNeed > 0)
    .reduce<MonthData | null>(
      (a, b) => (!a || b.irrigationNeed > a.irrigationNeed ? b : a),
      null,
    );
  const avgTemp = visibleMonths.filter((m) => m.avgTemp > 0).length
    ? Math.round(
        (visibleMonths
          .filter((m) => m.avgTemp > 0)
          .reduce((s, m) => s + m.avgTemp, 0) /
          visibleMonths.filter((m) => m.avgTemp > 0).length) *
          10,
      ) / 10
    : 0;

  const scarcityColor =
    avgScarcity > 50
      ? colors.red
      : avgScarcity > 30
        ? colors.amber
        : colors.primary;

  const chartNote: Record<ChartKey, string> = {
    rainfall:
      "🌧️ Orange bars indicate typhoon-season months (Jun–Nov). Tarlac is driest Feb–Apr.",
    moisture:
      "🌱 Estimated soil moisture from rainfall and temperature. Higher = wetter soil.",
    scarcity:
      "⚠️ Higher = more water scarce. Tarlac faces highest scarcity in Mar–Apr.",
    irrigation:
      "💦 Estimated supplemental water needed beyond natural rainfall (mm/month).",
    temp: "🌡️ Average daily temperature. String beans prefer 18–30°C for optimal growth.",
    humidity:
      "💧 Average relative humidity. Ideal range for string beans is 55–75%.",
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <FontAwesome name="chevron-left" size={16} color={colors.dark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Seasonal Summary</Text>
        </View>
      </View>

      {/* Year chips — location above chips, no bottom divider */}
      <View style={styles.yearBar}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            marginBottom: 8,
          }}
        >
          <FontAwesome name="map-marker" size={11} color={colors.blue} />
          <Text style={styles.headerSub}>{LOCATION.name}</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.yearRow}
        >
          {yearOptions.map((y) => (
            <TouchableOpacity
              key={y}
              onPress={() => setSelectedYear(y)}
              style={[
                styles.yearChip,
                selectedYear === y && styles.yearChipActive,
              ]}
            >
              <Text
                style={[
                  styles.yearChipText,
                  selectedYear === y && { color: colors.white },
                ]}
              >
                {y}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>
            Fetching {selectedYear} climate data…
          </Text>
        </View>
      ) : (
        <Animated.ScrollView
          style={[styles.scroll, { opacity: fadeAnim }]}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Current year notice */}
          {isCurrentYear && (
            <View style={styles.noticeBanner}>
              <FontAwesome name="info-circle" size={13} color={colors.blue} />
              <Text style={styles.noticeText}>
                Showing {currentYear} data — {MONTH_LABELS[currentMonth]} is the
                most recent complete month.
              </Text>
            </View>
          )}

          {/* Stat Cards */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10 }}
          >
            <StatCard
              icon="warning"
              iconColor={scarcityColor}
              label="Water Scarcity"
              value={`${avgScarcity}/100`}
              sub={
                isCurrentYear
                  ? `Jan–${MONTH_LABELS[currentMonth]} avg`
                  : "Annual avg"
              }
            />
            <StatCard
              icon="sun-o"
              iconColor={colors.orange}
              label="Dry Months"
              value={`${dryMonths}`}
              sub="Scarcity >60"
            />
            <StatCard
              icon="tint"
              iconColor={colors.blue}
              label="Peak Irrigation"
              value={
                peakIrrigation ? `${peakIrrigation.irrigationNeed}mm` : "—"
              }
              sub={peakIrrigation?.month ?? "—"}
            />
            <StatCard
              icon="thermometer"
              iconColor={colors.orange}
              label="Avg Temp"
              value={`${avgTemp}°C`}
              sub={
                isCurrentYear
                  ? `Jan–${MONTH_LABELS[currentMonth]}`
                  : "Annual avg"
              }
            />
          </ScrollView>

          {/* Main Chart Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Monthly Climate — {selectedYear}
            </Text>
            <Text style={styles.cardSub}>
              {LOCATION.name} · Open-Meteo archive data
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, marginBottom: 12 }}
            >
              {CHART_TABS.map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setActiveChart(tab.key)}
                  style={[
                    styles.tab,
                    activeChart === tab.key && { backgroundColor: activeColor },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      activeChart === tab.key && { color: colors.white },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <BarChart data={activeData} color={activeColor} height={130} />
            {activeChart === "rainfall" && (
              <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      backgroundColor: colors.blue,
                    }}
                  />
                  <Text style={styles.legendText}>Normal</Text>
                </View>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      backgroundColor: colors.orange,
                    }}
                  />
                  <Text style={styles.legendText}>Typhoon season</Text>
                </View>
              </View>
            )}
            <View style={styles.chartNote}>
              <Text style={styles.chartNoteText}>{chartNote[activeChart]}</Text>
            </View>
          </View>

          {/* Monthly Water Scarcity Table */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Monthly Water Scarcity — {selectedYear}
            </Text>
            {isCurrentYear && (
              <Text style={styles.cardSub}>
                Jan–{MONTH_LABELS[currentMonth]} only
              </Text>
            )}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Month</Text>
              <Text
                style={[
                  styles.tableHeaderCell,
                  { flex: 1.5, textAlign: "right" },
                ]}
              >
                Rain{"\n"}& Scarcity
              </Text>
              <Text
                style={[
                  styles.tableHeaderCell,
                  { flex: 1.5, textAlign: "right" },
                ]}
              >
                Irrigate
              </Text>
              <Text
                style={[
                  styles.tableHeaderCell,
                  { flex: 1, textAlign: "center" },
                ]}
              >
                Status
              </Text>
            </View>
            {visibleMonths.map((m, i) => {
              const scLevel =
                m.scarcityIndex > 60
                  ? "High"
                  : m.scarcityIndex > 30
                    ? "Med"
                    : "Low";
              const scColor =
                m.scarcityIndex > 60
                  ? colors.red
                  : m.scarcityIndex > 30
                    ? colors.amber
                    : colors.primary;
              const isCurrentMonthRow = isCurrentYear && i === currentMonth;
              return (
                <View
                  key={i}
                  style={[
                    styles.tableRow,
                    i % 2 === 1 && styles.tableRowAlt,
                    isCurrentMonthRow && styles.tableRowHighlight,
                  ]}
                >
                  {/* Month */}
                  <View style={{ flex: 1.2 }}>
                    <Text style={styles.tableCell}>{m.month}</Text>
                    {isCurrentMonthRow && (
                      <Text style={styles.currentTag}>now</Text>
                    )}
                  </View>
                  {/* Rain mm + scarcity bar in one column */}
                  <View style={{ flex: 1.5, paddingRight: 4 }}>
                    <Text
                      style={[
                        styles.tableCellSmall,
                        { color: colors.grayText, marginBottom: 2 },
                      ]}
                    >
                      {m.rainfall > 0 ? `${m.rainfall}mm` : "—"}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <ProgressBar value={m.scarcityIndex} color={scColor} />
                      <Text
                        style={[
                          styles.tableCellSmall,
                          { color: scColor, minWidth: 20, textAlign: "right" },
                        ]}
                      >
                        {m.scarcityIndex || "—"}
                      </Text>
                    </View>
                  </View>
                  {/* Irrigate */}
                  <Text
                    style={[
                      styles.tableCell,
                      { flex: 1.5, textAlign: "right", color: colors.blue },
                    ]}
                  >
                    {m.irrigationNeed > 0 ? `+${m.irrigationNeed}` : "—"}
                  </Text>
                  {/* Status badge */}
                  <View style={{ flex: 1, alignItems: "center" }}>
                    {m.scarcityIndex > 0 ? (
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: scColor + "20" },
                        ]}
                      >
                        <Text style={[styles.badgeText, { color: scColor }]}>
                          {scLevel}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.tableDash}>—</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Soil Moisture Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Soil Moisture — {selectedYear}</Text>
            <Text style={styles.cardSub}>
              Estimated from rainfall and temperature
            </Text>
            <View style={{ gap: 10, marginTop: 4 }}>
              {visibleMonths
                .filter((m) => m.soilMoistureProxy > 0)
                .map((m, i) => {
                  const moistureColor =
                    m.soilMoistureProxy >= 60
                      ? colors.primary
                      : m.soilMoistureProxy >= 40
                        ? colors.amber
                        : colors.red;
                  return (
                    <View key={i} style={{ gap: 4 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                        }}
                      >
                        <Text style={styles.tableCell}>{m.month}</Text>
                        <Text
                          style={[styles.tableCell, { color: moistureColor }]}
                        >
                          {m.soilMoistureProxy}%
                        </Text>
                      </View>
                      <ProgressBar
                        value={m.soilMoistureProxy}
                        color={moistureColor}
                      />
                    </View>
                  );
                })}
            </View>
          </View>

          {/* Farming Tips Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Farming Tips for Tarlac</Text>
            <Text style={styles.cardSub}>String bean cultivation guidance</Text>
            <View style={{ gap: 8 }}>
              {[
                {
                  emoji: "🌱",
                  title: "Best Planting Months",
                  text: "Oct–Dec and Feb–Apr offer the most stable conditions. Avoid peak typhoon months (Aug–Sep).",
                  bg: "#F0FDF4",
                  border: "#BBF7D0",
                  titleColor: "#166534",
                },
                {
                  emoji: "💧",
                  title: "Dry Season Preparation (Feb–Apr)",
                  text: "Pre-plan irrigation reserves. Target 20–25mm/week. Use mulching to retain soil moisture.",
                  bg: "#FFFBEB",
                  border: "#FDE68A",
                  titleColor: "#92400E",
                },
                {
                  emoji: "🌀",
                  title: "Typhoon Season (Jun–Nov)",
                  text: "Use raised beds and clear drainage channels. Avoid planting Aug–Sep when typhoon risk is highest.",
                  bg: "#EEF2FF",
                  border: "#C7D2FE",
                  titleColor: "#4338CA",
                },
                {
                  emoji: "🌡️",
                  title: "Heat Stress Management",
                  text: "Tarlac summers can exceed 35°C. Use early morning irrigation and shade netting in April–May.",
                  bg: "#FEF2F2",
                  border: "#FCA5A5",
                  titleColor: "#991B1B",
                },
              ].map((item) => (
                <View
                  key={item.title}
                  style={[
                    styles.impactCard,
                    { backgroundColor: item.bg, borderColor: item.border },
                  ]}
                >
                  <Text style={styles.impactEmoji}>{item.emoji}</Text>
                  <Text
                    style={[styles.impactTitle, { color: item.titleColor }]}
                  >
                    {item.title}
                  </Text>
                  <Text style={styles.impactText}>{item.text}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={{ height: 32 }} />
        </Animated.ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  header: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayBorder,
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  backButton: { padding: 6 },
  headerTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.dark },
  headerSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.grayText,
    marginTop: 1,
  },
  yearBar: {
    backgroundColor: colors.white,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  yearRow: { flexDirection: "row", gap: 8 },
  yearChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  yearChipActive: { backgroundColor: colors.primary },
  yearChipText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.grayText,
  },
  loader: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loaderText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.grayText,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 14 },
  noticeBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 10,
    padding: 10,
  },
  noticeText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: "#1D4ED8",
    flex: 1,
    lineHeight: 18,
  },
  statCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 14,
    width: 120,
    borderWidth: 1,
    borderColor: colors.grayBorder,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statLabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.grayText,
    marginBottom: 4,
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.dark,
    marginBottom: 2,
  },
  statSub: { fontFamily: fonts.regular, fontSize: 10, color: colors.grayText },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.grayBorder,
  },
  cardTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.dark,
    marginBottom: 2,
  },
  cardSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.grayText,
    marginBottom: 12,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
  },
  tabText: { fontFamily: fonts.medium, fontSize: 12, color: colors.grayText },
  legendText: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.grayText,
  },
  chartNote: {
    marginTop: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    padding: 10,
  },
  chartNoteText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: "#64748B",
    lineHeight: 16,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#0F172A",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 4,
  },
  tableHeaderCell: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    color: colors.white,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
  },
  tableRowAlt: { backgroundColor: "#F8FAFC" },
  tableRowHighlight: { backgroundColor: "#EFF6FF" },
  tableCell: { fontFamily: fonts.medium, fontSize: 12, color: colors.dark },
  tableCellSmall: { fontFamily: fonts.medium, fontSize: 11 },
  tableDash: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.grayText,
  },
  currentTag: { fontFamily: fonts.regular, fontSize: 9, color: colors.blue },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 9 },
  impactCard: { borderRadius: 10, borderWidth: 1, padding: 10 },
  impactEmoji: { fontSize: 16, marginBottom: 4 },
  impactTitle: { fontFamily: fonts.semibold, fontSize: 12, marginBottom: 3 },
  impactText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: "#64748B",
    lineHeight: 16,
  },
});
