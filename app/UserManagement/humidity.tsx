import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { supabase } from '@/lib/supabase';

const colors = {
  primary: '#0EA5E9',
  primaryDark: '#0284C7',
  accent: '#22C55E',
  text: '#0F172A',
  subText: '#64748B',
  card: '#FFFFFF',
  bg: '#F8FAFC',
  border: '#E2E8F0',
};

const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
};

function LineChart({ data, color }: { data: number[]; color: string }) {
  const { points } = useMemo(() => {
    const w = 240;
    const h = 120;
    if (data.length === 0) return { points: '' };
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = Math.max(1, max - min);
    const stepX = data.length > 1 ? w / (data.length - 1) : 0;
    const pts = data
      .map((v, idx) => {
        const x = idx * stepX;
        const y = h - ((v - min) / range) * h;
        return `${x},${y}`;
      })
      .join(' ');
    return { points: pts };
  }, [data]);

  return (
    <View style={styles.chartShell}>
      <Svg height="140" width="100%" viewBox="0 0 240 140">
        <Polyline points={points} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function GaugeRing({ percent, label }: { percent: number; label: string }) {
  const size = 110;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (percent / 100) * circumference;

  return (
    <View style={styles.gaugeShell}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.border}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.primary}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.gaugeCenter}>
        <Text style={styles.gaugeValue}>{percent}%</Text>
        <Text style={styles.gaugeLabel}>{label}</Text>
      </View>
    </View>
  );
}

export default function HumidityScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [trendData, setTrendData] = useState<number[]>([]);
  const [currentValue, setCurrentValue] = useState<number | null>(null);

  useEffect(() => {
    fetchSensorData();
  }, []);

  const fetchSensorData = async () => {
    try {
      // Fetch latest readings for humidity (sensor_id = 2)
      const { data, error } = await supabase
        .from('sensor_reading')
        .select('value, timestamp')
        .eq('sensor_id', 2)
        .order('timestamp', { ascending: false })
        .limit(7);

      if (error) {
        console.error('Error fetching humidity data:', error);
        return;
      }

      if (data && data.length > 0) {
        const reversed = [...data].reverse();
        setTrendData(reversed.map(d => d.value));
        setCurrentValue(data[0].value);
      }
    } catch (error) {
      console.error('Error fetching humidity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatus = (val: number) => {
    if (val >= 60 && val <= 80) return 'Optimal';
    if (val < 60) return 'Low';
    return 'High';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading sensor data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome name="chevron-left" size={18} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>HUMIDITY</Text>
          
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* Overview card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Today trend</Text>
              <Text style={styles.cardPill}>Live</Text>
            </View>
            {trendData.length > 0 ? (
              <LineChart data={trendData} color={colors.primary} />
            ) : (
              <Text style={styles.noDataText}>No trend data available</Text>
            )}
            <View style={styles.metricsRow}>
              <View>
                <Text style={styles.metricLabel}>Current</Text>
                <Text style={styles.metricValue}>
                  {currentValue !== null ? `${currentValue}%` : '--'}
                </Text>
              </View>
              <View>
                <Text style={styles.metricLabel}>Optimal range</Text>
                <Text style={styles.metricValue}>60 - 80%</Text>
              </View>
            </View>
          </View>

          {/* Latest reading card */}
          {currentValue !== null && (
            <View style={styles.areaCard}>
              <View style={styles.areaHeader}>
                <Text style={styles.areaName}>Latest Reading</Text>
              </View>
              <GaugeRing percent={Math.round(currentValue)} label="Humidity" />
              <View style={styles.areaFooter}>
                <Text style={styles.areaFootLabel}>Status</Text>
                <Text style={styles.areaFootValue}>{getStatus(currentValue)}</Text>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontFamily: fonts.medium, fontSize: 16, color: colors.subText },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  backButton: { padding: 6 },
  titleWrap: { flex: 1, marginLeft: 8 },
  title: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, letterSpacing: 0.4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 14 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  cardPill: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.primaryDark,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  chartShell: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 8,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.subText },
  metricValue: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, marginTop: 2 },
  noDataText: { fontFamily: fonts.regular, fontSize: 14, color: colors.subText, textAlign: 'center', paddingVertical: 20 },
  areaCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  areaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  areaName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  gaugeShell: { alignItems: 'center', justifyContent: 'center' },
  gaugeCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  gaugeValue: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  gaugeLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.subText },
  areaFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  areaFootLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.subText },
  areaFootValue: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primaryDark },
});
