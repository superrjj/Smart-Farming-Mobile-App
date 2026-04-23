import { isAdminRole } from "@/lib/isAdminRole";
import {
  getExpoPushToken,
  scheduleAdminRemarkNotification,
} from "@/lib/notifications";
import { clearAllStorage, getLoggedInEmail } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { AdminAccessDeniedModal } from "@/components/admin-access-denied-modal";
import { Stack, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  AppState,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type RecoPopup = { title: string; message: string } | null;
type NetworkErrorPopup = { title: string; message: string } | null;
type RemarkPayload = {
  date_key?: string | null;
  text?: string | null;
};

function parseDateKey(
  dateKey?: string | null,
): { year: number; month: number; day: number } | null {
  if (!dateKey) return null;
  const [yearRaw, monthRaw, dayRaw] = dateKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null;
  }
  return { year, month, day };
}

export default function UserManagementLayout() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [popup, setPopup] = useState<RecoPopup>(null);
  const [networkError, setNetworkError] = useState<NetworkErrorPopup>(null);
  const [adminDeniedVisible, setAdminDeniedVisible] = useState(false);
  const adminRoleGuardCooldownRef = useRef(0);
  const appStateRef = useRef(AppState.currentState);
  const scheduleIdsRef = useRef<string[]>([]);
  const showNetworkError = (message: string) => {
    setNetworkError({
      title: "Network Failed",
      message,
    });
  };

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const email = await getLoggedInEmail();
        if (!email) return;
        setUserEmail(email);
        const { data, error } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();
        if (error) {
          showNetworkError(
            "Unable to load your account details. Please check your internet connection and try again.",
          );
          return;
        }
        if (data?.id) setUserId(data.id);
      } catch {
        showNetworkError(
          "Unable to connect to the server. Please check your internet connection and try again.",
        );
      }
    };
    void loadUser();
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const loadScheduleIds = async () => {
      const { data, error } = await supabase
        .from("irrigation_schedules")
        .select("id")
        .eq("user_id", userId);
      if (error || cancelled) {
        if (error && !cancelled) {
          showNetworkError(
            "Unable to load your irrigation schedules right now. Please try again later.",
          );
        }
        return;
      }
      scheduleIdsRef.current = (data ?? []).map((row) => String(row.id));
    };

    void loadScheduleIds();

    void (async () => {
      const token = await getExpoPushToken();
      if (!token || !userEmail || cancelled) return;
      const { error } = await supabase.functions.invoke("register-push-token", {
        body: {
          userId,
          email: userEmail,
          token,
          platform: "expo",
        },
      });
      if (error) {
        showNetworkError(
          "Unable to register push notifications right now. Please check your internet connection and try again.",
        );
      }
    })();

    const channel = supabase
      .channel(`um-global-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const row = payload.new as {
            type?: string;
            title?: string;
            message?: string;
          };
          if (row.type !== "recommendation") return;
          const title = row.title ?? "New Recommendation";
          const message = row.message ?? "";
          if (appStateRef.current === "active") {
            setPopup({ title, message });
          } else {
            try {
              const Notifications = await import("expo-notifications");
              const { status } = await Notifications.getPermissionsAsync();
              if (status === "granted") {
                await Notifications.scheduleNotificationAsync({
                  content: { title, body: message, sound: true },
                  trigger: {
                    type: Notifications.SchedulableTriggerInputTypes
                      .TIME_INTERVAL,
                    seconds: 1,
                  },
                });
              }
            } catch {
              // Keep app stable if notifications are unavailable (e.g. Expo Go)
            }
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      scheduleIdsRef.current = [];
      void supabase.removeChannel(channel);
    };
  }, [userEmail, userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`um-role-guard-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_profiles",
          filter: `id=eq.${userId}`,
        },
        async (payload) => {
          const row = payload.new as { role?: unknown };
          if (!isAdminRole(row.role)) return;
          const now = Date.now();
          if (now - adminRoleGuardCooldownRef.current < 3000) return;
          adminRoleGuardCooldownRef.current = now;
          try {
            await clearAllStorage();
          } catch {
            // ignore storage failures; still redirect
          }
          setAdminDeniedVisible(true);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router, userId]);

  useEffect(() => {
    if (!adminDeniedVisible) return;
    const timer = setTimeout(() => {
      setAdminDeniedVisible(false);
      router.replace({
        pathname: "/UserManagement/login",
        params: { blocked: "admin" },
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [adminDeniedVisible, router]);

  useEffect(() => {
    if (!userId) return;

    const notifyForRemark = async (row: RemarkPayload) => {
      const parsed = parseDateKey(row.date_key);
      if (!parsed) return;
      const scheduleIds = scheduleIdsRef.current;
      if (scheduleIds.length === 0) return;

      const { data, error } = await supabase
        .from("irrigation_scheduled_dates")
        .select("id")
        .in("schedule_id", scheduleIds)
        .eq("year", parsed.year)
        .eq("month", parsed.month)
        .eq("day", parsed.day)
        .limit(1);

      if (error) {
        showNetworkError(
          "Unable to sync irrigation remarks right now. Please check your connection and try again.",
        );
        return;
      }
      if (!data || data.length === 0) return;

      const title = "Admin Remark";
      const body = row.text ?? "";
      if (!body) return;

      // Always schedule a push so admin remarks behave like notification events
      // even when the app is currently open.
      void scheduleAdminRemarkNotification(body, row.date_key);

      if (appStateRef.current === "active") {
        setPopup({ title, message: body });
      }
    };

    const channel = supabase
      .channel(`um-admin-remarks-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "irrigation_remarks",
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as RemarkPayload;
          void notifyForRemark(row);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "irrigation_schedules",
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          const { data, error } = await supabase
            .from("irrigation_schedules")
            .select("id")
            .eq("user_id", userId);
          if (error) {
            showNetworkError(
              "Unable to refresh irrigation schedules. Please check your internet connection and try again.",
            );
            return;
          }
          scheduleIdsRef.current = (data ?? []).map((row) => String(row.id));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="splashScreen"
          options={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="welcomeScreen"
          options={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="login"
          options={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="signup"
          options={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen name="dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="weatherUpdate" options={{ headerShown: false }} />
        <Stack.Screen
          name="waterDistribution"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="irrigationSchedule"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="waterRequirement"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="irrigationHistory"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="historyIrrigationLogging"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="monitoringAdjustments"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="patternAnalyzer" options={{ headerShown: false }} />
        <Stack.Screen name="seasonalSummary" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
      </Stack>

      <Modal
        visible={!!popup}
        transparent
        animationType="fade"
        onRequestClose={() => setPopup(null)}
      >
        <View style={styles.popupBackdrop}>
          <View style={styles.popupCard}>
            <Text style={styles.popupTitle}>
              {popup?.title ?? "Recommendation"}
            </Text>
            <Text style={styles.popupMessage}>{popup?.message ?? ""}</Text>
            <TouchableOpacity
              style={styles.okButton}
              onPress={() => setPopup(null)}
            >
              <Text style={styles.okText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <AdminAccessDeniedModal
        visible={adminDeniedVisible}
        onDismiss={() => setAdminDeniedVisible(false)}
      />

      <Modal
        visible={!!networkError}
        transparent
        animationType="fade"
        onRequestClose={() => setNetworkError(null)}
      >
        <View style={styles.popupBackdrop}>
          <View style={styles.popupCard}>
            <Text style={styles.popupTitle}>
              {networkError?.title ?? "Network Failed"}
            </Text>
            <Text style={styles.popupMessage}>{networkError?.message ?? ""}</Text>
            <TouchableOpacity
              style={styles.okButton}
              onPress={() => setNetworkError(null)}
            >
              <Text style={styles.okText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  popupBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  popupCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
  },
  popupTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  popupMessage: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  okButton: {
    alignSelf: "flex-end",
    marginTop: 14,
    borderRadius: 8,
    backgroundColor: "#007AFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  okText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
});
