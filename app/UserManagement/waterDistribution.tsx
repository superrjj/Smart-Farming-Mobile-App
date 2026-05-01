import { fontScale, scale } from "@/lib/responsive";
import { supabase } from "@/lib/supabase";
import { FontAwesome } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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

type IrrigationMode = "automatic" | "manual";

const AUTO_MODE_COLUMN = "auto_mode_enabled";
const isMissingAutoModeColumnError = (error: unknown): boolean => {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  return message.toLowerCase().includes(AUTO_MODE_COLUMN);
};

const DEFAULT_IRRIGATION_BRIDGE_URL =
  "https://arduino-bridge-production.up.railway.app";

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

type IrrigationSystemRow = {
  id: number;
  farm_id: number;
  system_name: string;
  pump_status: boolean;
  auto_mode_enabled?: boolean | null;
};

type UserProfileRow = {
  id?: string | number | null;
  user_id?: string | number | null;
  owner_id?: string | number | null;
};

const toOwnerIdCandidates = (profile: UserProfileRow): (string | number)[] => {
  const raw = [profile.id, profile.user_id, profile.owner_id];
  const unique = new Set<string | number>();

  raw.forEach((value) => {
    if (value === null || value === undefined) return;
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

export default function WaterDistributionScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === "string" ? params.email : "";
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [areas, setAreas] = useState(AREAS_DATA);
  const [system, setSystem] = useState<IrrigationSystemRow | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [supportsAutoModeColumn, setSupportsAutoModeColumn] = useState(true);
  const [irrigationMode, setIrrigationMode] = useState<IrrigationMode>("manual");

  const isAutoEnabled = Boolean(system?.auto_mode_enabled);
  const activeMode: IrrigationMode = useMemo(() => {
    // If auto is enabled in DB, we treat the "effective" mode as automatic.
    return isAutoEnabled ? "automatic" : irrigationMode;
  }, [irrigationMode, isAutoEnabled]);

  const syncIrrigationStateToBridge = useCallback(
    async ({
      systemId,
      autoModeEnabled,
      pumpStatus,
    }: {
      systemId: number;
      autoModeEnabled: boolean;
      pumpStatus: boolean;
    }): Promise<boolean> => {
      const configuredBridgeUrl =
        process.env.EXPO_PUBLIC_ARDUINO_BRIDGE_URL?.trim() || "";
      // Only use configured bridge (or the Railway default).
      // The legacy workers.dev bridge returns sensor-reading errors for this endpoint.
      const candidateBaseUrls = [
        configuredBridgeUrl || DEFAULT_IRRIGATION_BRIDGE_URL,
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
            lastFailure = { endpoint, status: response.status, responseText };
            continue;
          }

          let parsed: { auto_mode_enabled?: unknown; pump_status?: unknown } | null =
            null;
          try {
            parsed = responseText ? JSON.parse(responseText) : null;
          } catch {
            parsed = null;
          }

          const hasExpectedShape =
            !!parsed &&
            typeof parsed.auto_mode_enabled === "boolean" &&
            typeof parsed.pump_status === "boolean";
          if (hasExpectedShape) return true;

          lastFailure = { endpoint, status: response.status, responseText };
        } catch (bridgeError) {
          lastFailure = { endpoint, bridgeError };
        }
      }

      console.warn("[Irrigation] Bridge sync failed for all endpoints", {
        candidates: candidateBaseUrls,
        ...lastFailure,
      });
      return false;
    },
    [],
  );

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        if (!email) return;
        const { data: profile, error: profileError } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();
        if (profileError || !profile?.id) return;
        setUserId(String(profile.id));

        const ownerCandidates = toOwnerIdCandidates(profile as UserProfileRow);
        let farm: { id: number | string } | null = null;
        let lastFarmError: { code?: string; message?: string } | null = null;
        for (const ownerCandidate of ownerCandidates) {
          const { data: farmData, error: farmError } = await supabase
            .from("farm")
            .select("id")
            .eq("owner_id", ownerCandidate)
            .maybeSingle();

          if (farmError) {
            // If owner_id is bigint and candidate is UUID/text, try the next candidate.
            if (farmError.code === "22P02") {
              lastFarmError = farmError;
              continue;
            }
            throw farmError;
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
          return;
        }

        const { data: existingSystem, error: existingSystemError } =
          await supabase
            .from("irrigation_system")
            .select("id, farm_id, system_name, pump_status, auto_mode_enabled")
            .eq("farm_id", farm.id)
            .eq("system_name", "Main Irrigation System")
            .maybeSingle();
        if (
          existingSystemError &&
          !isMissingAutoModeColumnError(existingSystemError)
        ) {
          throw existingSystemError;
        }

        if (
          existingSystemError &&
          isMissingAutoModeColumnError(existingSystemError)
        ) {
          setSupportsAutoModeColumn(false);
          const { data: existingNoAuto, error: existingNoAutoError } =
            await supabase
              .from("irrigation_system")
              .select("id, farm_id, system_name, pump_status")
              .eq("farm_id", farm.id)
              .eq("system_name", "Main Irrigation System")
              .maybeSingle();
          if (existingNoAutoError) throw existingNoAutoError;
          if (existingNoAuto) {
            setSystem(existingNoAuto as IrrigationSystemRow);
            setIsRunning(Boolean(existingNoAuto.pump_status));
            setIrrigationMode("manual");
            return;
          }
        }

        if (existingSystem) {
          setSupportsAutoModeColumn(true);
          setSystem(existingSystem as IrrigationSystemRow);
          setIsRunning(Boolean(existingSystem.pump_status));
          setIrrigationMode(existingSystem.auto_mode_enabled ? "automatic" : "manual");
          return;
        }

        const { data: createdSystem, error: createError } = await supabase
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
          if (createdNoAutoError) throw createdNoAutoError;
          setSystem(createdNoAuto as IrrigationSystemRow);
          setIsRunning(false);
          setIrrigationMode("manual");
          return;
        }
        if (createError) throw createError;

        setSupportsAutoModeColumn(true);
        setSystem(createdSystem as IrrigationSystemRow);
        setIsRunning(false);
        setIrrigationMode(createdSystem.auto_mode_enabled ? "automatic" : "manual");
      } catch (err) {
        console.error("Failed to initialize irrigation system:", err);
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, [email]);

  const applyAutoIrrigationMode = useCallback(
    async (on: boolean) => {
      if (!system?.id || sending) return;
      if (!supportsAutoModeColumn) {
        Alert.alert(
          "Database Update Needed",
          "Please add irrigation_system.auto_mode_enabled in Supabase before using automatic irrigation.",
        );
        return;
      }

      setSending(true);
      try {
        const scheduleId = await getActiveScheduleId();
        const shouldStopPump = !on && Boolean(system.pump_status);
        // In auto mode, hardware owns pump decisions from soil thresholds.
        const nextPumpStatus = on ? false : shouldStopPump ? false : system.pump_status;

        const { error: systemError } = await supabase
          .from("irrigation_system")
          .update({
            pump_status: nextPumpStatus,
            auto_mode_enabled: on,
          })
          .eq("id", system.id);

        if (systemError) {
          if (isMissingAutoModeColumnError(systemError)) {
            setSupportsAutoModeColumn(false);
            Alert.alert(
              "Database Update Needed",
              "Please add irrigation_system.auto_mode_enabled in Supabase before using automatic irrigation.",
            );
            return;
          }
          throw systemError;
        }

        const nowIso = new Date().toISOString();
        const { error: logError } = await supabase.from("irrigation_log").insert({
          system_id: system.id,
          triggered_by_user_id: userId,
          trigger_type: "Automated",
          status: shouldStopPump ? "completed" : "idle",
          command: on ? "auto_mode_on" : "auto_mode_off",
          start_time: nowIso,
          end_time: shouldStopPump ? nowIso : null,
          duration_seconds: shouldStopPump ? 0 : null,
          schedule_id: scheduleId,
        });
        if (logError) throw logError;

        const bridgeSynced = await syncIrrigationStateToBridge({
          systemId: system.id,
          autoModeEnabled: on,
          pumpStatus: nextPumpStatus,
        });

        setSystem((prev) =>
          prev
            ? {
                ...prev,
                auto_mode_enabled: on,
                pump_status: Boolean(nextPumpStatus),
              }
            : prev,
        );
        setIsRunning(Boolean(nextPumpStatus));
        setAreas((prev) =>
          prev.map((area) => ({
            ...area,
            status: nextPumpStatus ? "active" : "inactive",
          })),
        );

        if (!bridgeSynced) {
          Alert.alert(
            "Saved",
            "Your irrigation settings have been updated successfully."
          );
        }
      } catch (err) {
        console.error("Failed to set automatic irrigation mode:", err);
        Alert.alert(
          "Update Failed",
          err instanceof Error
            ? err.message
            : "Unable to change automatic irrigation mode. Please try again.",
        );
      } finally {
        setSending(false);
      }
    },
    [
      areas,
      sending,
      supportsAutoModeColumn,
      syncIrrigationStateToBridge,
      system,
      userId,
    ],
  );

  useEffect(() => {
    if (!system?.id) return;
    const channel = supabase
      .channel(`water-distribution-system-${system.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "irrigation_system",
          filter: `id=eq.${system.id}`,
        },
        (payload) => {
          const next = payload.new as Partial<IrrigationSystemRow>;
          const nextPump = Boolean(next.pump_status);
          setSystem((prev) =>
            prev
              ? {
                  ...prev,
                  pump_status: nextPump,
                  auto_mode_enabled:
                    typeof next.auto_mode_enabled === "boolean"
                      ? next.auto_mode_enabled
                      : prev.auto_mode_enabled,
                }
              : prev,
          );
          setIsRunning(nextPump);
          setAreas((prev) =>
            prev.map((area) => ({
              ...area,
              status: nextPump ? "active" : "inactive",
            })),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [system?.id]);

  const getActiveScheduleId = async (): Promise<string | null> => {
    if (!userId) return null;
    const todayYmd = new Date().toISOString().slice(0, 10);

    const { data: schedules } = await supabase
      .from("irrigation_schedules")
      .select("id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(10);
    const scheduleIds = (schedules ?? []).map((s) => String(s.id));
    if (scheduleIds.length === 0) return null;

    const { data: dates } = await supabase
      .from("irrigation_scheduled_dates")
      .select("schedule_id, scheduled_date")
      .in("schedule_id", scheduleIds)
      .gte("scheduled_date", todayYmd)
      .order("scheduled_date", { ascending: true })
      .limit(1)
      .maybeSingle();

    return dates?.schedule_id
      ? String(dates.schedule_id)
      : (scheduleIds[0] ?? null);
  };

  const handleStart = async () => {
    if (!system?.id || sending) return;
    if (activeMode === "automatic") {
      Alert.alert(
        "Automatic Mode Is Selected",
        "Switch to Manual mode before manually starting the pump.",
      );
      return;
    }
    setSending(true);
    try {
      const scheduleId = await getActiveScheduleId();

      const { error: updateError } = await supabase
        .from("irrigation_system")
        .update({ pump_status: true })
        .eq("id", system.id);
      if (updateError) throw updateError;

      const { error: logError } = await supabase.from("irrigation_log").insert({
        system_id: system.id,
        triggered_by_user_id: userId,
        trigger_type: "Manual",
        status: "running",
        command: "pump_on",
        schedule_id: scheduleId,
      });
      if (logError) throw logError;

      setSystem((prev) => (prev ? { ...prev, pump_status: true } : prev));
      setIsRunning(true);
      setAreas((prev) => prev.map((a) => ({ ...a, status: "active" })));
    } catch (err) {
      console.error("Failed to start irrigation:", err);
      Alert.alert(
        "Start Failed",
        err instanceof Error
          ? err.message
          : "Unable to start pump. Please try again.",
      );
    } finally {
      setSending(false);
    }
  };

  const handleStop = async () => {
    if (!system?.id || sending) return;
    if (activeMode === "automatic") {
      Alert.alert(
        "Automatic Mode Is Selected",
        "Switch to Manual mode before manually stopping the pump.",
      );
      return;
    }
    setSending(true);
    try {
      const nowIso = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("irrigation_system")
        .update({ pump_status: false })
        .eq("id", system.id);
      if (updateError) throw updateError;

      const { data: latestRun } = await supabase
        .from("irrigation_log")
        .select("id, start_time")
        .eq("system_id", system.id)
        .is("end_time", null)
        .order("start_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestRun?.id) {
        const startMs = new Date(latestRun.start_time).getTime();
        const durationSeconds = Number.isNaN(startMs)
          ? null
          : Math.max(0, Math.round((Date.now() - startMs) / 1000));
        const { error: closeError } = await supabase
          .from("irrigation_log")
          .update({
            end_time: nowIso,
            duration_seconds: durationSeconds,
            status: "completed",
            command: "pump_off",
          })
          .eq("id", latestRun.id);
        if (closeError) throw closeError;
      } else {
        const { error: stopLogError } = await supabase
          .from("irrigation_log")
          .insert({
            system_id: system.id,
            triggered_by_user_id: userId,
            trigger_type: "Manual",
            status: "completed",
            command: "pump_off",
            start_time: nowIso,
            end_time: nowIso,
            duration_seconds: 0,
          });
        if (stopLogError) throw stopLogError;
      }

      setSystem((prev) => (prev ? { ...prev, pump_status: false } : prev));
      setIsRunning(false);
      setAreas((prev) => prev.map((a) => ({ ...a, status: "inactive" })));
    } catch (err) {
      console.error("Failed to stop irrigation:", err);
      Alert.alert(
        "Stop Failed",
        err instanceof Error
          ? err.message
          : "Unable to stop pump. Please try again.",
      );
    } finally {
      setSending(false);
    }
  };

  const handleAddArea = () => {
    console.log("Add new area");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading irrigation system...</Text>
          </View>
        ) : (
          <>
            {/* Top App Bar */}
            <View style={styles.topBar}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backButton}
              >
                <FontAwesome
                  name="chevron-left"
                  size={18}
                  color={colors.dark}
                />
              </TouchableOpacity>

              <View style={styles.titleRow}>
                <Text style={styles.topBarTitle}>WATER DISTRIBUTION</Text>
              </View>

              <View style={styles.placeholder} />
            </View>

            {/* ── Start / Stop Controls ── */}
            <View style={styles.controlsContainer}>
              {/* Status indicator */}
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusPulse,
                    isRunning ? styles.pulseActive : styles.pulseIdle,
                  ]}
                />
                <Text style={styles.statusLabel}>
                  {isRunning ? "System Running" : "System Stopped"}
                </Text>
                <View
                  style={[
                    styles.modeChip,
                    activeMode === "automatic"
                      ? styles.modeChipAuto
                      : styles.modeChipManual,
                  ]}
                >
                  <Text style={styles.modeChipText}>
                    {activeMode === "automatic" ? "Auto Mode" : "Manual Mode"}
                  </Text>
                </View>
              </View>

              {/* Mode selector */}
              <View style={styles.modeSelector}>
                <TouchableOpacity
                  style={[
                    styles.modeOption,
                    irrigationMode === "automatic" && styles.modeOptionActive,
                  ]}
                  activeOpacity={0.85}
                  onPress={() => setIrrigationMode("automatic")}
                >
                  <FontAwesome
                    name="refresh"
                    size={14}
                    color={irrigationMode === "automatic" ? "#fff" : colors.dark}
                  />
                  <Text
                    style={[
                      styles.modeOptionText,
                      irrigationMode === "automatic" &&
                        styles.modeOptionTextActive,
                    ]}
                  >
                    Automatic
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modeOption,
                    irrigationMode === "manual" && styles.modeOptionActive,
                  ]}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (isAutoEnabled) {
                      Alert.alert(
                        "Turn off automatic mode?",
                        "Automatic mode is currently ON. Turn it off to use manual controls.",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Turn off & switch",
                            style: "destructive",
                            onPress: () => {
                              void applyAutoIrrigationMode(false);
                              setIrrigationMode("manual");
                            },
                          },
                        ],
                      );
                      return;
                    }
                    setIrrigationMode("manual");
                  }}
                >
                  <FontAwesome
                    name="hand-paper-o"
                    size={14}
                    color={irrigationMode === "manual" ? "#fff" : colors.dark}
                  />
                  <Text
                    style={[
                      styles.modeOptionText,
                      irrigationMode === "manual" && styles.modeOptionTextActive,
                    ]}
                  >
                    Manual
                  </Text>
                </TouchableOpacity>
              </View>

              {irrigationMode === "automatic" ? (
                <View style={styles.automaticCard}>
                  <View style={styles.automaticHeader}>
                    <Text style={styles.automaticTitle}>Automatic irrigation</Text>
                    <TouchableOpacity
                      style={[
                        styles.autoToggle,
                        isAutoEnabled ? styles.autoToggleOn : styles.autoToggleOff,
                      ]}
                      activeOpacity={0.85}
                      disabled={!system || sending || !supportsAutoModeColumn}
                      onPress={() => {
                        if (!system) return;
                        const next = !isAutoEnabled;
                        Alert.alert(
                          next ? "Turn ON automatic irrigation?" : "Turn OFF automatic irrigation?",
                          next
                            ? "When ON, the pump is triggered by soil moisture thresholds set on the hardware."
                            : "Turning OFF returns control to Manual mode.",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: next ? "Turn on" : "Turn off",
                              style: next ? "default" : "destructive",
                              onPress: () => void applyAutoIrrigationMode(next),
                            },
                          ],
                        );
                      }}
                    >
                      <FontAwesome
                        name={isAutoEnabled ? "toggle-on" : "toggle-off"}
                        size={22}
                        color={isAutoEnabled ? colors.success : colors.grayText}
                      />
                      <Text style={styles.autoToggleText}>
                        {supportsAutoModeColumn
                          ? isAutoEnabled
                            ? "ON"
                            : "OFF"
                          : "Setup"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.automaticMetaRow}>
                    <Text style={styles.automaticMeta}>
                      Status: {isAutoEnabled ? "Active" : "Inactive"}
                    </Text>
                    <Text style={styles.automaticMeta}>
                      Thresholds: Dry &gt; 500, Wet &lt; 300
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.buttonRow}>
                  {/* Start Button */}
                  <TouchableOpacity
                    style={[
                      styles.controlButton,
                      styles.startButton,
                      isRunning && styles.startButtonDisabled,
                    ]}
                    onPress={handleStart}
                    activeOpacity={isRunning ? 1 : 0.8}
                    disabled={isRunning || sending || !system || activeMode === "automatic"}
                  >
                    <FontAwesome
                      name="play"
                      size={14}
                      color={isRunning ? colors.grayText : "#fff"}
                    />
                    <Text
                      style={[
                        styles.controlButtonText,
                        isRunning
                          ? styles.controlButtonTextDisabled
                          : styles.startButtonText,
                      ]}
                    >
                      Start
                    </Text>
                  </TouchableOpacity>

                  {/* Stop Button */}
                  <TouchableOpacity
                    style={[
                      styles.controlButton,
                      styles.stopButton,
                      !isRunning && styles.stopButtonDisabled,
                    ]}
                    onPress={handleStop}
                    activeOpacity={!isRunning ? 1 : 0.8}
                    disabled={
                      !isRunning || sending || !system || activeMode === "automatic"
                    }
                  >
                    <FontAwesome
                      name="stop"
                      size={14}
                      color={!isRunning ? colors.grayText : colors.danger}
                    />
                    <Text
                      style={[
                        styles.controlButtonText,
                        !isRunning
                          ? styles.controlButtonTextDisabled
                          : styles.stopButtonText,
                      ]}
                    >
                      Stop
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Areas List */}
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {areas.map((area) => (
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
                      <FontAwesome
                        name="tint"
                        size={14}
                        color={colors.grayText}
                      />
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
                      {area.status === "active" && (
                        <View style={styles.dotsContainer}>
                          {[...Array(Math.floor(area.progress / 8))].map(
                            (_, i) => (
                              <View key={i} style={styles.dot} />
                            ),
                          )}
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
                      <FontAwesome
                        name="cog"
                        size={14}
                        color={colors.grayText}
                      />
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
                <Text style={styles.footerStatValue}>
                  {isRunning ? "1.2 L/min" : "0 L/min"}
                </Text>
              </View>
              <View style={styles.footerDivider} />
              <View style={styles.footerStat}>
                <Text style={styles.footerStatLabel}>Active Zones</Text>
                <Text style={styles.footerStatValue}>
                  {isRunning ? "1/1" : "0/1"}
                </Text>
              </View>
              <View style={styles.footerDivider} />
              <View style={styles.footerStat}>
                <Text style={styles.footerStatLabel}>Today Usage</Text>
                <Text style={styles.footerStatValue}>45 L</Text>
              </View>
            </View>
          </>
        )}
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
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: fonts.medium,
    color: colors.grayText,
    fontSize: fontScale(14),
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
  placeholder: {
    width: 32,
  },

  // ── Controls ──
  controlsContainer: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayBorder,
    gap: 12,
  },
  modeSelector: {
    flexDirection: "row",
    gap: 10,
  },
  modeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.grayBorder,
    backgroundColor: "#fff",
  },
  modeOptionActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  modeOptionText: {
    fontFamily: fonts.semibold,
    fontSize: fontScale(13),
    color: colors.dark,
  },
  modeOptionTextActive: {
    color: "#fff",
  },
  automaticCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.grayBorder,
    padding: 12,
    backgroundColor: "#F8FAFC",
    gap: 10,
  },
  automaticHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  automaticTitle: {
    fontFamily: fonts.bold,
    fontSize: fontScale(14),
    color: colors.dark,
  },
  autoToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  autoToggleOn: {
    backgroundColor: "#ECFDF5",
    borderColor: "#86EFAC",
  },
  autoToggleOff: {
    backgroundColor: "#F1F5F9",
    borderColor: colors.grayBorder,
  },
  autoToggleText: {
    fontFamily: fonts.bold,
    fontSize: fontScale(12),
    color: colors.dark,
    letterSpacing: 0.6,
  },
  automaticMetaRow: {
    gap: 4,
  },
  automaticMeta: {
    fontFamily: fonts.regular,
    fontSize: fontScale(12),
    color: colors.grayText,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusPulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pulseActive: {
    backgroundColor: colors.success,
  },
  pulseIdle: {
    backgroundColor: colors.grayText,
  },
  statusLabel: {
    fontFamily: fonts.medium,
    fontSize: fontScale(13),
    color: colors.dark,
  },
  modeChip: {
    marginLeft: "auto",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  modeChipAuto: {
    backgroundColor: "#ECFEFF",
    borderColor: "#67E8F9",
  },
  modeChipManual: {
    backgroundColor: "#F3F4F6",
    borderColor: colors.grayBorder,
  },
  modeChipText: {
    fontFamily: fonts.semibold,
    fontSize: fontScale(11),
    color: colors.dark,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  controlButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  startButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  startButtonDisabled: {
    backgroundColor: colors.grayLight,
    borderColor: colors.grayBorder,
  },
  stopButton: {
    backgroundColor: "#FEF2F2",
    borderColor: colors.danger,
  },
  stopButtonDisabled: {
    backgroundColor: colors.grayLight,
    borderColor: colors.grayBorder,
  },
  controlButtonText: {
    fontFamily: fonts.semibold,
    fontSize: fontScale(14),
  },
  startButtonText: {
    color: "#fff",
  },
  stopButtonText: {
    color: colors.danger,
  },
  controlButtonTextDisabled: {
    color: colors.grayText,
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