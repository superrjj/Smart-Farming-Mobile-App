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

// ── Config ────────────────────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get("window");

const API =
  (process.env.EXPO_PUBLIC_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:5000";

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

// ── Regions ───────────────────────────────────────────────────────────────────
const REGIONS = [
  { name: "Luzon", lat: 15.4802, lon: 120.5979, color: "#3B82F6" },
  { name: "Visayas", lat: 10.7202, lon: 122.5621, color: "#22C55E" },
  { name: "Mindanao", lat: 7.8731, lon: 124.9213, color: "#F97316" },
];

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

interface RegionMonthly {
  region: string;
  color: string;
  months: MonthData[];
}

// ── Data fetch ────────────────────────────────────────────────────────────────
const fetchRegionData = async (
  lat: number,
  lon: number,
  year: number,
): Promise<MonthData[]> => {
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

  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${start}&end_date=${endDay}&daily=temperature_2m_mean,relative_humidity_2m_mean,precipitation_sum&timezone=Asia%2FManila`;
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

// ── Mini Bar Chart ────────────────────────────────────────────────────────────
const MiniBarChart = ({
  data,
  regions,
  dataKey,
  height = 120,
}: {
  data: any[];
  regions: typeof REGIONS;
  dataKey: string;
  height?: number;
}) => {
  const BAR_W = 6;
  const GAP = 2;
  const GROUP_GAP = 8;
  const totalBars = data.length * (regions.length * (BAR_W + GAP) + GROUP_GAP);
  const maxVal = Math.max(
    ...data.flatMap((d) => regions.map((r) => d[r.name] ?? 0)),
    1,
  );

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View
        style={{
          width: Math.max(totalBars, SCREEN_W - 64),
          height: height + 24,
        }}
      >
        {/* Y grid lines */}
        {[0.25, 0.5, 0.75, 1].map((pct) => (
          <View
            key={pct}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: height * (1 - pct),
              height: 1,
              backgroundColor: "#F1F5F9",
            }}
          />
        ))}
        {/* Bars */}
        {data.map((d, di) => (
          <View
            key={di}
            style={{
              position: "absolute",
              bottom: 20,
              left: di * (regions.length * (BAR_W + GAP) + GROUP_GAP),
              flexDirection: "row",
              alignItems: "flex-end",
              gap: GAP,
            }}
          >
            {regions.map((r) => {
              const val = d[r.name] ?? 0;
              const barH = Math.max(2, (val / maxVal) * height);
              return (
                <View
                  key={r.name}
                  style={{
                    width: BAR_W,
                    height: barH,
                    backgroundColor: r.color,
                    borderRadius: 2,
                  }}
                />
              );
            })}
          </View>
        ))}
        {/* X labels */}
        {data.map((d, di) => (
          <Text
            key={di}
            style={{
              position: "absolute",
              bottom: 0,
              left: di * (regions.length * (BAR_W + GAP) + GROUP_GAP) - 4,
              fontSize: 9,
              color: colors.grayText,
              fontFamily: fonts.regular,
              width: 28,
              textAlign: "center",
            }}
          >
            {d.month}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
};

// ── Area Chart (simple SVG-like via Views) ────────────────────────────────────
const SimpleLineChart = ({
  data,
  lineKey,
  color,
  height = 100,
}: {
  data: { month: string; [key: string]: any }[];
  lineKey: string;
  color: string;
  height?: number;
}) => {
  const W = SCREEN_W - 80;
  const maxVal = Math.max(...data.map((d) => d[lineKey] ?? 0), 1);
  const pts = data.map((d, i) => ({
    x: (i / (data.length - 1)) * W,
    y: height - ((d[lineKey] ?? 0) / maxVal) * height,
  }));

  return (
    <View style={{ height, width: W }}>
      {pts.map((pt, i) => {
        if (i === 0) return null;
        const prev = pts[i - 1];
        const dx = pt.x - prev.x;
        const dy = pt.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left: prev.x,
              top: prev.y,
              width: len,
              height: 2,
              backgroundColor: color,
              transformOrigin: "left center",
              transform: [{ rotate: `${angle}deg` }],
            }}
          />
        );
      })}
      {pts.map((pt, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: pt.x - 3,
            top: pt.y - 3,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
};

// ── Progress Bar ──────────────────────────────────────────────────────────────
const ProgressBar = ({
  value,
  color,
  bg = "#F1F5F9",
}: {
  value: number;
  color: string;
  bg?: string;
}) => (
  <View
    style={{
      height: 6,
      backgroundColor: bg,
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

// ── Chart Tab ─────────────────────────────────────────────────────────────────
type ChartKey = "rainfall" | "moisture" | "scarcity" | "irrigation";

const CHART_TABS: { key: ChartKey; label: string; short: string }[] = [
  { key: "rainfall", label: "Rainfall (mm)", short: "Rain" },
  { key: "moisture", label: "Soil Moisture (%)", short: "Moisture" },
  { key: "scarcity", label: "Water Scarcity Index", short: "Scarcity" },
  { key: "irrigation", label: "Irrigation Need (mm)", short: "Irrigate" },
];

const CHART_NOTES: Record<ChartKey, string> = {
  rainfall:
    "💧 Mindanao receives consistent rainfall year-round. Luzon is driest in Feb–Apr.",
  moisture: "🌱 Soil moisture proxy derived from rainfall and temperature.",
  scarcity:
    "⚠️ Higher index = more scarce. Luzon faces highest scarcity in Mar–Apr.",
  irrigation:
    "💦 Irrigation need = deficit from the 100mm/month requirement. Plan reserves.",
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function SeasonalSummaryScreen() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [regionData, setRegionData] = useState<RegionMonthly[]>([]);
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
  const visibleMonthCount = isCurrentYear ? currentMonth + 1 : 12;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      fadeAnim.setValue(0);
      try {
        const results = await Promise.all(
          REGIONS.map((r) => fetchRegionData(r.lat, r.lon, selectedYear)),
        );
        setRegionData(
          REGIONS.map((r, i) => ({
            region: r.name,
            color: r.color,
            months: results[i],
          })),
        );
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

  const luzon = regionData.find((r) => r.region === "Luzon");
  const mindanao = regionData.find((r) => r.region === "Mindanao");
  const visibleLuzonMonths = luzon?.months.slice(0, visibleMonthCount) ?? [];

  const luzonAvgScarcity = visibleLuzonMonths.length
    ? Math.round(
        visibleLuzonMonths
          .filter((m) => m.scarcityIndex > 0)
          .reduce((s, m) => s + m.scarcityIndex, 0) /
          (visibleLuzonMonths.filter((m) => m.scarcityIndex > 0).length || 1),
      )
    : 0;
  const luzonDryMonths = visibleLuzonMonths.filter(
    (m) => m.scarcityIndex > 60,
  ).length;
  const luzonPeakIrrigation = visibleLuzonMonths
    .filter((m) => m.irrigationNeed > 0)
    .reduce<MonthData | null>(
      (a, b) => (!a || b.irrigationNeed > a.irrigationNeed ? b : a),
      null,
    );

  const chartData = MONTH_LABELS.slice(0, visibleMonthCount).map((month, i) => {
    const row: any = { month };
    regionData.forEach((r) => {
      const m = r.months[i];
      if (!m || (isCurrentYear && i > currentMonth)) return;
      if (activeChart === "rainfall") row[r.region] = m.rainfall;
      if (activeChart === "moisture") row[r.region] = m.soilMoistureProxy;
      if (activeChart === "scarcity") row[r.region] = m.scarcityIndex;
      if (activeChart === "irrigation") row[r.region] = m.irrigationNeed;
    });
    return row;
  });

  const scarcityColor =
    luzonAvgScarcity > 50
      ? colors.red
      : luzonAvgScarcity > 30
        ? colors.amber
        : colors.primary;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <FontAwesome name="chevron-left" size={16} color={colors.dark} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Seasonal Summary</Text>
          <Text style={styles.headerSub}>Philippine Regional Climate</Text>
        </View>
        {/* Year picker */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.yearScroll}
          contentContainerStyle={styles.yearScrollContent}
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
                  selectedYear === y && styles.yearChipTextActive,
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
          <Text style={styles.loaderText}>Fetching climate data…</Text>
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
              <FontAwesome name="info-circle" size={13} color="#3B82F6" />
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
            style={styles.statsScroll}
            contentContainerStyle={styles.statsScrollContent}
          >
            <StatCard
              icon="warning"
              iconColor={scarcityColor}
              label="Luzon Scarcity"
              value={`${luzonAvgScarcity}/100`}
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
              value={`${luzonDryMonths}`}
              sub="Scarcity >60"
            />
            <StatCard
              icon="tint"
              iconColor={colors.blue}
              label="Peak Irrigation"
              value={
                luzonPeakIrrigation
                  ? `${luzonPeakIrrigation.irrigationNeed}mm`
                  : "—"
              }
              sub={luzonPeakIrrigation?.month ?? "—"}
            />
            <StatCard
              icon="cloud"
              iconColor="#6366F1"
              label="Typhoon Season"
              value="Jun–Nov"
              sub="Affects Luzon most"
            />
          </ScrollView>

          {/* Regional Chart Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Regional Comparison — {selectedYear}
            </Text>
            <Text style={styles.cardSub}>
              Luzon · Visayas · Mindanao — Open-Meteo data
            </Text>

            {/* Region legend */}
            <View style={styles.legend}>
              {REGIONS.map((r) => (
                <View key={r.name} style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: r.color }]}
                  />
                  <Text style={styles.legendText}>{r.name}</Text>
                </View>
              ))}
            </View>

            {/* Chart tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabScroll}
              contentContainerStyle={styles.tabScrollContent}
            >
              {CHART_TABS.map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setActiveChart(tab.key)}
                  style={[
                    styles.tab,
                    activeChart === tab.key && styles.tabActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      activeChart === tab.key && styles.tabTextActive,
                    ]}
                  >
                    {tab.short}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <MiniBarChart
              data={chartData}
              regions={REGIONS}
              dataKey={activeChart}
              height={130}
            />

            <View style={styles.chartNote}>
              <Text style={styles.chartNoteText}>
                {CHART_NOTES[activeChart]}
              </Text>
            </View>
          </View>

          {/* Mindanao → Luzon Impact */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Mindanao → Luzon Impact</Text>
            <Text style={styles.cardSub}>
              Typhoon paths affect Luzon rainfall 3–7 days later
            </Text>

            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: colors.blue }]}
                />
                <Text style={styles.legendText}>Luzon Rainfall</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: colors.orange }]}
                />
                <Text style={styles.legendText}>Mindanao Rainfall</Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <SimpleLineChart
                data={MONTH_LABELS.slice(0, visibleMonthCount).map(
                  (month, i) => ({
                    month,
                    val: luzon?.months[i].rainfall ?? 0,
                  }),
                )}
                lineKey="val"
                color={colors.blue}
                height={90}
              />
            </View>

            <View style={styles.impactGrid}>
              {[
                {
                  emoji: "🌀",
                  title: "Typhoon Season (Jun–Nov)",
                  text: "Typhoons from Pacific intensify near Mindanao before hitting Luzon.",
                  bg: "#EEF2FF",
                  border: "#C7D2FE",
                  titleColor: "#4338CA",
                },
                {
                  emoji: "💧",
                  title: "Water Scarcity Lag Effect",
                  text: "Mindanao drought shifts ITCZ, reducing Luzon rainfall 2–4 weeks later.",
                  bg: "#FFFBEB",
                  border: "#FDE68A",
                  titleColor: "#92400E",
                },
                {
                  emoji: "🌱",
                  title: "String Bean Implication",
                  text: "Luzon dry season (Feb–Apr): pre-plan irrigation reserves for March.",
                  bg: "#F0FDF4",
                  border: "#BBF7D0",
                  titleColor: "#166534",
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

          {/* Monthly Scarcity Table — Luzon */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Monthly Water Scarcity — Luzon {selectedYear}
            </Text>
            {isCurrentYear && (
              <Text style={styles.cardSub}>
                Jan–{MONTH_LABELS[currentMonth]} only
              </Text>
            )}

            {/* Table header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Month</Text>
              <Text
                style={[
                  styles.tableHeaderCell,
                  { flex: 1.2, textAlign: "right" },
                ]}
              >
                Rain mm
              </Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>
                Scarcity
              </Text>
              <Text
                style={[
                  styles.tableHeaderCell,
                  { flex: 1.2, textAlign: "right" },
                ]}
              >
                Irrigate
              </Text>
              <Text
                style={[
                  styles.tableHeaderCell,
                  { flex: 0.8, textAlign: "center" },
                ]}
              >
                Status
              </Text>
            </View>

            {visibleLuzonMonths.map((m, i) => {
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
                    isCurrentMonthRow && styles.tableRowHighlight,
                    i % 2 === 1 && styles.tableRowAlt,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tableCell}>{m.month}</Text>
                    {isCurrentMonthRow && (
                      <Text style={styles.currentTag}>now</Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.tableCell,
                      { flex: 1.2, textAlign: "right" },
                    ]}
                  >
                    {m.rainfall > 0 ? m.rainfall : "—"}
                  </Text>
                  <View
                    style={{
                      flex: 2,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <ProgressBar value={m.scarcityIndex} color={scColor} />
                    <Text
                      style={[
                        styles.tableCellSmall,
                        { color: scColor, width: 22, textAlign: "right" },
                      ]}
                    >
                      {m.scarcityIndex || "—"}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.tableCell,
                      { flex: 1.2, textAlign: "right", color: colors.blue },
                    ]}
                  >
                    {m.irrigationNeed > 0 ? `+${m.irrigationNeed}` : "—"}
                  </Text>
                  <View style={{ flex: 0.8, alignItems: "center" }}>
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

          {/* Soil Moisture Breakdown */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Soil Moisture by Region</Text>
            <Text style={styles.cardSub}>
              Derived from rainfall and temperature data
            </Text>
            <View style={{ gap: 12, marginTop: 8 }}>
              {regionData.map((r) => {
                const visible = r.months
                  .slice(0, visibleMonthCount)
                  .filter((m) => m.soilMoistureProxy > 0);
                const avg = visible.length
                  ? Math.round(
                      visible.reduce((s, m) => s + m.soilMoistureProxy, 0) /
                        visible.length,
                    )
                  : 0;
                const peak = visible.reduce<MonthData | null>(
                  (a, b) =>
                    !a || b.soilMoistureProxy > a.soilMoistureProxy ? b : a,
                  null,
                );
                const low = visible.reduce<MonthData | null>(
                  (a, b) =>
                    !a || b.soilMoistureProxy < a.soilMoistureProxy ? b : a,
                  null,
                );
                return (
                  <View key={r.region} style={styles.regionMoistureRow}>
                    <View
                      style={[styles.regionDot, { backgroundColor: r.color }]}
                    />
                    <View style={{ flex: 1 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          marginBottom: 4,
                        }}
                      >
                        <Text style={styles.regionName}>{r.region}</Text>
                        <Text style={[styles.regionAvg, { color: r.color }]}>
                          {avg}% avg
                        </Text>
                      </View>
                      <ProgressBar value={avg} color={r.color} />
                      <View
                        style={{ flexDirection: "row", gap: 12, marginTop: 4 }}
                      >
                        <Text style={styles.regionMeta}>
                          Peak: {peak?.month ?? "—"} (
                          {peak?.soilMoistureProxy ?? 0}%)
                        </Text>
                        <Text style={styles.regionMeta}>
                          Low: {low?.month ?? "—"} (
                          {low?.soilMoistureProxy ?? 0}%)
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
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

  // Header
  header: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayBorder,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  backButton: { padding: 6, alignSelf: "flex-start" },
  headerCenter: { marginTop: 2, marginBottom: 8 },
  headerTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.dark },
  headerSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.grayText,
    marginTop: 1,
  },
  yearScroll: { marginHorizontal: -4 },
  yearScrollContent: { flexDirection: "row", gap: 6, paddingHorizontal: 4 },
  yearChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.grayBorder,
    backgroundColor: colors.surface,
  },
  yearChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  yearChipText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.grayText,
  },
  yearChipTextActive: { color: colors.white },

  // Loader
  loader: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loaderText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.grayText,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 14 },

  // Notice
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

  // Stat cards
  statsScroll: { marginHorizontal: -16 },
  statsScrollContent: { paddingHorizontal: 16, gap: 10 },
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

  // Cards
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

  // Legend
  legend: { flexDirection: "row", gap: 12, marginBottom: 12, flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.grayText,
  },

  // Tabs
  tabScroll: { marginHorizontal: -4, marginBottom: 12 },
  tabScrollContent: { flexDirection: "row", gap: 6, paddingHorizontal: 4 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontFamily: fonts.medium, fontSize: 12, color: colors.grayText },
  tabTextActive: { color: colors.white },

  // Chart note
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

  // Impact grid
  impactGrid: { gap: 8, marginTop: 12 },
  impactCard: { borderRadius: 10, borderWidth: 1, padding: 10 },
  impactEmoji: { fontSize: 16, marginBottom: 4 },
  impactTitle: { fontFamily: fonts.semibold, fontSize: 12, marginBottom: 3 },
  impactText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: "#64748B",
    lineHeight: 16,
  },

  // Table
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

  // Badge
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 9 },

  // Region moisture
  regionMoistureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  regionDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  regionName: { fontFamily: fonts.semibold, fontSize: 12, color: colors.dark },
  regionAvg: { fontFamily: fonts.semibold, fontSize: 12 },
  regionMeta: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.grayText,
  },
});
