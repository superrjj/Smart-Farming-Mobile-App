import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

const colors = {
  primary: '#22C55E',
  grayText: '#94A3B8',
  grayBorder: '#E2E8F0',
  dark: '#0F172A',
  white: '#FFFFFF',
};

const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
};

export default function IrrigationHistoryScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('irrigation_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setLogs(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="chevron-left" size={18} color={colors.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Historical Irrigation & Water Logging</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {logs.length === 0 ? (
            <View style={styles.emptyState}>
              <FontAwesome name="folder-open" size={48} color={colors.grayText} />
              <Text style={styles.emptyTitle}>No irrigation logs yet</Text>
              <Text style={styles.emptyText}>
                Irrigation events will appear here once the system records activity.
              </Text>
            </View>
          ) : (
            logs.map((log, i) => (
              <View key={log.id || i} style={styles.logCard}>
                <Text style={styles.logDate}>
                  {log.created_at
                    ? new Date(log.created_at).toLocaleString()
                    : 'N/A'}
                </Text>
                <Text style={styles.logDetail}>
                  Duration: {log.duration_minutes ?? '—'} min
                </Text>
                <Text style={styles.logDetail}>
                  Volume: {log.volume_liters ?? '—'} L
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayBorder,
  },
  backButton: { padding: 8 },
  headerTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.dark,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.dark,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.grayText,
    textAlign: 'center',
  },
  logCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.grayBorder,
  },
  logDate: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.dark,
  },
  logDetail: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.grayText,
    marginTop: 4,
  },
});
