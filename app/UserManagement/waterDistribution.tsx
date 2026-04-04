import { fontScale, scale } from "@/lib/responsive";
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

const colors = {
  primary: "#0891B2",
  primaryLight: "#22D3EE",
  primaryDark: "#0E7490",
  grayText: "#6B7280",
  grayBorder: "#E5E7EB",
  grayLight: "#F3F4F6",
  dark: "#1F2937",
  success: "#22C55E",
  danger: "#EF4444",
};

const fonts = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semibold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
};

// Mock data for irrigation areas
const AREAS_DATA = [
  {
    id: 1,
    name: "Area 1",
    progress: 75,
    status: "active",
    flowRate: "1.2 L/min",
    volume: "45 L",
  },
];

export default function WaterDistributionScreen() {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(true);
  const [areas, setAreas] = useState(AREAS_DATA);

  const handleStart = () => {
    setIsRunning(true);
  };

  const handleStop = () => {
    setIsRunning(false);
  };

  const handleAddArea = () => {
    // TODO: Implement add area functionality
    console.log("Add new area");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top App Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <FontAwesome name="chevron-left" size={18} color={colors.dark} />
          </TouchableOpacity>

          <View style={styles.titleRow}>
            <Text style={styles.topBarTitle}>WATER DISTRIBUTION</Text>
          </View>

          <View style={styles.placeholder} />
        </View>

        {/* Areas List */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {areas.map((area, index) => (
            <View key={area.id} style={styles.areaCard}>
              <View style={styles.areaHeader}>
                <Text style={styles.areaName}>{area.name}</Text>
                <View style={styles.areaStatus}>
                  <View
                    style={[
                      styles.statusDot,
                      area.status === "active"
                        ? styles.statusActive
                        : styles.statusInactive,
                    ]}
                  />
                  <Text style={styles.statusText}>
                    {area.status === "active" ? "Active" : "Inactive"}
                  </Text>
                </View>
              </View>

              {/* Area Stats */}
              <View style={styles.areaStats}>
                <View style={styles.statItem}>
                  <FontAwesome
                    name="tachometer"
                    size={14}
                    color={colors.grayText}
                  />
                  <Text style={styles.statLabel}>Flow Rate</Text>
                  <Text style={styles.statValue}>{area.flowRate}</Text>
                </View>
                <View style={styles.statItem}>
                  <FontAwesome name="tint" size={14} color={colors.grayText} />
                  <Text style={styles.statLabel}>Volume</Text>
                  <Text style={styles.statValue}>{area.volume}</Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${area.progress}%`,
                        backgroundColor:
                          area.status === "active"
                            ? colors.primary
                            : colors.grayBorder,
                      },
                    ]}
                  />
                  {/* Animated dots effect */}
                  {area.status === "active" && (
                    <View style={styles.dotsContainer}>
                      {[...Array(Math.floor(area.progress / 8))].map((_, i) => (
                        <View key={i} style={styles.dot} />
                      ))}
                    </View>
                  )}
                </View>
                <Text style={styles.progressText}>{area.progress}%</Text>
              </View>

              {/* Area Controls */}
              <View style={styles.areaControls}>
                <TouchableOpacity style={styles.areaControlButton}>
                  <FontAwesome
                    name={area.status === "active" ? "pause" : "play"}
                    size={14}
                    color={colors.primary}
                  />
                </TouchableOpacity>
                <TouchableOpacity style={styles.areaControlButton}>
                  <FontAwesome name="cog" size={14} color={colors.grayText} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.areaControlButton}>
                  <FontAwesome
                    name="info-circle"
                    size={14}
                    color={colors.grayText}
                  />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Add New Area Card */}
          <TouchableOpacity
            style={styles.addAreaCard}
            onPress={handleAddArea}
            activeOpacity={0.7}
          >
            <View style={styles.addAreaIcon}>
              <FontAwesome name="plus" size={24} color={colors.primary} />
            </View>
            <Text style={styles.addAreaText}>Add New Area</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Footer Stats */}
        <View style={styles.footer}>
          <View style={styles.footerStat}>
            <Text style={styles.footerStatLabel}>Total Flow</Text>
            <Text style={styles.footerStatValue}>1.2 L/min</Text>
          </View>
          <View style={styles.footerDivider} />
          <View style={styles.footerStat}>
            <Text style={styles.footerStatLabel}>Active Zones</Text>
            <Text style={styles.footerStatValue}>1/1</Text>
          </View>
          <View style={styles.footerDivider} />
          <View style={styles.footerStat}>
            <Text style={styles.footerStatLabel}>Today Usage</Text>
            <Text style={styles.footerStatValue}>45 L</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F9FAFB",
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
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.grayBorder,
  },
  backButton: {
    padding: 4,
    width: scale(32),
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  topBarTitle: {
    fontFamily: fonts.bold,
    fontSize: fontScale(16),
    color: colors.dark,
    letterSpacing: 0.5,
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.grayLight,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholder: {
    width: 32,
  },
  controlsContainer: {
    flexDirection: "column",
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: scale(40),
    gap: 12,
    backgroundColor: "#fff",
  },
  controlButton: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  startButton: {
    backgroundColor: colors.primary,
  },
  activeButton: {
    backgroundColor: colors.primaryDark,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  stopButton: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: colors.grayBorder,
  },
  stopActiveButton: {
    borderColor: colors.danger,
    backgroundColor: "#FEF2F2",
  },
  controlButtonText: {
    fontFamily: fonts.bold,
    fontSize: fontScale(16),
    letterSpacing: 1,
  },
  startButtonText: {
    color: "#fff",
  },
  stopButtonText: {
    color: colors.grayText,
  },
  stopActiveText: {
    color: colors.danger,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  areaCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.grayBorder,
    padding: 16,
  },
  areaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  areaName: {
    fontFamily: fonts.semibold,
    fontSize: fontScale(16),
    color: colors.dark,
  },
  areaStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusActive: {
    backgroundColor: colors.success,
  },
  statusInactive: {
    backgroundColor: colors.grayText,
  },
  statusText: {
    fontFamily: fonts.regular,
    fontSize: fontScale(12),
    color: colors.grayText,
  },
  areaStats: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 16,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statLabel: {
    fontFamily: fonts.regular,
    fontSize: fontScale(12),
    color: colors.grayText,
  },
  statValue: {
    fontFamily: fonts.medium,
    fontSize: fontScale(12),
    color: colors.dark,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  progressBar: {
    flex: 1,
    height: 12,
    backgroundColor: colors.grayLight,
    borderRadius: 6,
    overflow: "hidden",
    position: "relative",
  },
  progressFill: {
    height: "100%",
    borderRadius: 6,
  },
  dotsContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  progressText: {
    fontFamily: fonts.medium,
    fontSize: fontScale(14),
    color: colors.dark,
    width: 45,
    textAlign: "right",
  },
  areaControls: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  areaControlButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.grayLight,
    justifyContent: "center",
    alignItems: "center",
  },
  addAreaCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.grayBorder,
    borderStyle: "dashed",
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  addAreaIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.grayLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  addAreaText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.grayText,
  },
  footer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: colors.grayBorder,
  },
  footerStat: {
    flex: 1,
    alignItems: "center",
  },
  footerStatLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.grayText,
    marginBottom: 2,
  },
  footerStatValue: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.dark,
  },
  footerDivider: {
    width: 1,
    backgroundColor: colors.grayBorder,
    marginVertical: 4,
  },
});
