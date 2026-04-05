import { FontAwesome } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const colors = {
  primary: "#22C55E",
  grayText: "#94A3B8",
  grayBorder: "#E2E8F0",
  dark: "#0F172A",
  white: "#FFFFFF",
};

const fonts = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semibold: "Poppins_600SemiBold",
};

export default function SettingsScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === "string" ? params.email : "";
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <FontAwesome name="chevron-left" size={18} color={colors.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() =>
              router.push({
                pathname: "/UserManagement/farmerProfile",
                params: { email },
              })
            }
          >
            <FontAwesome name="user" size={20} color={colors.primary} />
            <Text style={styles.menuLabel}>Profile</Text>
            <FontAwesome
              name="chevron-right"
              size={14}
              color={colors.grayText}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() =>
              router.push({
                pathname: "/UserManagement/sensorDevice",
                params: { email },
              })
            }
          >
            <FontAwesome name="microchip" size={20} color={colors.primary} />
            <Text style={styles.menuLabel}>Sensor Device</Text>
            <FontAwesome
              name="chevron-right"
              size={14}
              color={colors.grayText}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayBorder,
  },
  backButton: { padding: 8 },
  headerTitle: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.dark,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.grayBorder,
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayBorder,
  },
  menuLabel: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.dark,
  },
});
