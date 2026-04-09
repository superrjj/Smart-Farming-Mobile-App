import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { WebView } from 'react-native-webview';

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
  if (data.length < 2) {
    return (
      <View style={styles.chartShell}>
        <View
          style={{
            height: 160,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 13,
              color: colors.subText,
            }}>
            Not enough data points
          </Text>
        </View>
      </View>
    );
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: transparent; }
      </style>
    </head>
    <body>
      <div style="position:relative; width:100%; height:160px;">
        <canvas id="c"></canvas>
      </div>
      <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
      <script>
        new Chart(document.getElementById('c'), {
          type: 'line',
          data: {
            labels: ${JSON.stringify(data.map((_, i) => i + 1))},
            datasets: [{
              data: ${JSON.stringify(data)},
              borderColor: '${color}',
              borderWidth: 2.5,
              pointRadius: 0,
              tension: 0.35,
              fill: false
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: {
                min: 0,
                max: 100,
                ticks: {
                  stepSize: 20,
                  color: '#64748B',
                  font: { size: 11 },
                  callback: function(v) { return v + '%'; }
                },
                grid: {
                  color: 'rgba(100,116,139,0.2)',
                  lineWidth: 1
                },
                border: { dash: [4, 4], display: false }
              },
              x: {
                ticks: {
                  maxTicksLimit: 5,
                  color: '#64748B',
                  font: { size: 10 },
                  maxRotation: 0
                },
                grid: {
                  color: 'rgba(100,116,139,0.1)',
                  lineWidth: 1
                },
                border: { display: false }
              }
            }
          }
        });
      </script>
    </body>
    </html>
  `;

  return (
    <View style={[styles.chartShell, { height: 160 }]}>
      <WebView
        source={{ html }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        scrollEnabled={false}
        javaScriptEnabled={true}
        originWhitelist={['*']}
      />
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

function formatPHTime(isoString: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(isoString));
}

export default function HumidityScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [trendData, setTrendData] = useState<number[]>([]);
  const [currentValue, setCurrentValue] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    fetchSensorData();
  }, []);

  const fetchSensorData = async () => {
    try {
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
        setLastUpdated(data[0].timestamp);
      }
    } catch (error) {
      console.error('Error fetching humidity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatus = (val: number) => {
    if (val < 30) return 'Low';
    if (val <= 50) return 'Ideal';
    if (val <= 60) return 'Moderate';
    if (val <= 70) return 'High';
    return 'Severe';
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
            {lastUpdated && (
              <View style={styles.lastUpdatedRow}>
                <FontAwesome name="clock-o" size={11} color={colors.subText} />
                <Text style={styles.lastUpdatedText}>
                  Last updated: {formatPHTime(lastUpdated)}
                </Text>
              </View>
            )}
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
                <Text style={styles.metricLabel}>Ideal range</Text>
                <Text style={styles.metricValue}>30 - 50%</Text>
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
  lastUpdatedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  lastUpdatedText: { fontFamily: fonts.regular, fontSize: 11, color: colors.subText },
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
