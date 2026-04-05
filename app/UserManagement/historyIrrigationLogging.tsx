import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Design System (matches WaterRequirementScreen) ───────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────────────────

type WaterLog = {
  id: string;
  title: string;
  soilMoisture: number;
  temperature: number;
  humidity: number;
};

// ─── Mock Data ────────────────────────────────────────────────────────────────

const IRRIGATION_MONTHS = ["January", "February", "March", "April", "May"];

const WATER_LOGS: WaterLog[] = [
  {
    id: "1",
    title: "January 10, 2026 - 10:30:56 AM",
    soilMoisture: 50,
    temperature: 24,
    humidity: 45,
  },
  {
    id: "2",
    title: "January 25, 2026 - 08:10:06 AM",
    soilMoisture: 35,
    temperature: 29,
    humidity: 30,
  },
  {
    id: "3",
    title: "February 05, 2026 - 01:30:34 PM",
    soilMoisture: 55,
    temperature: 22,
    humidity: 50,
  },
];

// ─── Detail Badge ─────────────────────────────────────────────────────────────

const DetailBadge = ({
  icon,
  label,
  value,
  unit,
  iconColor,
  bgColor,
}: {
  icon: string;
  label: string;
  value: number;
  unit: string;
  iconColor: string;
  bgColor: string;
}) => (
  <View style={styles.detailBadgeRow}>
    <View style={[styles.detailIconWrap, { backgroundColor: bgColor }]}>
      <FontAwesome name={icon as any} size={12} color={iconColor} />
    </View>
    <Text style={styles.detailLabel}>{label}</Text>
    <View style={[styles.detailValueBadge, { backgroundColor: bgColor }]}>
      <Text style={[styles.detailValueText, { color: iconColor }]}>
        {value}
        {unit}
      </Text>
    </View>
  </View>
);

// ─── Water Log Item ───────────────────────────────────────────────────────────

const WaterLogItem = ({ log, isLast }: { log: WaterLog; isLast: boolean }) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <View style={[styles.logBlock, !isLast && styles.logBlockBorder]}>
      <TouchableOpacity
        style={styles.logHeader}
        onPress={() => setExpanded((prev) => !prev)}
        activeOpacity={0.7}
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
            icon="tint"
            label="Soil Moisture"
            value={log.soilMoisture}
            unit="%"
            iconColor={colors.brandBlue}
            bgColor={colors.brandBlueLight}
          />
          <DetailBadge
            icon="thermometer-half"
            label="Temperature"
            value={log.temperature}
            unit="°C"
            iconColor={colors.warning}
            bgColor={colors.warningLight}
          />
          <DetailBadge
            icon="leaf"
            label="Humidity"
            value={log.humidity}
            unit="%"
            iconColor={colors.primary}
            bgColor={colors.humidityLight}
          />
        </View>
      )}
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HistoryIrrigationLoggingScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header — same structure as WaterRequirementScreen */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBtn}
        >
          <FontAwesome name="chevron-left" size={18} color={colors.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Irrigation & Water Logging</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Irrigation History Card ── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View
              style={[
                styles.cardIconWrap,
                { backgroundColor: colors.primaryLight },
              ]}
            >
              <FontAwesome
                name="history"
                size={16}
                color={colors.primaryDark}
              />
            </View>
            <Text style={styles.cardTitle}>Irrigation History</Text>
          </View>

          {IRRIGATION_MONTHS.map((month, index) => (
            <TouchableOpacity
              key={month}
              style={[
                styles.monthRow,
                index < IRRIGATION_MONTHS.length - 1 && styles.monthRowBorder,
              ]}
              activeOpacity={0.7}
            >
              <FontAwesome
                name="folder-open"
                size={20}
                color={colors.primary}
              />
              <Text style={styles.monthText}>{month}</Text>
              <FontAwesome
                name="chevron-right"
                size={12}
                color={colors.grayText}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Water Logging Card ── */}
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
            <Text style={styles.cardTitle}>Water Logging</Text>
          </View>

          {WATER_LOGS.map((log, index) => (
            <WaterLogItem
              key={log.id}
              log={log}
              isLast={index === WATER_LOGS.length - 1}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.grayLight,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayBorder,
  },
  headerBtn: {
    padding: 8,
    zIndex: 1,
  },
  headerTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.dark,
    textAlign: "center",
    position: "absolute",
    left: 0,
    right: 0,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 100,
  },

  // Card
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
    marginBottom: 16,
  },
  cardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.dark,
  },

  // Month Row
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
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

  // Log Block
  logBlock: {
    paddingVertical: 12,
  },
  logBlockBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.grayBorder,
  },
  logHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logChevronWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  logTitle: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.dark,
  },
  logDetails: {
    marginTop: 10,
    paddingLeft: 32,
    gap: 8,
  },

  // Detail Badge
  detailBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
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
  detailValueText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
  },

  // FAB
  fab: {
    position: "absolute",
    bottom: 28,
    right: 16,
    gap: 10,
  },
  fabBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
