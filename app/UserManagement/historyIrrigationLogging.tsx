import { supabase } from "@/lib/supabase";
import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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

/** Matches `public.irrigation_log` */
type IrrigationLogRow = {
  id: number;
  system_id: number;
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
  water_volume_consumed: number | null;
  trigger_type: string;
  moisture_before: number | null;
  moisture_after: number | null;
};

function formatDurationSeconds(totalSec: number | null | undefined): string {
  if (totalSec == null || totalSec < 0 || !Number.isFinite(totalSec)) {
    return "—";
  }
  const s = Math.round(totalSec);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m === 0) return `${rem}s`;
  return `${m}m ${rem}s`;
}

function effectiveDurationSeconds(log: IrrigationLogRow): number | null {
  if (log.duration_seconds != null && log.duration_seconds >= 0) {
    return log.duration_seconds;
  }
  if (log.start_time && log.end_time) {
    const a = new Date(log.start_time).getTime();
    const b = new Date(log.end_time).getTime();
    const diff = Math.round((b - a) / 1000);
    return diff >= 0 ? diff : null;
  }
  return null;
}

function formatTriggerLabel(raw: string | null | undefined): string {
  if (!raw) return "—";
  const t = String(raw).toLowerCase();
  if (t === "automated") return "Automated";
  if (t === "manual") return "Manual";
  return raw.replace(/_/g, " ");
}

function formatMoistureDetailShort(log: IrrigationLogRow): string {
  const b = log.moisture_before;
  const a = log.moisture_after;
  if (b == null && a == null) return "Not recorded";
  if (b != null && a != null) return `${b}% → ${a}%`;
  if (b != null) return `Before ${b}%`;
  return `After ${a}%`;
}

function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diffSec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const deriveScarcity = (rainfall: number, temp: number) =>
  Math.min(
    100,
    Math.round(
      (Math.max(0, 100 - rainfall / 2) + Math.max(0, (temp - 24) * 5)) / 2,
    ),
  );

const deriveIrrigationNeed = (rainfall: number) =>
  Math.max(0, Math.round(100 - rainfall));

const fetchIrrigationReportData = async (
  year: number,
): Promise<MonthReport[]> => {
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

  const avg = (arr: number[]) =>
    arr.length
      ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
      : 0;
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
      <Text style={[styles.detailValueText, { color: iconColor }]}>
        {value}
      </Text>
    </View>
  </View>
);

function resolveSystemLabel(
  systemId: number,
  map: Map<number, string>,
): string {
  return map.get(systemId)?.trim() || `System #${systemId}`;
}

const WaterLogItem = ({
  log,
  systemName,
  isLast,
}: {
  log: IrrigationLogRow;
  systemName: string;
  isLast: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);
  const completed = Boolean(log.end_time);
  const durationStr = formatDurationSeconds(effectiveDurationSeconds(log));
  const triggerLabel = formatTriggerLabel(log.trigger_type);
  const summaryLine = completed
    ? `${systemName} finished irrigation (${durationStr}). Trigger: ${triggerLabel}.`
    : `${systemName} irrigation in progress. Trigger: ${triggerLabel}.`;
  const relative = formatRelativeTime(log.end_time ?? log.start_time);

  return (
    <View style={[styles.wlCard, !isLast && styles.logBlockBorder]}>
      <TouchableOpacity
        style={styles.wlRow}
        onPress={() => setExpanded((prev) => !prev)}
        activeOpacity={0.75}
      >
        <View style={styles.wlIconOuter}>
          <View style={styles.wlIconInner}>
            <FontAwesome
              name={completed ? "check" : "clock-o"}
              size={14}
              color={colors.grayText}
            />
          </View>
        </View>
        <View style={styles.wlBody}>
          <View style={styles.wlTitleRow}>
            <Text style={styles.wlTitle} numberOfLines={1}>
              {completed ? "Irrigation completed" : "Irrigation in progress"}
            </Text>
            <View style={styles.wlUnreadDot} />
          </View>
          <Text style={styles.wlSummary} numberOfLines={3}>
            {summaryLine}
          </Text>
          <Text style={styles.wlRelative}>{relative}</Text>
        </View>
        <FontAwesome
          name={expanded ? "chevron-down" : "chevron-right"}
          size={12}
          color={colors.grayText}
          style={styles.wlChevron}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.logDetails}>
          <DetailBadge
            icon="calendar"
            label="Started"
            value={new Date(log.start_time).toLocaleString("en-PH")}
            iconColor={colors.brandBlue}
            bgColor={colors.brandBlueLight}
          />
          <DetailBadge
            icon="calendar-check-o"
            label="Ended"
            value={
              log.end_time
                ? new Date(log.end_time).toLocaleString("en-PH")
                : "—"
            }
            iconColor={colors.primaryDark}
            bgColor={colors.humidityLight}
          />
          <DetailBadge
            icon="clock-o"
            label="Duration"
            value={durationStr}
            iconColor={colors.brandBlue}
            bgColor={colors.brandBlueLight}
          />
          <DetailBadge
            icon="tint"
            label="Water consumed"
            value={
              log.water_volume_consumed != null &&
              Number.isFinite(log.water_volume_consumed)
                ? `${log.water_volume_consumed.toFixed(1)} L`
                : "Not recorded"
            }
            iconColor={colors.primaryDark}
            bgColor={colors.humidityLight}
          />
          <DetailBadge
            icon="leaf"
            label="Moisture"
            value={formatMoistureDetailShort(log)}
            iconColor={colors.warning}
            bgColor={colors.warningLight}
          />
          <DetailBadge
            icon="bolt"
            label="Trigger"
            value={triggerLabel}
            iconColor={colors.dark}
            bgColor="#E5E7EB"
          />
        </View>
      )}
    </View>
  );
};

const PAGE_SIZE = 3;

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
  const [waterLogs, setWaterLogs] = useState<IrrigationLogRow[]>([]);
  const [waterLogsLoading, setWaterLogsLoading] = useState(true);
  const [systemNameMap, setSystemNameMap] = useState<Map<number, string>>(
    () => new Map(),
  );
  const [currentPage, setCurrentPage] = useState(1);

  const loadWaterLogs = useCallback(async (year: number) => {
    setWaterLogsLoading(true);
    try {
      const start = `${year}-01-01T00:00:00.000Z`;
      const end = `${year + 1}-01-01T00:00:00.000Z`;
      const { data: rows, error } = await supabase
        .from("irrigation_log")
        .select(
          "id, system_id, start_time, end_time, duration_seconds, water_volume_consumed, trigger_type, moisture_before, moisture_after",
        )
        .gte("start_time", start)
        .lt("start_time", end)
        .order("start_time", { ascending: false })
        .limit(200);

      if (error) {
        console.error("irrigation_log:", error.message);
        setWaterLogs([]);
        setSystemNameMap(new Map());
        return;
      }

      const list = (rows ?? []) as IrrigationLogRow[];
      setWaterLogs(list);

      const systemIds = [
        ...new Set(
          list.map((r) => r.system_id).filter((id) => Number.isFinite(id)),
        ),
      ] as number[];

      if (systemIds.length === 0) {
        setSystemNameMap(new Map());
        return;
      }

      const { data: systems, error: sysError } = await supabase
        .from("irrigation_system")
        .select("*")
        .in("id", systemIds);

      if (sysError || !systems?.length) {
        setSystemNameMap(new Map());
        return;
      }

      const map = new Map<number, string>();
      for (const raw of systems as Record<string, unknown>[]) {
        const id = Number(raw.id);
        const label =
          (typeof raw.name === "string" && raw.name) ||
          (typeof raw.system_name === "string" && raw.system_name) ||
          (typeof raw.title === "string" && raw.title) ||
          (typeof raw.label === "string" && raw.label) ||
          `System ${id}`;
        map.set(id, String(label));
      }
      setSystemNameMap(map);
    } catch (e) {
      console.error(e);
      setWaterLogs([]);
      setSystemNameMap(new Map());
    } finally {
      setWaterLogsLoading(false);
    }
  }, []);

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

  useEffect(() => {
    setCurrentPage(1);
    void loadWaterLogs(selectedYear);
  }, [selectedYear, loadWaterLogs]);

  const visibleReports = useMemo(() => {
    const endIndex = isCurrentYear ? currentMonth + 1 : 12;
    return reports.slice(0, endIndex);
  }, [reports, isCurrentYear, currentMonth]);

  const totalPages = Math.ceil(waterLogs.length / PAGE_SIZE);

  const paginatedLogs = useMemo(
    () =>
      waterLogs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [waterLogs, currentPage],
  );

  const toggleMonth = (month: string) => {
    setExpandedMonths((prev) => ({ ...prev, [month]: !prev[month] }));
  };

  const getLevel = (need: number) => {
    if (need > 60)
      return { label: "Critical", color: colors.warning, bg: "#FFFBEB" };
    if (need > 20)
      return { label: "Moderate", color: colors.brandBlue, bg: "#EFF6FF" };
    if (need > 0)
      return { label: "Low", color: colors.primaryDark, bg: "#F0FDF4" };
    return { label: "Sufficient", color: colors.primary, bg: "#ECFDF5" };
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBtn}
        >
          <FontAwesome name="chevron-left" size={18} color={colors.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Irrigation & Water Logging</Text>
      </View>

      <View style={styles.yearBar}>
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
                  selectedYear === y && styles.yearChipTextActive,
                ]}
              >
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
        {/* Irrigation History Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View
              style={[
                styles.cardIconWrap,
                { backgroundColor: colors.primaryLight },
              ]}
            >
              <FontAwesome
                name="folder-open"
                size={16}
                color={colors.primaryDark}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Irrigation History</Text>
              <Text style={styles.cardSub}>
                {isCurrentYear
                  ? `Jan-${MONTH_LABELS[currentMonth]} ${selectedYear}`
                  : selectedYear}
              </Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>
                Loading irrigation report...
              </Text>
            </View>
          ) : visibleReports.length === 0 ? (
            <Text style={styles.emptyText}>
              No irrigation report available.
            </Text>
          ) : (
            visibleReports.map((m, i) => {
              const expanded = !!expandedMonths[m.month];
              const level = getLevel(m.irrigationNeed);
              return (
                <View
                  key={m.month}
                  style={
                    i < visibleReports.length - 1
                      ? styles.monthRowBorder
                      : undefined
                  }
                >
                  <TouchableOpacity
                    style={styles.monthRow}
                    activeOpacity={0.75}
                    onPress={() => toggleMonth(m.month)}
                  >
                    <FontAwesome
                      name={expanded ? "folder-open" : "folder"}
                      size={20}
                      color={colors.primary}
                    />
                    <Text style={styles.monthText}>{m.month}</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: level.bg },
                      ]}
                    >
                      <Text
                        style={[styles.statusBadgeText, { color: level.color }]}
                      >
                        {level.label}
                      </Text>
                    </View>
                    <FontAwesome
                      name={expanded ? "chevron-down" : "chevron-right"}
                      size={12}
                      color={colors.grayText}
                    />
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

        {/* Water Logging Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View
              style={[
                styles.cardIconWrap,
                { backgroundColor: colors.brandBlueLight },
              ]}
            >
              <FontAwesome name="tint" size={16} color={colors.brandBlue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Water Logging</Text>
              <Text style={styles.cardSub}>
                From irrigation logs · {selectedYear}
              </Text>
            </View>
          </View>

          {waterLogsLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="small" color={colors.brandBlue} />
              <Text style={styles.loadingText}>Loading water logs...</Text>
            </View>
          ) : waterLogs.length === 0 ? (
            <Text style={styles.emptyText}>
              No irrigation events for this year. Completed runs appear here
              with duration, trigger, and optional moisture and volume.
            </Text>
          ) : (
            <>
              {paginatedLogs.map((log, index) => (
                <WaterLogItem
                  key={String(log.id)}
                  log={log}
                  systemName={resolveSystemLabel(log.system_id, systemNameMap)}
                  isLast={index === paginatedLogs.length - 1}
                />
              ))}

              {totalPages > 1 && (
                <View style={styles.paginationRow}>
                  <TouchableOpacity
                    onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    style={[
                      styles.pageBtn,
                      currentPage === 1 && styles.pageBtnDisabled,
                    ]}
                  >
                    <FontAwesome
                      name="chevron-left"
                      size={12}
                      color={
                        currentPage === 1 ? colors.grayText : colors.brandBlue
                      }
                    />
                  </TouchableOpacity>

                  <Text style={styles.pageLabel}>
                    {currentPage} / {totalPages}
                  </Text>

                  <TouchableOpacity
                    onPress={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    style={[
                      styles.pageBtn,
                      currentPage === totalPages && styles.pageBtnDisabled,
                    ]}
                  >
                    <FontAwesome
                      name="chevron-right"
                      size={12}
                      color={
                        currentPage === totalPages
                          ? colors.grayText
                          : colors.brandBlue
                      }
                    />
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
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
  yearChipText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.grayText,
  },
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
  monthText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.dark,
  },
  statusBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  statusBadgeText: { fontFamily: fonts.semibold, fontSize: 10 },
  monthReports: { paddingLeft: 30, paddingBottom: 8, gap: 8 },
  logBlockBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.grayBorder,
  },
  wlCard: {
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  wlRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  wlIconOuter: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  wlIconInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  wlBody: { flex: 1, minWidth: 0 },
  wlTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  wlTitle: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.dark,
  },
  wlUnreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brandBlue,
  },
  wlSummary: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.grayText,
    lineHeight: 19,
    marginBottom: 6,
  },
  wlRelative: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.grayText,
    opacity: 0.85,
  },
  wlChevron: { marginTop: 4, padding: 4 },
  logDetails: { marginTop: 12, paddingLeft: 4, gap: 8 },
  detailBadgeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  detailLabel: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.grayText,
  },
  detailValueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  detailValueText: { fontFamily: fonts.semibold, fontSize: 12 },
  loadingState: {
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.grayText,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.grayText,
    paddingVertical: 14,
  },
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 14,
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: colors.grayBorder,
    marginTop: 4,
  },
  pageBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.brandBlueLight,
    alignItems: "center",
    justifyContent: "center",
  },
  pageBtnDisabled: {
    backgroundColor: colors.grayLight,
  },
  pageLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.dark,
  },
});
