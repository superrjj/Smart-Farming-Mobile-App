import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from "@expo-google-fonts/poppins";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import "react-native-reanimated";

import { AlertOverrideProvider } from "@/components/alert-override-provider";
import { useColorScheme } from "@/hooks/use-color-scheme";

// ── inline color hook ────────────────────────────────────────────────────────
const lightColors = {
  background: "#ffffff",
  surfaceMuted: "#f5f5f5",
  border: "#e0e0e0",
  subText: "#888888",
  text: "#1a1a1a",
  primary: "#4f46e5",
  surface: "#ffffff",
};

const darkColors = {
  background: "#0f0f0f",
  surfaceMuted: "#1c1c1e",
  border: "#2c2c2e",
  subText: "#8e8e93",
  text: "#f2f2f7",
  primary: "#6366f1",
  surface: "#1c1c1e",
};

function useAppColors() {
  const colorScheme = useColorScheme();
  return colorScheme === "dark" ? darkColors : lightColors;
}
// ────────────────────────────────────────────────────────────────────────────

SplashScreen.preventAutoHideAsync().catch(() => {});

export const unstable_settings = {
  initialRouteName: "index",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const appColors = useAppColors();
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <AlertOverrideProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <View
          style={[styles.container, { backgroundColor: appColors.background }]}
        >
          <View style={styles.stackWrapper}>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen
                name="UserManagement"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="modal"
                options={{ presentation: "modal", title: "Modal" }}
              />
            </Stack>
          </View>

          <View
            style={[
              styles.footer,
              {
                backgroundColor: appColors.surfaceMuted,
                borderTopColor: appColors.border,
              },
            ]}
          >
            <Text style={[styles.footerText, { color: appColors.subText }]}>
              Contact Us: Dev Harvee
            </Text>
          </View>

          <StatusBar
            style={colorScheme === "dark" ? "light" : "dark"}
            backgroundColor={
              colorScheme === "dark" ? appColors.background : "#ffffff"
            }
          />
        </View>
      </ThemeProvider>
    </AlertOverrideProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  stackWrapper: { flex: 1 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    textAlign: "center",
  },
});
