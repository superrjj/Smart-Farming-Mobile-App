import { fontScale, scale } from "@/lib/responsive";
import { setFirstLaunchComplete } from "@/lib/storage";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const colors = {
  brandGreen: "#3E9B4F",
  brandBlue: "#007AFF",
  textDark: "#111827",
  textMuted: "#6B7280",
  dotInactive: "#E5E7EB",
};

const fonts = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semibold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
};

export default function WelcomeScreen() {
  const router = useRouter();

  // Mark first launch as complete when component mounts
  useEffect(() => {
    const markFirstLaunchComplete = async () => {
      try {
        await setFirstLaunchComplete();
      } catch (error) {
        console.error("Error marking first launch complete:", error);
      }
    };
    markFirstLaunchComplete();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.illustrationWrapper}>
          <Image
            source={require("@/assets/welcome-screen.png")}
            style={styles.illustration}
            resizeMode="contain"
          />
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>Welcome to AgriHydra</Text>
          <Text style={styles.subtitle}>
            Smart irrigation and monitoring for string bean farmers. Track
            schedules, water usage, and farm conditions — all in one place.
          </Text>

          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.loginButton}
            onPress={() => router.push("/UserManagement/login")}
          >
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push("/UserManagement/signup")}
          >
            <Text style={styles.createAccountText}>Create an account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  illustrationWrapper: {
    flex: 1.1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  illustration: {
    width: "90%",
    height: "90%",
  },
  content: {
    flex: 0.9,
    paddingHorizontal: 8,
    paddingBottom: 8,
    justifyContent: "flex-start",
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontScale(24),
    color: colors.textDark,
    textAlign: "center",
    marginBottom: scale(8),
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontScale(14),
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: scale(20),
    marginBottom: scale(20),
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginBottom: scale(24),
  },
  dot: {
    width: scale(7),
    height: scale(7),
    borderRadius: 999,
    backgroundColor: colors.dotInactive,
  },
  dotActive: {
    width: scale(18),
    borderRadius: 999,
    backgroundColor: colors.brandGreen,
  },
  loginButton: {
    backgroundColor: colors.brandGreen,
    borderRadius: 12,
    paddingVertical: scale(14),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: scale(14),
  },
  loginButtonText: {
    fontFamily: fonts.semibold,
    fontSize: fontScale(16),
    color: "#ffffff",
  },
  createAccountText: {
    fontFamily: fonts.medium,
    fontSize: fontScale(16),
    color: colors.brandBlue,
    textAlign: "center",
  },
});
