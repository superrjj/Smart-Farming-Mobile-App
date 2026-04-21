import { isAdminRole } from "@/lib/isAdminRole";
import { scheduleAdminRemarkNotification } from "@/lib/notifications";
import { clearAllStorage, getLoggedInEmail } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
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
  const [popup, setPopup] = useState<RecoPopup>(null);
  const appStateRef = useRef(AppState.currentState);
  const scheduleIdsRef = useRef<string[]>([]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      const email = await getLoggedInEmail();
      if (!email) return;
      const { data } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (data?.id) setUserId(data.id);
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
      if (error || cancelled) return;
      scheduleIdsRef.current = (data ?? []).map((row) => String(row.id));
    };

    void loadScheduleIds();

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
  }, [userId]);

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
          try {
            await clearAllStorage();
          } catch {
            // ignore storage failures; still redirect
          }
          router.replace({
            pathname: "/UserManagement/login",
            params: { blocked: "admin" },
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router, userId]);

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

      if (error || !data || data.length === 0) return;

      const title = "Admin Remark";
      const body = row.text ?? "";
      if (!body) return;
      if (appStateRef.current === "active") {
        setPopup({ title, message: body });
        return;
      }

      try {
        await scheduleAdminRemarkNotification(body, row.date_key);
      } catch {
        // Keep app stable if notifications are unavailable (e.g. Expo Go)
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
          if (!error) {
            scheduleIdsRef.current = (data ?? []).map((row) => String(row.id));
          }
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
