import { FontAwesome } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "@/lib/supabase";

const colors = {
  brandGreen: "#22C55E",
  brandBlue: "#3B82F6",
  brandGrayText: "#6B7280",
  brandGrayBorder: "#E5E7EB",
  cardBg: "#F9FAFB",
  orange: "#F97316",
  purple: "#A855F7",
  red: "#EF4444",
};

const fonts = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semibold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
};

interface SensorDevice {
  id: string;
  farm_id: string;
  sensor_type: string;
  serial_number: string;
  installation_date: string;
  last_calibration_date: string;
  status: boolean;
}

const SENSOR_TYPES = ["Soil Moisture", "Temperature", "Humidity"] as const;

const SERIAL_MIN_LEN = 3;
const SERIAL_MAX_LEN = 32;
const SERIAL_ALLOWED = /^[A-Za-z0-9_-]+$/;

export default function SensorDeviceScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === "string" ? params.email : "";
  const router = useRouter();

  const [devices, setDevices] = useState<SensorDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [sensorTypePickerVisible, setSensorTypePickerVisible] = useState(false);
  const [newDevice, setNewDevice] = useState({
    sensor_type: "",
    serial_number: "",
  });
  const [saving, setSaving] = useState(false);
  const [farmId, setFarmId] = useState<string | null>(null);

  useEffect(() => {
    fetchFarmAndDevices();
  }, [email]);

  const fetchFarmAndDevices = async () => {
    try {
      // STEP 1: Get user's UUID from user_profiles
      console.log("Fetching user profile for email:", email);
      const { data: userData, error: userError } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("email", email)
        .single();

      if (userError || !userData) {
        console.error("Error fetching user:", userError);
        Alert.alert(
          "Profile Incomplete",
          "Your profile could not be found. Please complete your profile before proceeding.",
        );
        setLoading(false);
        return;
      }

      console.log("Found user_id:", userData.id);

      // STEP 2: Get farm using owner_id (same as user_profiles.id)
      const { data: farmData, error: farmError } = await supabase
        .from("farm")
        .select("id")
        .eq("owner_id", userData.id)
        .maybeSingle();

      if (farmError) {
        console.error("Error fetching farm:", farmError);
        Alert.alert(
          "Farm Load Failed",
          "Unable to load your farm information. Please check your connection and try again.",
        );
        setLoading(false);
        return;
      }

      if (!farmData?.id) {
        Alert.alert(
          "Farm Not Set Up",
          "You haven't set up your farm yet. Please complete your farm information in your profile before proceeding.",
        );
        setLoading(false);
        return;
      }

      console.log("Found farm_id:", farmData.id);
      setFarmId(farmData.id);

      // STEP 3: Fetch devices for this farm
      const { data: devicesData, error: devicesError } = await supabase
        .from("sensor_device")
        .select("*")
        .eq("farm_id", farmData.id)
        .order("installation_date", { ascending: false });

      if (devicesError) {
        console.error("Error fetching devices:", devicesError);
        Alert.alert(
          "Sensor Load Failedr",
          "Unable to load your sensor devices. Please check your connection and try again.",
        );
        return;
      }

      console.log("Found devices:", devicesData?.length || 0);
      setDevices(devicesData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      Alert.alert(
        "Data Load Failed",
        "Unable to load the requested data. Please check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddDevice = async () => {
    if (!farmId) {
      Alert.alert(
        "Farm Not Set Up",
        "You haven't set up your farm yet. Please complete your farm information in your profile before proceeding.",
      );
      return;
    }

    const sensorType = newDevice.sensor_type.trim();
    const serial = newDevice.serial_number.trim();

    if (!sensorType) {
      Alert.alert(
        "Sensor Type Required",
        "Please choose a sensor type to continue.",
      );
      return;
    }

    if (!serial) {
      Alert.alert(
        "Serial Number Required",
        "Please enter the serial number to continue.",
      );
      return;
    }

    if (serial.length < SERIAL_MIN_LEN || serial.length > SERIAL_MAX_LEN) {
      Alert.alert(
        "Invalid Serial Number",
        `Serial number must be ${SERIAL_MIN_LEN}–${SERIAL_MAX_LEN} characters.`,
      );
      return;
    }

    if (!SERIAL_ALLOWED.test(serial)) {
      Alert.alert(
        "Invalid Serial Number",
        "Only letters, numbers, hyphen (-), and underscore (_) are allowed (no spaces).",
      );
      return;
    }

    setSaving(true);
    try {
      // Prevent duplicates within the same farm (best UX; DB may also enforce uniqueness)
      const { data: existingDevice, error: existingError } = await supabase
        .from("sensor_device")
        .select("id")
        .eq("farm_id", farmId)
        .ilike("serial_number", serial)
        .maybeSingle();

      if (existingError) {
        console.error("Error checking serial number:", existingError);
        Alert.alert(
          "Validation Failed",
          "Unable to validate the serial number. Please try again.",
        );
        return;
      }

      if (existingDevice?.id) {
        Alert.alert(
          "Serial Number Already Registered",
          "This serial number is already registered for your farm. Please check the serial number and try again.",
        );
        return;
      }

      const { data, error } = await supabase
        .from("sensor_device")
        .insert({
          farm_id: farmId,
          sensor_type: sensorType,
          serial_number: serial,
          installation_date: new Date().toISOString().split("T")[0],
          last_calibration_date: new Date().toISOString().split("T")[0],
          status: true,
        })
        .select()
        .single();

      if (error) {
        console.error("Error adding device:", error);
        Alert.alert(
          "Device Add Failed",
          "Unable to add the device. Please try again or contact support if the issue persists.",
        );
        return;
      }

      setDevices([data, ...devices]);
      setNewDevice({ sensor_type: "", serial_number: "" });
      setModalVisible(false);
      setSensorTypePickerVisible(false);
      Alert.alert("Device Added", "The device has been added successfully.");
    } catch (error) {
      console.error("Error adding device:", error);
      Alert.alert(
        "Device Add Failed",
        "Unable to add the device. Please try again or contact support if the issue persists.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    try {
      const { error } = await supabase
        .from("sensor_device")
        .delete()
        .eq("id", deviceId);

      if (error) {
        console.error("Error deleting device:", error);
        Alert.alert(
          "Device Deletion Failed",
          "Unable to delete the device. Please try again or contact support if the issue persists.",
        );
        return;
      }

      // Remove the device from the local state
      setDevices(devices.filter((device) => device.id !== deviceId));
      Alert.alert(
        "Device Deleted",
        "The device has been deleted successfully.",
      );
    } catch (error) {
      console.error("Error deleting device:", error);
      Alert.alert(
        "Device Deletion Failed",
        "Unable to delete the device. Please try again or contact support if the issue persists.",
      );
    }
  };

  const getStatusColor = (status: boolean) => {
    return status ? colors.brandGreen : colors.brandGrayText;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brandBlue} />
          <Text style={styles.loadingText}>Loading sensor devices...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <FontAwesome name="arrow-left" size={20} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sensor Devices</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Info banner if no farm */}
          {!farmId && (
            <View style={styles.infoBanner}>
              <FontAwesome
                name="info-circle"
                size={20}
                color={colors.brandBlue}
              />
              <Text style={styles.infoBannerText}>
                Please set up your farm information in your profile first to add
                sensor devices.
              </Text>
            </View>
          )}

          {/* Add Device Button */}
          {farmId && (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setModalVisible(true)}
            >
              <FontAwesome name="plus" size={18} color="#fff" />
              <Text style={styles.addButtonText}>Add New Device</Text>
            </TouchableOpacity>
          )}

          {/* Devices List */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Registered Devices</Text>

            {devices.length === 0 ? (
              <View style={styles.emptyState}>
                <FontAwesome
                  name="microchip"
                  size={48}
                  color={colors.brandGrayText}
                />
                <Text style={styles.emptyStateText}>
                  No devices registered yet
                </Text>
                <Text style={styles.emptyStateSubText}>
                  {farmId
                    ? "Add your first sensor device to get started"
                    : "Set up your farm information first to add devices"}
                </Text>
              </View>
            ) : (
              devices.map((device) => (
                <View key={device.id} style={styles.deviceItem}>
                  <View style={styles.deviceHeader}>
                    <View style={styles.deviceInfo}>
                      <Text style={styles.deviceName}>
                        {device.sensor_type}
                      </Text>
                      <Text style={styles.deviceId}>
                        Serial Number: {device.serial_number}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(device.status) },
                      ]}
                    >
                      <Text style={styles.statusText}>
                        {device.status ? "ACTIVE" : "INACTIVE"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.deviceDetails}>
                    <View style={styles.detailRow}>
                      <FontAwesome
                        name="tag"
                        size={14}
                        color={colors.brandGrayText}
                      />
                      <Text style={styles.detailLabel}>Type:</Text>
                      <Text style={styles.detailValue}>
                        {device.sensor_type}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <FontAwesome
                        name="calendar"
                        size={14}
                        color={colors.brandGrayText}
                      />
                      <Text style={styles.detailLabel}>Installed:</Text>
                      <Text style={styles.detailValue}>
                        {device.installation_date}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <FontAwesome
                        name="clock-o"
                        size={14}
                        color={colors.brandGrayText}
                      />
                      <Text style={styles.detailLabel}>Last Calibration:</Text>
                      <Text style={styles.detailValue}>
                        {device.last_calibration_date}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteDevice(device.id)}
                    >
                      <FontAwesome name="trash" size={16} color={colors.red} />
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.cardTitle}>Register New Device</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Sensor Type</Text>
              <TouchableOpacity
                style={styles.dropdown}
                onPress={() => setSensorTypePickerVisible(true)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.dropdownText,
                    !newDevice.sensor_type && styles.dropdownPlaceholder,
                  ]}
                >
                  {newDevice.sensor_type || "Select sensor type"}
                </Text>
                <FontAwesome
                  name="chevron-down"
                  size={14}
                  color={colors.brandGrayText}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Serial Number</Text>
              <TextInput
                style={styles.input}
                value={newDevice.serial_number}
                onChangeText={(text) =>
                  setNewDevice({ ...newDevice, serial_number: text })
                }
                placeholder="Enter serial number"
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <Text style={styles.helperText}>
                Use {SERIAL_MIN_LEN}–{SERIAL_MAX_LEN} characters: letters/numbers,
                hyphen (-), underscore (_). No spaces.
              </Text>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  setSensorTypePickerVisible(false);
                  setNewDevice({ sensor_type: "", serial_number: "" });
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleAddDevice}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Add Device</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sensor type picker */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={sensorTypePickerVisible}
        onRequestClose={() => setSensorTypePickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setSensorTypePickerVisible(false)}
        >
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Select Sensor Type</Text>
            {SENSOR_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.pickerOption,
                  newDevice.sensor_type === t && styles.pickerOptionActive,
                ]}
                onPress={() => {
                  setNewDevice({ ...newDevice, sensor_type: t });
                  setSensorTypePickerVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.pickerOptionText,
                    newDevice.sensor_type === t && styles.pickerOptionTextActive,
                  ]}
                >
                  {t}
                </Text>
                {newDevice.sensor_type === t && (
                  <FontAwesome
                    name="check"
                    size={14}
                    color={colors.brandBlue}
                  />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.pickerCancel}
              onPress={() => setSensorTypePickerVisible(false)}
            >
              <Text style={styles.pickerCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.brandGrayText,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.brandGrayBorder,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: "#000",
  },
  headerRight: {
    width: 28,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  infoBanner: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  infoBannerText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: "#1E40AF",
    lineHeight: 20,
  },
  addButton: {
    backgroundColor: colors.brandGreen,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: "#fff",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: "#1F2937",
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.brandGrayBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: "#1F2937",
    backgroundColor: "#fff",
  },
  helperText: {
    marginTop: 6,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.brandGrayText,
    lineHeight: 16,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: colors.brandGrayBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
  },
  dropdownText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: "#1F2937",
  },
  dropdownPlaceholder: {
    color: colors.brandGrayText,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: colors.brandGrayBorder,
  },
  cancelButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: "#1F2937",
  },
  saveButton: {
    backgroundColor: colors.brandBlue,
  },
  saveButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: "#fff",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyStateText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: "#1F2937",
    marginTop: 12,
  },
  emptyStateSubText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.brandGrayText,
    marginTop: 4,
    textAlign: "center",
  },
  deviceItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.brandGrayBorder,
  },
  deviceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: "#1F2937",
  },
  deviceId: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.brandGrayText,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    color: "#fff",
  },
  deviceDetails: {
    gap: 4,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.brandGrayText,
    minWidth: 60,
  },
  detailValue: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: "#1F2937",
    flex: 1,
  },
  deleteButton: {
    backgroundColor: colors.red,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 8,
  },
  deleteButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: "#fff",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "90%",
    maxWidth: 340,
  },
  pickerOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    padding: 16,
  },
  pickerCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
  },
  pickerTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: "#111827",
    marginBottom: 10,
  },
  pickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.brandGrayBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  pickerOptionActive: {
    borderColor: colors.brandBlue,
    backgroundColor: "#EFF6FF",
  },
  pickerOptionText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: "#111827",
  },
  pickerOptionTextActive: {
    color: colors.brandBlue,
  },
  pickerCancel: {
    marginTop: 2,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: colors.brandGrayBorder,
  },
  pickerCancelText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: "#111827",
  },
});
