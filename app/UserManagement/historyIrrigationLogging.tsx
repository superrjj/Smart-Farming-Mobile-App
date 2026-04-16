import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const colors = {
  primary: "#22C55E",
  primaryDark: "#16A34A",
  primaryLight: "#BBF7D0",
  brandBlue: "#3B82F6",
  brandBlueLight: "#DBEAFE",
  grayText: "#94A3B8",
  grayBorder: "#E2E8F0",
  grayLight: "#F8FAFC",
  dark: "#0F172A",
  white: "#FFFFFF",
  warning: "#F59E0B",
  warningLight: "#FEF3C7",
  humidityLight: "#DCFCE7",
};

const fonts = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semibold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
};

const LOCATION = { lat: 15.4755, lon: 120.5963 };

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

type MonthReport = {
  month: string;
  rainfall: number;
  avgTemp: number;
  avgHumidity: number;
  irrigationNeed: number;
  scarcityIndex: number;
};

type MockWaterLog = {
  id: string;
  title: string;
  duration: string;
  volume: string;
  moistureChange: string;
  triggerType: string;
};

const MOCK_WATER_LOGS: MockWaterLog[] = [
  {
    id: "mk-1",
    title: "April 7, 2026 - 3:55:39 PM",
    duration: "1m 45s",
    volume: "24.5 L",
    moistureChange: "38.2% -> 61.8%",
    triggerType: "Automatic",
  },
  {
    id: "mk-2",
    title: "April 7, 2026 - 2:29:20 PM",
    duration: "43s",
    volume: "10.8 L",
    moistureChange: "42.4% -> 55.1%",
    triggerType: "Manual",
  },
  {
    id: "mk-3",
    title: "April 6, 2026 - 9:56:25 PM",
    duration: "16m 12s",
    volume: "32.0 L",
    moistureChange: "35.0% -> 67.3%",
    triggerType: "Automatic",
  },
];

const deriveScarcity = (rainfall: number, temp: number) =>
  Math.min(
    100,
    Math.round(
      (Math.max(0, 100 - rainfall / 2) + Math.max(0, (temp - 24) * 5)) / 2,
    ),
  );

const deriveIrrigationNeed = (rainfall: number) =>
  Math.max(0, Math.round(100 - rainfall));

const fetchIrrigationReportData = async (year: number): Promise<MonthReport[]> => {
  const now = new Date();
  const isCurrentYear = year === now.getFullYear();
  const endDay = isCurrentYear
    ? new Date(now.getTime() - 86400000).toISOString().split("T")[0]
    : `${year}-12-31`;
  const start = `${year}-01-01`;

  if (start > endDay) {
    return MONTH_LABELS.map((month) => ({
      month,
      rainfall: 0,
      avgTemp: 0,
      avgHumidity: 0,
      irrigationNeed: 0,
      scarcityIndex: 0,
    }));
  }

  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${LOCATION.lat}&longitude=${LOCATION.lon}&start_date=${start}&end_date=${endDay}&daily=temperature_2m_mean,relative_humidity_2m_mean,precipitation_sum&timezone=Asia%2FManila`;
  const res = await fetch(url);
  const json = await res.json();
  const {
    time,
    temperature_2m_mean,
    relative_humidity_2m_mean,
    precipitation_sum,
  } = json.daily;

  const grouped: Record<number, { temps: number[]; hums: number[]; rains: number[] }> =
    {};
  time.forEach((dateStr: string, i: number) => {
    const m = new Date(dateStr).getMonth();
    if (!grouped[m]) grouped[m] = { temps: [], hums: [], rains: [] };
    if (temperature_2m_mean[i] != null) grouped[m].temps.push(temperature_2m_mean[i]);
    if (relative_humidity_2m_mean[i] != null)
      grouped[m].hums.push(relative_humidity_2m_mean[i]);
    if (precipitation_sum[i] != null) grouped[m].rains.push(precipitation_sum[i]);
  });

  const avg = (arr: number[]) =>
    arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;
  const sum = (arr: number[]) =>
    Math.round(arr.reduce((a, b) => a + b, 0) * 10) / 10;

  return MONTH_LABELS.map((month, i) => {
    const g = grouped[i] ?? { temps: [], hums: [], rains: [] };
    const rainfall = sum(g.rains);
    const avgTemp = avg(g.temps);
    const avgHumidity = avg(g.hums);
    return {
      month,
      rainfall,
      avgTemp,
      avgHumidity,
      irrigationNeed: deriveIrrigationNeed(rainfall),
      scarcityIndex: deriveScarcity(rainfall, avgTemp),
    };
  });
};

const DetailBadge = ({
  icon,
  label,
  value,
  iconColor,
  bgColor,
}: {
  icon: string;
  label: string;
  value: string;
  iconColor: string;
  bgColor: string;
}) => (
  <View style={styles.detailBadgeRow}>
    <View style={[styles.detailIconWrap, { backgroundColor: bgColor }]}>
      <FontAwesome name={icon as never} size={12} color={iconColor} />
    </View>
    <Text style={styles.detailLabel}>{label}</Text>
    <View style={[styles.detailValueBadge, { backgroundColor: bgColor }]}>
      <Text style={[styles.detailValueText, { color: iconColor }]}>{value}</Text>
    </View>
  </View>
);

const WaterLogItem = ({ log, isLast }: { log: MockWaterLog; isLast: boolean }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[styles.logBlock, !isLast && styles.logBlockBorder]}>
      <TouchableOpacity
        style={styles.logHeader}
        onPress={() => setExpanded((prev) => !prev)}
        activeOpacity={0.75}
      >
        <View style={styles.logChevronWrap}>
          <FontAwesome
            name={expanded ? "chevron-down" : "chevron-right"}
            size={12}
            color={colors.primary}
          />
        </View>
        <Text style={styles.logTitle} numberOfLines={1}>
          {log.title}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.logDetails}>
          <DetailBadge
            icon="clock-o"
            label="Duration"
            value={log.duration}
            iconColor={colors.brandBlue}
            bgColor={colors.brandBlueLight}
          />
          <DetailBadge
            icon="tint"
            label="Water Volume"
            value={log.volume}
            iconColor={colors.primaryDark}
            bgColor={colors.humidityLight}
          />
          <DetailBadge
            icon="exchange"
            label="Moisture Change"
            value={log.moistureChange}
            iconColor={colors.warning}
            bgColor={colors.warningLight}
          />
          <DetailBadge
            icon="bolt"
            label="Trigger Type"
            value={log.triggerType}
            iconColor={colors.dark}
            bgColor="#E5E7EB"
          />
        </View>
      )}
    </View>
  );
};

export default function HistoryIrrigationLoggingScreen() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<MonthReport[]>([]);
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>(
    {},
  );

  const yearOptions = [
    currentYear,
    currentYear - 1,
    currentYear - 2,
    currentYear - 3,
  ];

  const isCurrentYear = selectedYear === currentYear;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchIrrigationReportData(selectedYear);
        setReports(data);
      } catch (e) {
        console.error("Failed to load irrigation report:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedYear]);

  const visibleReports = useMemo(() => {
    const endIndex = isCurrentYear ? currentMonth + 1 : 12;
    return reports.slice(0, endIndex);
  }, [reports, isCurrentYear, currentMonth]);

  const toggleMonth = (month: string) => {
    setExpandedMonths((prev) => ({ ...prev, [month]: !prev[month] }));
  };

  const getLevel = (need: number) => {
    if (need > 60) return { label: "Critical", color: colors.warning, bg: "#FFFBEB" };
    if (need > 20) return { label: "Moderate", color: colors.brandBlue, bg: "#EFF6FF" };
    if (need > 0) return { label: "Low", color: colors.primaryDark, bg: "#F0FDF4" };
    return { label: "Sufficient", color: colors.primary, bg: "#ECFDF5" };
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <FontAwesome name="chevron-left" size={18} color={colors.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Irrigation & Water Logging</Text>
      </View>

      <View style={styles.yearBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearRow}>
          {yearOptions.map((y) => (
            <TouchableOpacity
              key={y}
              onPress={() => setSelectedYear(y)}
              style={[styles.yearChip, selectedYear === y && styles.yearChipActive]}
            >
              <Text style={[styles.yearChipText, selectedYear === y && styles.yearChipTextActive]}>
                {y}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.cardIconWrap, { backgroundColor: colors.primaryLight }]}>
              <FontAwesome name="folder-open" size={16} color={colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Irrigation History</Text>
              <Text style={styles.cardSub}>
                {isCurrentYear ? `Jan-${MONTH_LABELS[currentMonth]} ${selectedYear}` : selectedYear}
              </Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Loading irrigation report...</Text>
            </View>
          ) : visibleReports.length === 0 ? (
            <Text style={styles.emptyText}>No irrigation report available.</Text>
          ) : (
            visibleReports.map((m, i) => {
              const expanded = !!expandedMonths[m.month];
              const level = getLevel(m.irrigationNeed);
              return (
                <View key={m.month} style={i < visibleReports.length - 1 ? styles.monthRowBorder : undefined}>
                  <TouchableOpacity style={styles.monthRow} activeOpacity={0.75} onPress={() => toggleMonth(m.month)}>
                    <FontAwesome name={expanded ? "folder-open" : "folder"} size={20} color={colors.primary} />
                    <Text style={styles.monthText}>{m.month}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: level.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: level.color }]}>{level.label}</Text>
                    </View>
                    <FontAwesome name={expanded ? "chevron-down" : "chevron-right"} size={12} color={colors.grayText} />
                  </TouchableOpacity>

                  {expanded && (
                    <View style={styles.monthReports}>
                      <DetailBadge
                        icon="tint"
                        label="Rainfall"
                        value={`${m.rainfall} mm`}
                        iconColor={colors.brandBlue}
                        bgColor={colors.brandBlueLight}
                      />
                      <DetailBadge
                        icon="thermometer-half"
                        label="Avg Temp"
                        value={`${m.avgTemp}°C`}
                        iconColor={colors.warning}
                        bgColor={colors.warningLight}
                      />
                      <DetailBadge
                        icon="leaf"
                        label="Avg Humidity"
                        value={`${m.avgHumidity}%`}
                        iconColor={colors.primaryDark}
                        bgColor={colors.humidityLight}
                      />
                      <DetailBadge
                        icon="bar-chart"
                        label="Irrigation Need"
                        value={`${m.irrigationNeed} mm`}
                        iconColor={colors.dark}
                        bgColor="#E5E7EB"
                      />
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.cardIconWrap, { backgroundColor: colors.brandBlueLight }]}>
              <FontAwesome name="tint" size={16} color={colors.brandBlue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Water Logging</Text>
              <Text style={styles.cardSub}>Prototype mock data only</Text>
            </View>
          </View>

          {MOCK_WATER_LOGS.map((log, index) => (
            <WaterLogItem key={log.id} log={log} isLast={index === MOCK_WATER_LOGS.length - 1} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.grayLight },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayBorder,
  },
  headerBtn: { padding: 8, zIndex: 1 },
  headerTitle: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.dark,
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
  },
  yearBar: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayBorder,
  },
  yearRow: { flexDirection: "row", gap: 8 },
  yearChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.grayLight,
  },
  yearChipActive: { backgroundColor: colors.primary },
  yearChipText: { fontFamily: fonts.medium, fontSize: 12, color: colors.grayText },
  yearChipTextActive: { color: colors.white },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 28 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  cardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.dark },
  cardSub: { fontFamily: fonts.regular, fontSize: 11, color: colors.grayText },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 10,
  },
  monthRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.grayBorder,
  },
  monthText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.dark },
  statusBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  statusBadgeText: { fontFamily: fonts.semibold, fontSize: 10 },
  monthReports: { paddingLeft: 30, paddingBottom: 8, gap: 8 },
  logBlock: { paddingVertical: 12 },
  logBlockBorder: { borderBottomWidth: 1, borderBottomColor: colors.grayBorder },
  logHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  logChevronWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  logTitle: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.dark },
  logDetails: { marginTop: 10, paddingLeft: 32, gap: 8 },
  detailBadgeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  detailLabel: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.grayText },
  detailValueBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  detailValueText: { fontFamily: fonts.semibold, fontSize: 12 },
  loadingState: {
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: { fontFamily: fonts.regular, fontSize: 13, color: colors.grayText },
  emptyText: { fontFamily: fonts.regular, fontSize: 13, color: colors.grayText, paddingVertical: 14 },
});
