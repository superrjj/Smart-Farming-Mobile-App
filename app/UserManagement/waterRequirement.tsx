import { supabase } from "@/lib/supabase";
import { FontAwesome } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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

export default function WaterRequirementScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === "string" ? params.email : "";
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    const humidityMin = parseValue(requirements.humidityMin, "Humidity minimum");
    if (humidityMin === null) return;
    const humidityMax = parseValue(requirements.humidityMax, "Humidity maximum");
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

    // Validation
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

    if (!userId) {
      Alert.alert("Error", "User not found");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("water_requirements").upsert(
        {
          user_id: userId,
          soil_moisture_min: soilMoistureMin,
          soil_moisture_max: soilMoistureMax,
          temperature_min: temperatureMin,
          temperature_max: temperatureMax,
          humidity_min: humidityMin,
          humidity_max: humidityMax,
          irrigation_duration: irrigationDuration,
          irrigation_frequency: irrigationFrequency,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        },
      );

      if (error) {
        // Check if table doesn't exist
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
  };

  const handleResetToRecommended = () => {
    Alert.alert(
      "Reset to Recommended",
      "Are you sure you want to reset all values to recommended settings for string beans?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          onPress: () => {
            setRequirements({
              soilMoistureMin:
                STRING_BEANS_RECOMMENDATIONS.soilMoisture.min.toString(),
              soilMoistureMax:
                STRING_BEANS_RECOMMENDATIONS.soilMoisture.max.toString(),
              temperatureMin:
                STRING_BEANS_RECOMMENDATIONS.temperature.min.toString(),
              temperatureMax:
                STRING_BEANS_RECOMMENDATIONS.temperature.max.toString(),
              humidityMin: STRING_BEANS_RECOMMENDATIONS.humidity.min.toString(),
              humidityMax: STRING_BEANS_RECOMMENDATIONS.humidity.max.toString(),
              irrigationDuration:
                STRING_BEANS_RECOMMENDATIONS.irrigationDuration.optimal.toString(),
              irrigationFrequency:
                STRING_BEANS_RECOMMENDATIONS.irrigationFrequency.optimal.toString(),
            });
          },
        },
      ],
    );
  };

  const InputField = ({
    label,
    value,
    onChange,
    unit,
    recommended,
    description,
    hint,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    unit: string;
    recommended?: { min: number; max: number; optimal: number };
    description?: string;
    hint: string;
  }) => {
    const parsed = Number(value);
    const isWithinRecommended = recommended
      ? value.trim().length > 0 &&
        !Number.isNaN(parsed) &&
        parsed >= recommended.min &&
        parsed <= recommended.max
      : true;

    return (
      <View style={styles.inputGroup}>
        <View style={styles.inputHeader}>
          <Text style={styles.inputLabel}>{label}</Text>
          {recommended && (
            <View style={styles.recommendedBadge}>
              <Text style={styles.recommendedText}>
                Recommended: {recommended.min}-{recommended.max} {unit}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, !isWithinRecommended && styles.inputWarning]}
            value={value}
            onChangeText={onChange}
            keyboardType="numeric"
            placeholder={hint}
            placeholderTextColor={colors.grayText}
          />
          <Text style={styles.unitText}>{unit}</Text>
        </View>
        {description && (
          <Text style={styles.descriptionText}>{description}</Text>
        )}
        {recommended && !isWithinRecommended && (
          <Text style={styles.warningText}>
            ⚠️ Value outside recommended range
          </Text>
        )}
      </View>
    );
  };

  const RangeInput = ({
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
    recommended?: { min: number; max: number; optimal: number };
    description?: string;
    minHint: string;
    maxHint: string;
  }) => {
    return (
      <View style={styles.rangeGroup}>
        <View style={styles.inputHeader}>
          <Text style={styles.inputLabel}>{label}</Text>
          {recommended && (
            <View style={styles.recommendedBadge}>
              <Text style={styles.recommendedText}>
                Optimal: {recommended.optimal} {unit}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.rangeRow}>
          <View style={styles.rangeInputContainer}>
            <Text style={styles.rangeLabel}>Min</Text>
            <TextInput
              style={styles.rangeInput}
              value={minValue}
              onChangeText={onMinChange}
              keyboardType="numeric"
              placeholder={minHint}
              placeholderTextColor={colors.grayText}
            />
            <Text style={styles.rangeUnit}>{unit}</Text>
          </View>
          <View style={styles.rangeSeparator}>
            <Text style={styles.rangeSeparatorText}>to</Text>
          </View>
          <View style={styles.rangeInputContainer}>
            <Text style={styles.rangeLabel}>Max</Text>
            <TextInput
              style={styles.rangeInput}
              value={maxValue}
              onChangeText={onMaxChange}
              keyboardType="numeric"
              placeholder={maxHint}
              placeholderTextColor={colors.grayText}
            />
            <Text style={styles.rangeUnit}>{unit}</Text>
          </View>
        </View>
        {description && (
          <Text style={styles.descriptionText}>{description}</Text>
        )}
      </View>
    );
  };

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
          <Text style={styles.headerTitle}>Water Requirements</Text>
          <TouchableOpacity
            onPress={handleResetToRecommended}
            style={styles.resetButton}
          >
            <FontAwesome name="refresh" size={18} color={colors.primary} />
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
              hint values as a guide. Recommended ranges are shown for reference.
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
    padding: 8,
  },
  headerTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.dark,
  },
  resetButton: {
    padding: 8,
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
    alignItems: "center",
    gap: 8,
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
    backgroundColor: "#FEF3C7",
  },
  unitText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.grayText,
    minWidth: 60,
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
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    marginBottom: 24,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonIcon: {
    marginRight: 4,
  },
  saveButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.white,
  },
});
