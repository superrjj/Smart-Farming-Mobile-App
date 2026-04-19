import { supabase } from "@/lib/supabase";
import { FontAwesome } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const colors = {
  primary: "#22C55E",
  primaryDark: "#16A34A",
  primaryLight: "#BBF7D0",
  brandBlue: "#3B82F6",
  accent: "#0EA5E9",
  grayText: "#94A3B8",
  grayBorder: "#E2E8F0",
  grayLight: "#F8FAFC",
  dark: "#0F172A",
  white: "#FFFFFF",
  warning: "#F59E0B",
  error: "#EF4444",
};

const fonts = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semibold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
};

// Recommended values for String Beans based on agricultural research
const STRING_BEANS_RECOMMENDATIONS = {
  soilMoisture: {
    min: 60,
    max: 80,
    optimal: 70,
    unit: "%",
    description:
      "String beans thrive in soil moisture between 60-80%. Below 60% may cause stress, above 80% may lead to root rot.",
  },
  temperature: {
    min: 20,
    max: 30,
    optimal: 25,
    unit: "°C",
    description:
      "Optimal temperature range for string beans is 20-30°C. Growth slows below 20°C and heat stress occurs above 30°C.",
  },
  humidity: {
    min: 50,
    max: 70,
    optimal: 60,
    unit: "%",
    description:
      "Relative humidity between 50-70% is ideal for string beans. Too low may cause wilting, too high may promote diseases.",
  },
  irrigationDuration: {
    min: 15,
    max: 30,
    optimal: 20,
    unit: "minutes",
    description:
      "Recommended irrigation duration is 15-30 minutes per session, depending on soil type and weather conditions.",
  },
  irrigationFrequency: {
    min: 1,
    max: 3,
    optimal: 2,
    unit: "times per day",
    description:
      "Water string beans 1-3 times per day during dry season, 1-2 times during wet season.",
  },
};

interface WaterRequirements {
  soilMoistureMin: string;
  soilMoistureMax: string;
  temperatureMin: string;
  temperatureMax: string;
  humidityMin: string;
  humidityMax: string;
  irrigationDuration: string;
  irrigationFrequency: string;
}

type RecommendedRange = { min: number; max: number; optimal: number };

/** Warn when soil / temperature / humidity thresholds fall outside research-based ranges. */
function collectThresholdWarnings(
  soilMoistureMin: number,
  soilMoistureMax: number,
  temperatureMin: number,
  temperatureMax: number,
  humidityMin: number,
  humidityMax: number,
): string[] {
  const lines: string[] = [];
  const sm = STRING_BEANS_RECOMMENDATIONS.soilMoisture;
  const tm = STRING_BEANS_RECOMMENDATIONS.temperature;
  const hm = STRING_BEANS_RECOMMENDATIONS.humidity;
  if (soilMoistureMin < sm.min || soilMoistureMin > sm.max) {
    lines.push(
      `Soil moisture minimum (${soilMoistureMin}%) is outside the recommended ${sm.min}–${sm.max}%.`,
    );
  }
  if (soilMoistureMax < sm.min || soilMoistureMax > sm.max) {
    lines.push(
      `Soil moisture maximum (${soilMoistureMax}%) is outside the recommended ${sm.min}–${sm.max}%.`,
    );
  }
  if (temperatureMin < tm.min || temperatureMin > tm.max) {
    lines.push(
      `Temperature minimum (${temperatureMin}°C) is outside the recommended ${tm.min}–${tm.max}°C.`,
    );
  }
  if (temperatureMax < tm.min || temperatureMax > tm.max) {
    lines.push(
      `Temperature maximum (${temperatureMax}°C) is outside the recommended ${tm.min}–${tm.max}°C.`,
    );
  }
  if (humidityMin < hm.min || humidityMin > hm.max) {
    lines.push(
      `Humidity minimum (${humidityMin}%) is outside the recommended ${hm.min}–${hm.max}%.`,
    );
  }
  if (humidityMax < hm.min || humidityMax > hm.max) {
    lines.push(
      `Humidity maximum (${humidityMax}%) is outside the recommended ${hm.min}–${hm.max}%.`,
    );
  }
  return lines;
}

function InputField({
  label,
  value,
  onChange,
  unit,
  recommended,
  description,
  hint,
  inputStyle,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit: string;
  recommended?: RecommendedRange;
  description?: string;
  hint: string;
  inputStyle?: any;
}) {
  const parsed = Number(value);
  const isWithinRecommended = recommended
    ? value.trim().length > 0 &&
      !Number.isNaN(parsed) &&
      parsed >= recommended.min &&
      parsed <= recommended.max
    : true;
  const hasWarning =
    recommended && value.trim().length > 0 && !Number.isNaN(parsed)
      ? !isWithinRecommended
      : false;

  return (
    <View style={styles.inputGroup}>
      <View style={styles.inputHeader}>
        <Text style={styles.inputLabel}>{label}</Text>
        {recommended && (
          <View style={styles.recommendedBadge}>
            <Text style={styles.recommendedText}>
              {recommended.min}-{recommended.max} {unit}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.inputRow}>
        <TextInput
          style={[
            styles.input,
            inputStyle,
            hasWarning && styles.inputWarning,
          ]}
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          placeholder={hint}
          placeholderTextColor={colors.grayText}
          blurOnSubmit={false}
        />
        <Text style={styles.unitText}>{unit}</Text>
      </View>
      {description && <Text style={styles.descriptionText}>{description}</Text>}
      {hasWarning && recommended && (
        <Text style={styles.warningText}>
          ⚠️ Outside recommended range ({recommended.min}–{recommended.max}
          {unit})
        </Text>
      )}
    </View>
  );
}

function RangeInput({
  label,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  unit,
  recommended,
  description,
  minHint,
  maxHint,
}: {
  label: string;
  minValue: string;
  maxValue: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
  unit: string;
  recommended?: RecommendedRange;
  description?: string;
  minHint: string;
  maxHint: string;
}) {
  const minParsed = Number(minValue.trim());
  const maxParsed = Number(maxValue.trim());
  const minValid =
    minValue.trim().length > 0 && !Number.isNaN(minParsed);
  const maxValid =
    maxValue.trim().length > 0 && !Number.isNaN(maxParsed);

  const orderInvalid =
    minValid && maxValid && minParsed >= maxParsed;

  const minOutOfRecommended =
    recommended &&
    minValid &&
    (minParsed < recommended.min || minParsed > recommended.max);

  const maxOutOfRecommended =
    recommended &&
    maxValid &&
    (maxParsed < recommended.min || maxParsed > recommended.max);

  const showRangeWarning =
    recommended && (minOutOfRecommended || maxOutOfRecommended);

  return (
    <View style={styles.rangeGroup}>
      <View style={styles.inputHeader}>
        <Text style={styles.inputLabel}>{label}</Text>
        {recommended && (
          <View style={styles.recommendedBadge}>
            <Text style={styles.recommendedText}>
              {recommended.min}–{recommended.max} {unit}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.rangeRow}>
        <View style={styles.rangeInputContainer}>
          <Text style={styles.rangeLabel}>Min</Text>
          <TextInput
            style={[
              styles.rangeInput,
              (orderInvalid || minOutOfRecommended) && styles.rangeInputWarning,
            ]}
            value={minValue}
            onChangeText={onMinChange}
            keyboardType="numeric"
            placeholder={minHint}
            placeholderTextColor={colors.grayText}
            blurOnSubmit={false}
          />
          <Text style={styles.rangeUnit}>{unit}</Text>
        </View>
        <View style={styles.rangeSeparator}>
          <Text style={styles.rangeSeparatorText}>to</Text>
        </View>
        <View style={styles.rangeInputContainer}>
          <Text style={styles.rangeLabel}>Max</Text>
          <TextInput
            style={[
              styles.rangeInput,
              (orderInvalid || maxOutOfRecommended) && styles.rangeInputWarning,
            ]}
            value={maxValue}
            onChangeText={onMaxChange}
            keyboardType="numeric"
            placeholder={maxHint}
            placeholderTextColor={colors.grayText}
            blurOnSubmit={false}
          />
          <Text style={styles.rangeUnit}>{unit}</Text>
        </View>
      </View>
      {orderInvalid && (
        <Text style={styles.warningText}>
          ⚠️ Minimum must be less than maximum.
        </Text>
      )}
      {showRangeWarning && recommended && !orderInvalid && (
        <Text style={styles.warningText}>
          ⚠️ One or both values are outside the recommended range (
          {recommended.min}–{recommended.max}
          {unit}).
        </Text>
      )}
      {description && <Text style={styles.descriptionText}>{description}</Text>}
    </View>
  );
}

export default function WaterRequirementScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === "string" ? params.email : "";
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [requirements, setRequirements] = useState<WaterRequirements>({
    soilMoistureMin: "",
    soilMoistureMax: "",
    temperatureMin: "",
    temperatureMax: "",
    humidityMin: "",
    humidityMax: "",
    irrigationDuration: "",
    irrigationFrequency: "",
  });

  useEffect(() => {
    fetchUserAndRequirements();
  }, [email]);

  const fetchUserAndRequirements = async () => {
    if (!email) {
      setLoading(false);
      return;
    }

    try {
      // Get user ID
      const { data: userData, error: userError } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("email", email)
        .single();

      if (userError || !userData) {
        console.error("Error fetching user:", userError);
        setLoading(false);
        return;
      }

      setUserId(userData.id);

      // Fetch existing water requirements
      const { data: requirementsData, error: reqError } = await supabase
        .from("water_requirements")
        .select("*")
        .eq("user_id", userData.id)
        .maybeSingle();

      // Handle table not found error gracefully
      if (reqError) {
        if (
          reqError.code === "PGRST205" ||
          reqError.message?.includes("Could not find the table")
        ) {
          console.log(
            "Water requirements table does not exist yet. Keeping form empty.",
          );
        } else if (reqError.code !== "PGRST116") {
          // PGRST116 means no rows found, which is fine
          console.error("Error fetching requirements:", reqError);
        }
      }

      if (requirementsData) {
        setRequirements({
          soilMoistureMin: requirementsData.soil_moisture_min?.toString() ?? "",
          soilMoistureMax: requirementsData.soil_moisture_max?.toString() ?? "",
          temperatureMin: requirementsData.temperature_min?.toString() ?? "",
          temperatureMax: requirementsData.temperature_max?.toString() ?? "",
          humidityMin: requirementsData.humidity_min?.toString() ?? "",
          humidityMax: requirementsData.humidity_max?.toString() ?? "",
          irrigationDuration:
            requirementsData.irrigation_duration?.toString() ?? "",
          irrigationFrequency:
            requirementsData.irrigation_frequency?.toString() ?? "",
        });
      }
    } catch (error) {
      console.error("Error in fetchUserAndRequirements:", error);
    } finally {
      setLoading(false);
    }
  };

  type WaterRequirementPayload = {
    soilMoistureMin: number;
    soilMoistureMax: number;
    temperatureMin: number;
    temperatureMax: number;
    humidityMin: number;
    humidityMax: number;
    irrigationDuration: number;
    irrigationFrequency: number;
  };

  const persistWaterRequirements = useCallback(
    async (p: WaterRequirementPayload) => {
      if (!userId) {
        Alert.alert("Error", "User not found");
        return;
      }
      setSaving(true);
      try {
        const { error } = await supabase.from("water_requirements").upsert(
          {
            user_id: userId,
            soil_moisture_min: p.soilMoistureMin,
            soil_moisture_max: p.soilMoistureMax,
            temperature_min: p.temperatureMin,
            temperature_max: p.temperatureMax,
            humidity_min: p.humidityMin,
            humidity_max: p.humidityMax,
            irrigation_duration: p.irrigationDuration,
            irrigation_frequency: p.irrigationFrequency,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          },
        );

        if (error) {
          if (
            error.code === "PGRST205" ||
            error.message?.includes("Could not find the table")
          ) {
            Alert.alert(
              "Table Not Found",
              "The water_requirements table does not exist in the database. Please create it first using the SQL script in DATABASE_SCHEMA.md",
              [{ text: "OK" }],
            );
          } else {
            throw error;
          }
          return;
        }

        Alert.alert("Success", "Water requirements saved successfully!", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } catch (error: any) {
        console.error("Error saving requirements:", error);
        Alert.alert(
          "Error",
          error.message || "Failed to save water requirements",
        );
      } finally {
        setSaving(false);
      }
    },
    [userId, router],
  );

  const handleSave = async () => {
    const parseValue = (value: string, label: string): number | null => {
      const trimmed = value.trim();
      if (!trimmed) {
        Alert.alert("Error", `${label} is required`);
        return null;
      }
      const parsed = Number(trimmed);
      if (Number.isNaN(parsed)) {
        Alert.alert("Error", `${label} must be a valid number`);
        return null;
      }
      return parsed;
    };

    const soilMoistureMin = parseValue(
      requirements.soilMoistureMin,
      "Soil moisture minimum",
    );
    if (soilMoistureMin === null) return;
    const soilMoistureMax = parseValue(
      requirements.soilMoistureMax,
      "Soil moisture maximum",
    );
    if (soilMoistureMax === null) return;
    const temperatureMin = parseValue(
      requirements.temperatureMin,
      "Temperature minimum",
    );
    if (temperatureMin === null) return;
    const temperatureMax = parseValue(
      requirements.temperatureMax,
      "Temperature maximum",
    );
    if (temperatureMax === null) return;
    const humidityMin = parseValue(
      requirements.humidityMin,
      "Humidity minimum",
    );
    if (humidityMin === null) return;
    const humidityMax = parseValue(
      requirements.humidityMax,
      "Humidity maximum",
    );
    if (humidityMax === null) return;
    const irrigationDuration = parseValue(
      requirements.irrigationDuration,
      "Irrigation duration",
    );
    if (irrigationDuration === null) return;
    const irrigationFrequency = parseValue(
      requirements.irrigationFrequency,
      "Irrigation frequency",
    );
    if (irrigationFrequency === null) return;

    if (soilMoistureMin >= soilMoistureMax) {
      Alert.alert("Error", "Minimum soil moisture must be less than maximum");
      return;
    }

    if (temperatureMin >= temperatureMax) {
      Alert.alert("Error", "Minimum temperature must be less than maximum");
      return;
    }

    if (humidityMin >= humidityMax) {
      Alert.alert("Error", "Minimum humidity must be less than maximum");
      return;
    }

    if (irrigationDuration < 5 || irrigationDuration > 60) {
      Alert.alert(
        "Error",
        "Irrigation duration must be between 5 and 60 minutes",
      );
      return;
    }

    if (irrigationFrequency < 1 || irrigationFrequency > 5) {
      Alert.alert(
        "Error",
        "Irrigation frequency must be between 1 and 5 times per day",
      );
      return;
    }

    const payload: WaterRequirementPayload = {
      soilMoistureMin,
      soilMoistureMax,
      temperatureMin,
      temperatureMax,
      humidityMin,
      humidityMax,
      irrigationDuration,
      irrigationFrequency,
    };

    const thresholdWarnings = collectThresholdWarnings(
      soilMoistureMin,
      soilMoistureMax,
      temperatureMin,
      temperatureMax,
      humidityMin,
      humidityMax,
    );

    if (thresholdWarnings.length > 0) {
      Alert.alert(
        "Threshold warning",
        `${thresholdWarnings.join("\n\n")}\n\nYou can adjust these values or save anyway.`,
        [
          { text: "Review", style: "cancel" },
          {
            text: "Save anyway",
            onPress: () => {
              void persistWaterRequirements(payload);
            },
          },
        ],
      );
      return;
    }

    await persistWaterRequirements(payload);
  };

  const clearAllRequirementFields = useCallback(() => {
    setRequirements({
      soilMoistureMin: "",
      soilMoistureMax: "",
      temperatureMin: "",
      temperatureMax: "",
      humidityMin: "",
      humidityMax: "",
      irrigationDuration: "",
      irrigationFrequency: "",
    });
    setResetModalVisible(false);
  }, []);

  // InputField and RangeInput are declared at module scope to avoid TextInput
  // focus loss (keyboard dismiss) on each keystroke.

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading water requirements...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <FontAwesome name="chevron-left" size={18} color={colors.dark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Water Requirements
          </Text>
          <TouchableOpacity
            onPress={() => setResetModalVisible(true)}
            style={styles.resetButton}
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel="Clear all fields to enter new water requirements"
          >
            <FontAwesome name="eraser" size={15} color={colors.primary} />
            <Text style={styles.resetButtonLabel}>Clear</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Info Card */}
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <FontAwesome
                name="info-circle"
                size={20}
                color={colors.brandBlue}
              />
              <Text style={styles.infoTitle}>String Beans Requirements</Text>
            </View>
            <Text style={styles.infoText}>
              Set custom thresholds for your crop. Fields are editable and use
              hint values as a guide. Recommended ranges are shown for
              reference.
            </Text>
          </View>

          {/* Soil Moisture Range */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Soil Moisture Threshold</Text>
            <RangeInput
              label="Soil Moisture"
              minValue={requirements.soilMoistureMin}
              maxValue={requirements.soilMoistureMax}
              onMinChange={(value) =>
                setRequirements({ ...requirements, soilMoistureMin: value })
              }
              onMaxChange={(value) =>
                setRequirements({ ...requirements, soilMoistureMax: value })
              }
              unit="%"
              minHint="e.g. 60"
              maxHint="e.g. 80"
              recommended={STRING_BEANS_RECOMMENDATIONS.soilMoisture}
              description={
                STRING_BEANS_RECOMMENDATIONS.soilMoisture.description
              }
            />
          </View>

          {/* Temperature Range */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Temperature Threshold</Text>
            <RangeInput
              label="Temperature"
              minValue={requirements.temperatureMin}
              maxValue={requirements.temperatureMax}
              onMinChange={(value) =>
                setRequirements({ ...requirements, temperatureMin: value })
              }
              onMaxChange={(value) =>
                setRequirements({ ...requirements, temperatureMax: value })
              }
              unit="°C"
              minHint="e.g. 20"
              maxHint="e.g. 30"
              recommended={STRING_BEANS_RECOMMENDATIONS.temperature}
              description={STRING_BEANS_RECOMMENDATIONS.temperature.description}
            />
          </View>

          {/* Humidity Range */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Humidity Threshold</Text>
            <RangeInput
              label="Humidity"
              minValue={requirements.humidityMin}
              maxValue={requirements.humidityMax}
              onMinChange={(value) =>
                setRequirements({ ...requirements, humidityMin: value })
              }
              onMaxChange={(value) =>
                setRequirements({ ...requirements, humidityMax: value })
              }
              unit="%"
              minHint="e.g. 50"
              maxHint="e.g. 70"
              recommended={STRING_BEANS_RECOMMENDATIONS.humidity}
              description={STRING_BEANS_RECOMMENDATIONS.humidity.description}
            />
          </View>

          {/* Irrigation Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Irrigation Settings</Text>
            <InputField
              label="Irrigation Duration"
              value={requirements.irrigationDuration}
              onChange={(value) =>
                setRequirements({ ...requirements, irrigationDuration: value })
              }
              unit="minutes"
              hint="e.g. 20"
              inputStyle={styles.irrigationInput}
              recommended={STRING_BEANS_RECOMMENDATIONS.irrigationDuration}
              description={
                STRING_BEANS_RECOMMENDATIONS.irrigationDuration.description
              }
            />
            <InputField
              label="Irrigation Frequency"
              value={requirements.irrigationFrequency}
              onChange={(value) =>
                setRequirements({ ...requirements, irrigationFrequency: value })
              }
              unit="times/day"
              hint="e.g. 2"
              inputStyle={styles.irrigationInput}
              recommended={STRING_BEANS_RECOMMENDATIONS.irrigationFrequency}
              description={
                STRING_BEANS_RECOMMENDATIONS.irrigationFrequency.description
              }
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <FontAwesome
                  name="check"
                  size={18}
                  color="#fff"
                  style={styles.saveButtonIcon}
                />
                <Text style={styles.saveButtonText}>Save Requirements</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>

        <Modal
          visible={resetModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setResetModalVisible(false)}
        >
          <Pressable
            style={styles.resetModalBackdrop}
            onPress={() => setResetModalVisible(false)}
          >
            <Pressable
              style={styles.resetModalCard}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.resetModalIconWrap}>
                <FontAwesome name="eraser" size={22} color={colors.primary} />
              </View>
              <Text style={styles.resetModalTitle}>Clear all fields?</Text>
              <Text style={styles.resetModalMessage}>
                All values in this form will be cleared so you can enter new water
                requirements. This does not delete saved data until you tap Save.
              </Text>
              <View style={styles.resetModalActions}>
                <TouchableOpacity
                  style={styles.resetModalCancel}
                  onPress={() => setResetModalVisible(false)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.resetModalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.resetModalConfirm}
                  onPress={clearAllRequirementFields}
                  activeOpacity={0.85}
                >
                  <Text style={styles.resetModalConfirmText}>Clear all</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.grayLight,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.grayText,
  },
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
  backButton: {
    width: 40,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.dark,
    textAlign: "center",
    marginHorizontal: 4,
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 8,
    minWidth: 84,
    borderRadius: 10,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  resetButtonLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.primaryDark,
  },
  resetModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  resetModalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
  },
  resetModalIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  resetModalTitle: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    color: colors.dark,
    textAlign: "center",
    marginBottom: 8,
  },
  resetModalMessage: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.grayText,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 4,
  },
  resetModalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  resetModalCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.grayBorder,
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  resetModalCancelText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: "#334155",
  },
  resetModalConfirm: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  resetModalConfirmText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: "#fff",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 28,
  },
  infoCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.brandBlue,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  infoTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.dark,
  },
  infoText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.grayText,
    lineHeight: 18,
  },
  section: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: colors.grayBorder,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.dark,
    marginBottom: 4,
  },
  inputGroup: {
    gap: 8,
  },
  inputHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  inputLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.dark,
  },
  recommendedBadge: {
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  recommendedText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.primaryDark,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    flexWrap: "wrap",
  },
  input: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: colors.grayBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.dark,
    backgroundColor: "#FFFFFF",
  },
  inputWarning: {
    borderColor: colors.warning,
    backgroundColor: "#FFFBEB",
  },
  rangeInputWarning: {
    borderColor: colors.warning,
    backgroundColor: "#FFFBEB",
  },
  unitText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.grayText,
    flexShrink: 1,
    maxWidth: 90,
    textAlign: "right",
    paddingBottom: 12,
  },
  irrigationInput: {
    backgroundColor: "#ECFDF5",
    borderColor: "#BBF7D0",
  },
  descriptionText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.grayText,
    lineHeight: 16,
    marginTop: 4,
  },
  warningText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.warning,
    marginTop: 4,
  },
  rangeGroup: {
    gap: 8,
  },
  rangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rangeInputContainer: {
    flex: 1,
    gap: 4,
  },
  rangeLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.grayText,
  },
  rangeInput: {
    height: 50,
    borderWidth: 1,
    borderColor: colors.grayBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.dark,
    backgroundColor: "#FFFFFF",
  },
  rangeSeparator: {
    paddingTop: 20,
  },
  rangeSeparatorText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.grayText,
  },
  rangeUnit: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.grayText,
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    marginBottom: 5,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonIcon: {
    marginRight: 4,
  },
  saveButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.white,
  },
});
