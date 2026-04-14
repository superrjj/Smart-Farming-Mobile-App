import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

// ── Constants ─────────────────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get("window");

const IDEAL = {
  tempMin: 18,
  tempMax: 30,
  humMin: 55,
  humMax: 75,
  rainMin: 20,
  rainMax: 100,
};

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// ── Colors & Fonts ────────────────────────────────────────────────────────────
const colors = {
  primary: "#3B82F6",
  emerald: "#10B981",
  orange: "#F97316",
  amber: "#F59E0B",
  red: "#EF4444",
  cyan: "#06B6D4",
  grayText: "#94A3B8",
  grayBorder: "#E2E8F0",
  dark: "#0F172A",
  white: "#FFFFFF",
  surface: "#F8FAFC",
};

const fonts = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semibold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface MonthlyRecord {
  month: string;
  shortLabel: string;
  avgTemp: number;
  avgHumidity: number;
  totalRainfall: number;
  avgWind: number;
  growScore: number;
  dataPoints: number;
  isPartial: boolean;
}

// ── Score helpers ─────────────────────────────────────────────────────────────
const computeScore = (temp: number, hum: number, rain: number): number => {
  let score = 100;
  if (temp > IDEAL.tempMax) score -= Math.min(40, (temp - IDEAL.tempMax) * 6);
  if (temp < IDEAL.tempMin) score -= Math.min(40, (IDEAL.tempMin - temp) * 6);
  if (hum > IDEAL.humMax) score -= Math.min(30, (hum - IDEAL.humMax) * 1.5);
  if (hum < IDEAL.humMin) score -= Math.min(30, (IDEAL.humMin - hum) * 1.5);
  if (rain > IDEAL.rainMax)
    score -= Math.min(30, (rain - IDEAL.rainMax) * 0.15);
  if (rain < IDEAL.rainMin) score -= Math.min(20, (IDEAL.rainMin - rain) * 0.5);
  return Math.max(0, Math.round(score));
};

const getScoreStyle = (score: number) => {
  if (score >= 80)
    return {
      label: "Excellent",
      color: colors.emerald,
      bg: "#F0FDF4",
      border: "#86EFAC",
    };
  if (score >= 65)
    return {
      label: "Good",
      color: colors.primary,
      bg: "#EFF6FF",
      border: "#93C5FD",
    };
  if (score >= 50)
    return {
      label: "Fair",
      color: colors.amber,
      bg: "#FFFBEB",
      border: "#FCD34D",
    };
  return { label: "Poor", color: colors.red, bg: "#FEF2F2", border: "#FCA5A5" };
};

// ── Data fetch ────────────────────────────────────────────────────────────────
const fetchHistoricalData = async (
  lat: number,
  lon: number,
): Promise<MonthlyRecord[]> => {
  const today = new Date();
  const endDate = today.toISOString().split("T")[0];
  const twoYearsAgo = new Date(today);
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  twoYearsAgo.setDate(1);
  const startDate = twoYearsAgo.toISOString().split("T")[0];

  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_mean,relative_humidity_2m_mean,precipitation_sum,wind_speed_10m_max&timezone=Asia%2FManila`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  const json = await res.json();
  const {
    time,
    temperature_2m_mean,
    relative_humidity_2m_mean,
    precipitation_sum,
    wind_speed_10m_max,
  } = json.daily;

  const grouped: Record<
    string,
    { temps: number[]; hums: number[]; rains: number[]; winds: number[] }
  > = {};
  const currentKey = new Date().toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  time.forEach((dateStr: string, i: number) => {
    const key = new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
    if (!grouped[key])
      grouped[key] = { temps: [], hums: [], rains: [], winds: [] };
    if (temperature_2m_mean[i] != null)
      grouped[key].temps.push(temperature_2m_mean[i]);
    if (relative_humidity_2m_mean[i] != null)
      grouped[key].hums.push(relative_humidity_2m_mean[i]);
    if (precipitation_sum[i] != null)
      grouped[key].rains.push(precipitation_sum[i]);
    if (wind_speed_10m_max[i] != null)
      grouped[key].winds.push(wind_speed_10m_max[i]);
  });

  return Object.entries(grouped).map(([key, vals]) => {
    const avg = (arr: number[]) =>
      arr.length
        ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
        : 0;
    const sum = (arr: number[]) =>
      Math.round(arr.reduce((a, b) => a + b, 0) * 10) / 10;
    const avgTemp = avg(vals.temps);
    const avgHumidity = avg(vals.hums);
    const totalRainfall = sum(vals.rains);
    const avgWind = avg(vals.winds);
    return {
      month: key,
      shortLabel: key.split(" ")[0],
      avgTemp,
      avgHumidity,
      totalRainfall,
      avgWind,
      growScore: computeScore(avgTemp, avgHumidity, totalRainfall),
      dataPoints: vals.temps.length,
      isPartial: key === currentKey,
    };
  });
};

// ── Insights ──────────────────────────────────────────────────────────────────
const deriveInsights = (data: MonthlyRecord[]) => {
  if (!data.length) return [];
  const complete = data.filter((d) => !d.isPartial);
  const avgScore = Math.round(
    complete.reduce((s, d) => s + d.growScore, 0) / complete.length,
  );
  const excellentMonths = complete.filter((d) => d.growScore >= 80);
  const poorMonths = complete.filter((d) => d.growScore < 50);
  const highRainMonths = complete.filter(
    (d) => d.totalRainfall > IDEAL.rainMax,
  );
  const highHumMonths = complete.filter((d) => d.avgHumidity > IDEAL.humMax);
  const hotMonths = complete.filter((d) => d.avgTemp > IDEAL.tempMax);

  const scoreByName: Record<string, number[]> = {};
  complete.forEach((d) => {
    const n = d.month.split(" ")[0];
    if (!scoreByName[n]) scoreByName[n] = [];
    scoreByName[n].push(d.growScore);
  });
  const avgByName = Object.entries(scoreByName).map(([name, scores]) => ({
    name,
    avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
  }));
  const bestSeason = avgByName.length
    ? avgByName.reduce((a, b) => (a.avg > b.avg ? a : b), avgByName[0])
    : null;
  const worstSeason = avgByName.length
    ? avgByName.reduce((a, b) => (a.avg < b.avg ? a : b), avgByName[0])
    : null;

  const ins: { icon: string; text: string }[] = [];
  if (avgScore >= 70)
    ins.push({
      icon: "🌱",
      text: `This location is well-suited for string beans. 2-year avg score: ${avgScore}/100.`,
    });
  else if (avgScore >= 55)
    ins.push({
      icon: "⚠️",
      text: `Moderately suitable. Avg score: ${avgScore}/100. Active management needed in off-peak months.`,
    });
  else
    ins.push({
      icon: "❌",
      text: `Significant challenges. Avg score: ${avgScore}/100. Protective structures may be needed.`,
    });

  if (excellentMonths.length) {
    const names = [
      ...new Set(excellentMonths.map((d) => d.month.split(" ")[0])),
    ].join(", ");
    ins.push({
      icon: "📅",
      text: `Optimal planting window: ${names}. These months consistently scored 80+.`,
    });
  }
  if (bestSeason && worstSeason && bestSeason.name !== worstSeason.name)
    ins.push({
      icon: "🔄",
      text: `${bestSeason.name} is historically strongest (avg ${bestSeason.avg}/100). ${worstSeason.name} is weakest (avg ${worstSeason.avg}/100).`,
    });
  if (highRainMonths.length >= 3)
    ins.push({
      icon: "🌧️",
      text: `${highRainMonths.length} months exceeded 100mm rainfall. Raised beds and drainage channels recommended.`,
    });
  if (highHumMonths.length >= 4)
    ins.push({
      icon: "💧",
      text: `${highHumMonths.length} months above 75% humidity. Wider row spacing and good airflow recommended.`,
    });
  if (hotMonths.length >= 2)
    ins.push({
      icon: "🌡️",
      text: `Heat stress affects ${hotMonths.length} months per cycle. Early morning irrigation and shade netting advised.`,
    });
  if (poorMonths.length) {
    const names = [
      ...new Set(poorMonths.map((d) => d.month.split(" ")[0])),
    ].join(", ");
    ins.push({
      icon: "🚫",
      text: `Avoid planting in: ${names}. High crop failure risk. Use for soil preparation instead.`,
    });
  }
  return ins;
};

const deriveMonthReco = (record: MonthlyRecord, yearData: MonthlyRecord[]) => {
  const score = record.growScore;
  let verdict: { icon: string; title: string; desc: string };
  if (score >= 80)
    verdict = {
      icon: "✅",
      title: "Recommended to Plant",
      desc: `${record.month} is excellent (${score}/100). Conditions are well within ideal range.`,
    };
  else if (score >= 65)
    verdict = {
      icon: "💡",
      title: "Good — Minor Adjustments Needed",
      desc: `${record.month} is mostly favorable (${score}/100) but may need slight adjustments.`,
    };
  else if (score >= 50)
    verdict = {
      icon: "⚠️",
      title: "Fair — Plant with Caution",
      desc: `${record.month} is marginal (${score}/100). Yields possible but risk is elevated.`,
    };
  else
    verdict = {
      icon: "❌",
      title: "Not Recommended",
      desc: `${record.month} presents poor conditions (${score}/100). High risk of crop failure.`,
    };

  const flags: { icon: string; text: string }[] = [];
  if (record.avgTemp > IDEAL.tempMax)
    flags.push({
      icon: "🌡️",
      text: `High temp (${record.avgTemp}°C) — irrigate early morning to reduce heat stress.`,
    });
  if (record.avgTemp < IDEAL.tempMin)
    flags.push({
      icon: "❄️",
      text: `Low temp (${record.avgTemp}°C) — consider row covers to retain soil warmth.`,
    });
  if (record.avgHumidity > IDEAL.humMax)
    flags.push({
      icon: "💧",
      text: `High humidity (${record.avgHumidity}%) — widen row spacing for better airflow.`,
    });
  if (record.avgHumidity < IDEAL.humMin)
    flags.push({
      icon: "🌬️",
      text: `Low humidity (${record.avgHumidity}%) — mulch heavily and irrigate more often.`,
    });
  if (record.totalRainfall > IDEAL.rainMax)
    flags.push({
      icon: "🌧️",
      text: `Heavy rainfall (${record.totalRainfall}mm) — use raised beds and clear drainage channels.`,
    });
  if (record.totalRainfall < IDEAL.rainMin)
    flags.push({
      icon: "💦",
      text: `Low rainfall (${record.totalRainfall}mm) — supplement with 20–25mm/week irrigation.`,
    });
  if (record.avgWind >= 30)
    flags.push({
      icon: "🌀",
      text: `Strong winds (${record.avgWind} km/h) — install windbreaks or trellises.`,
    });

  const alternatives = yearData
    .filter((d) => d.month !== record.month && !d.isPartial)
    .sort((a, b) => b.growScore - a.growScore)
    .slice(0, 2);

  return { verdict, flags, alternatives };
};

// ── Sub-components ────────────────────────────────────────────────────────────
const ScoreBarChart = ({
  data,
  selectedMonth,
  onSelectMonth,
}: {
  data: MonthlyRecord[];
  selectedMonth: string;
  onSelectMonth: (m: string) => void;
}) => {
  const BAR_AREA_H = 80;
  const BAR_W = Math.max(28, (SCREEN_W - 64) / Math.max(data.length, 1));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          height: BAR_AREA_H + 40,
          gap: 4,
          paddingHorizontal: 4,
        }}
      >
        {data.map((m, i) => {
          const s = getScoreStyle(m.growScore);
          const isSelected = selectedMonth === m.shortLabel;
          const barH = Math.max(2, (m.growScore / 100) * BAR_AREA_H);
          return (
            <Pressable
              key={i}
              onPress={() => onSelectMonth(isSelected ? "" : m.shortLabel)}
              style={{ width: BAR_W, alignItems: "center", gap: 2 }}
            >
              {isSelected && (
                <Text
                  style={{
                    fontSize: 9,
                    fontFamily: fonts.bold,
                    color: s.color,
                    marginBottom: 2,
                  }}
                >
                  {m.growScore}
                </Text>
              )}
              <View
                style={{
                  width: "100%",
                  height: BAR_AREA_H,
                  justifyContent: "flex-end",
                }}
              >
                <View
                  style={{
                    width: "100%",
                    height: barH,
                    backgroundColor: s.color,
                    borderRadius: 4,
                    opacity: m.isPartial ? 0.35 : isSelected ? 1 : 0.75,
                    borderWidth: isSelected ? 2 : 0,
                    borderColor: s.border,
                  }}
                />
              </View>
              <Text
                style={{
                  fontSize: 9,
                  fontFamily: fonts.medium,
                  color: colors.grayText,
                }}
              >
                {m.shortLabel}
              </Text>
              {m.isPartial && (
                <Text style={{ fontSize: 8, color: colors.grayText }}>…</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
};

const ScoreBarChartJS = ({
  data,
}: {
  data: MonthlyRecord[];
}) => {
  if (!data.length) return null;
  const labels = data.map((d) => d.shortLabel);
  const values = data.map((d) => d.growScore);
  const colorsByScore = data.map((d) => getScoreStyle(d.growScore).color);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: transparent; }
      </style>
    </head>
    <body>
      <div style="position:relative; width:100%; height:190px;">
        <canvas id="scoreBar"></canvas>
      </div>
      <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
      <script>
        new Chart(document.getElementById('scoreBar'), {
          type: 'bar',
          data: {
            labels: ${JSON.stringify(labels)},
            datasets: [{
              data: ${JSON.stringify(values)},
              backgroundColor: ${JSON.stringify(colorsByScore)},
              borderRadius: 6,
              borderSkipped: false
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => ctx.raw + '%'
                }
              }
            },
            scales: {
              y: {
                min: 0,
                max: 100,
                ticks: {
                  stepSize: 20,
                  color: '#64748B',
                  font: { size: 11 },
                  callback: (v) => v + '%'
                },
                grid: { color: 'rgba(100,116,139,0.2)' },
                border: { display: false }
              },
              x: {
                ticks: {
                  color: '#64748B',
                  font: { size: 10 },
                  maxRotation: 0
                },
                grid: { display: false },
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
    <View style={styles.chartShell}>
      <WebView
        source={{ html }}
        style={{ height: 190, backgroundColor: "transparent" }}
        scrollEnabled={false}
        javaScriptEnabled
        originWhitelist={["*"]}
      />
    </View>
  );
};

const PercentLineChartJS = ({
  labels,
  values,
  color,
}: {
  labels: string[];
  values: number[];
  color: string;
}) => {
  if (!values.length) return null;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: transparent; }
      </style>
    </head>
    <body>
      <div style="position:relative; width:100%; height:165px;">
        <canvas id="percentLine"></canvas>
      </div>
      <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
      <script>
        new Chart(document.getElementById('percentLine'), {
          type: 'line',
          data: {
            labels: ${JSON.stringify(labels)},
            datasets: [{
              data: ${JSON.stringify(values)},
              borderColor: '${color}',
              borderWidth: 2.5,
              pointRadius: 2.5,
              pointHoverRadius: 3,
              tension: 0.35,
              fill: false
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => ctx.raw + '%'
                }
              }
            },
            scales: {
              y: {
                min: 0,
                max: 100,
                ticks: {
                  stepSize: 20,
                  color: '#64748B',
                  font: { size: 11 },
                  callback: (v) => v + '%'
                },
                grid: {
                  color: 'rgba(100,116,139,0.2)',
                  lineWidth: 1
                },
                border: { display: false }
              },
              x: {
                ticks: {
                  maxTicksLimit: 6,
                  color: '#64748B',
                  font: { size: 10 },
                  maxRotation: 0
                },
                grid: { color: 'rgba(100,116,139,0.1)', lineWidth: 1 },
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
    <View style={styles.chartShell}>
      <WebView
        source={{ html }}
        style={{ height: 165, backgroundColor: "transparent" }}
        scrollEnabled={false}
        javaScriptEnabled
        originWhitelist={["*"]}
      />
    </View>
  );
};

const MiniLineChart = ({
  data,
  lineColor,
  height = 80,
  refLines,
}: {
  data: { label: string; value: number | null }[];
  lineColor: string;
  height?: number;
  refLines?: { value: number; color: string }[];
  lineKey?: string;
}) => {
  const W = SCREEN_W - 80;
  const validData = data.filter((d) => d.value != null) as {
    label: string;
    value: number;
  }[];
  if (!validData.length) return null;
  const allValues = [
    ...validData.map((d) => d.value),
    ...(refLines?.map((r) => r.value) ?? []),
  ];
  const maxVal = Math.max(...allValues, 1);
  const minVal = Math.min(...allValues, 0);
  const range = maxVal - minVal || 1;
  const pts = data.map((d, i) => ({
    x: (i / (data.length - 1)) * W,
    y: d.value != null ? height - ((d.value - minVal) / range) * height : null,
  }));

  return (
    <View style={{ height: height + 4, width: W }}>
      {refLines?.map((ref, ri) => {
        const refY = height - ((ref.value - minVal) / range) * height;
        return (
          <View
            key={ri}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: refY,
              height: 1,
              borderTopWidth: 1,
              borderTopColor: ref.color,
              borderStyle: "dashed",
              opacity: 0.6,
            }}
          />
        );
      })}
      {pts.map((pt, i) => {
        if (i === 0 || pt.y == null) return null;
        const prev = pts[i - 1];
        if (prev.y == null) return null;
        const dx = pt.x - prev.x;
        const dy = pt.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left: prev.x,
              top: prev.y,
              width: len,
              height: 2,
              backgroundColor: lineColor,
              transform: [{ rotate: `${angle}deg` }],
              transformOrigin: "left center",
            }}
          />
        );
      })}
      {pts.map((pt, i) =>
        pt.y != null ? (
          <View
            key={i}
            style={{
              position: "absolute",
              left: pt.x - 3,
              top: pt.y - 3,
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: lineColor,
            }}
          />
        ) : null,
      )}
    </View>
  );
};

const MultiLineChart = ({
  data,
  lines,
  height = 120,
  refLines,
}: {
  data: { month: string; [key: string]: any }[];
  lines: { key: string; color: string; label: string }[];
  height?: number;
  refLines?: { value: number; color: string; label: string }[];
}) => {
  const W = SCREEN_W - 80;
  const allValues = [
    ...data.flatMap((d) => lines.map((l) => d[l.key] ?? 0)),
    ...(refLines?.map((r) => r.value) ?? []),
  ];
  const maxVal = Math.max(...allValues, 1);
  const minVal = Math.min(...allValues, 0);
  const range = maxVal - minVal || 1;
  const getY = (val: number | null) =>
    val != null ? height - ((val - minVal) / range) * height : null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View
        style={{ width: Math.max(W, data.length * 36), height: height + 28 }}
      >
        {/* Horizontal grid lines at 25%, 50%, 75%, 100% */}
        {[0.25, 0.5, 0.75, 1].map((pct) => (
          <View
            key={`grid-${pct}`}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: height * (1 - pct),
              height: 1,
              backgroundColor: "#E2E8F0",
            }}
          />
        ))}
        {refLines?.map((ref, ri) => {
          const refY = getY(ref.value);
          if (refY == null) return null;
          return (
            <View
              key={ri}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: refY,
                height: 1,
                borderTopWidth: 1,
                borderTopColor: ref.color,
                borderStyle: "dashed",
                opacity: 0.6,
              }}
            />
          );
        })}
        {lines.map((line) => {
          const chartW = Math.max(W, data.length * 36);
          return data.map((d, i) => {
            if (i === 0) return null;
            const prev = data[i - 1];
            const x1 = ((i - 1) / (data.length - 1)) * chartW;
            const x2 = (i / (data.length - 1)) * chartW;
            const y1 = getY(prev[line.key]);
            const y2 = getY(d[line.key]);
            if (y1 == null || y2 == null) return null;
            const dx = x2 - x1,
              dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            return (
              <View
                key={`${line.key}-${i}`}
                style={{
                  position: "absolute",
                  left: x1,
                  top: y1,
                  width: len,
                  height: 2,
                  backgroundColor: line.color,
                  transform: [{ rotate: `${angle}deg` }],
                  transformOrigin: "left center",
                }}
              />
            );
          });
        })}
        {data.map((d, i) => {
          const chartW = Math.max(W, data.length * 36);
          return (
            <Text
              key={i}
              style={{
                position: "absolute",
                bottom: 0,
                left: (i / (data.length - 1)) * chartW - 12,
                width: 28,
                textAlign: "center",
                fontSize: 8,
                color: colors.grayText,
                fontFamily: fonts.regular,
              }}
            >
              {d.month}
            </Text>
          );
        })}
      </View>
    </ScrollView>
  );
};

const ProgressBar = ({ value, color }: { value: number; color: string }) => (
  <View
    style={{
      height: 6,
      backgroundColor: "#F1F5F9",
      borderRadius: 3,
      overflow: "hidden",
      flex: 1,
    }}
  >
    <View
      style={{
        height: "100%",
        width: `${Math.min(100, value)}%`,
        backgroundColor: color,
        borderRadius: 3,
      }}
    />
  </View>
);

const ScoreBadge = ({ score }: { score: number }) => {
  const s = getScoreStyle(score);
  return (
    <View
      style={{
        backgroundColor: s.bg,
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderWidth: 1,
        borderColor: s.border,
      }}
    >
      <Text
        style={{ fontFamily: fonts.semibold, fontSize: 10, color: s.color }}
      >
        {s.label}
      </Text>
    </View>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function PatternAnalyzerScreen() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [data, setData] = useState<MonthlyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [activeChart, setActiveChart] = useState<
    "score" | "climate" | "rainfall"
  >("score");
  const [coords] = useState({ lat: 15.53, lon: 120.6042 });
  const [location] = useState("Dalayap, Tarlac City");

  const animateIn = () => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  };

  const load = async (lat: number, lon: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchHistoricalData(lat, lon);
      setData(result);
      animateIn();
    } catch {
      setError("Failed to load historical data. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(coords.lat, coords.lon);
  }, []);
  useEffect(() => {
    setSelectedMonth("");
  }, [selectedYear]);

  // Derived
  const yearData = data.filter((d) => d.month.endsWith(String(selectedYear)));
  const complete = yearData.filter((d) => !d.isPartial);
  const best = complete.length
    ? complete.reduce(
        (a, b) => (a.growScore > b.growScore ? a : b),
        complete[0],
      )
    : null;
  const worst = complete.length
    ? complete.reduce(
        (a, b) => (a.growScore < b.growScore ? a : b),
        complete[0],
      )
    : null;
  const avgScore = complete.length
    ? Math.round(
        complete.reduce((s, d) => s + d.growScore, 0) / complete.length,
      )
    : 0;
  const availableYears = [
    ...new Set(data.map((d) => Number(d.month.split(" ")[1]))),
  ].sort((a, b) => b - a);
  const availableMonths = MONTH_NAMES.filter((m) =>
    yearData.some((d) => d.shortLabel === m),
  );
  const selectedRecord = selectedMonth
    ? (yearData.find((d) => d.shortLabel === selectedMonth) ?? null)
    : null;
  const insights = deriveInsights(data);
  const monthReco = selectedRecord
    ? deriveMonthReco(selectedRecord, yearData)
    : null;

  const chartData = yearData.map((d) => ({
    label: d.shortLabel,
    score: d.growScore,
    temp: d.avgTemp,
    humidity: d.avgHumidity,
    rainfall: d.totalRainfall,
  }));

  const avgSStyle = getScoreStyle(avgScore);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <FontAwesome name="chevron-left" size={16} color={colors.dark} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Pattern Analyzer</Text>
          <Text style={styles.headerSub}>
            <FontAwesome name="map-marker" size={10} color={colors.primary} />{" "}
            {location} · String bean cultivation
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>
            Fetching 2 years of historical data…
          </Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            onPress={() => load(coords.lat, coords.lon)}
            style={styles.retryBtn}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Animated.ScrollView
          style={[styles.scroll, { opacity: fadeAnim }]}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Year selector */}
          <View style={styles.controlsRow}>
            <View style={styles.controlPill}>
              <FontAwesome name="calendar" size={11} color={colors.primary} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {availableYears.map((y) => (
                    <TouchableOpacity
                      key={y}
                      onPress={() => setSelectedYear(y)}
                      style={[
                        styles.yearChip,
                        selectedYear === y && styles.yearChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.yearChipText,
                          selectedYear === y && { color: colors.white },
                        ]}
                      >
                        {y}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>

          {/* Month filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -16 }}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
          >
            <TouchableOpacity
              onPress={() => setSelectedMonth("")}
              style={[
                styles.monthChip,
                !selectedMonth && styles.monthChipActive,
              ]}
            >
              <Text
                style={[
                  styles.monthChipText,
                  !selectedMonth && styles.monthChipTextActive,
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            {availableMonths.map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setSelectedMonth(selectedMonth === m ? "" : m)}
                style={[
                  styles.monthChip,
                  selectedMonth === m && styles.monthChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.monthChipText,
                    selectedMonth === m && styles.monthChipTextActive,
                  ]}
                >
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Location & summary */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <FontAwesome name="map-marker" size={12} color={colors.primary} />
              <Text style={styles.summaryLabel}>{location}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <FontAwesome name="bar-chart" size={11} color={avgSStyle.color} />
              <Text style={[styles.summaryValue, { color: avgSStyle.color }]}>
                {avgScore}/100 — {avgSStyle.label}
              </Text>
            </View>
          </View>

          {/* Best / Worst */}
          <View style={styles.bestWorstRow}>
            <View
              style={[
                styles.bestWorstCard,
                {
                  borderColor: colors.emerald + "40",
                  backgroundColor: "#F0FDF4",
                },
              ]}
            >
              <FontAwesome name="arrow-up" size={11} color={colors.emerald} />
              <View>
                <Text style={styles.bwLabel}>Best Month</Text>
                <Text style={[styles.bwValue, { color: colors.emerald }]}>
                  {best?.month ?? "—"}
                </Text>
                {best && <Text style={styles.bwSub}>{best.growScore}/100</Text>}
              </View>
            </View>
            <View
              style={[
                styles.bestWorstCard,
                { borderColor: colors.red + "40", backgroundColor: "#FEF2F2" },
              ]}
            >
              <FontAwesome name="arrow-down" size={11} color={colors.red} />
              <View>
                <Text style={styles.bwLabel}>Worst Month</Text>
                <Text style={[styles.bwValue, { color: colors.red }]}>
                  {worst?.month ?? "—"}
                </Text>
                {worst && (
                  <Text style={styles.bwSub}>{worst.growScore}/100</Text>
                )}
              </View>
            </View>
          </View>

          {/* Monthly Growing Score */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Monthly Growing Score — {selectedYear}
            </Text>
            <Text style={styles.cardSub}>
              Bar chart indicates monthly suitability score (%)
            </Text>
            <ScoreBarChartJS data={yearData} />
            <Text style={[styles.cardSub, { marginTop: 6, marginBottom: 0 }]}>
              Tap a month chip above to inspect details.
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 8,
              }}
            >
              {[
                { c: colors.emerald, l: "80+ Excellent" },
                { c: colors.primary, l: "65–79 Good" },
                { c: colors.amber, l: "50–64 Fair" },
                { c: colors.red, l: "<50 Poor" },
              ].map((x) => (
                <View
                  key={x.l}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      backgroundColor: x.c,
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 9,
                      fontFamily: fonts.regular,
                      color: colors.grayText,
                    }}
                  >
                    {x.l}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Selected month detail */}
          {selectedRecord && (
            <View
              style={[
                styles.card,
                {
                  borderWidth: 2,
                  borderColor: getScoreStyle(selectedRecord.growScore).border,
                  backgroundColor: getScoreStyle(selectedRecord.growScore).bg,
                },
              ]}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 12,
                }}
              >
                <View>
                  <Text style={styles.cardTitle}>
                    {selectedRecord.month}
                    {selectedRecord.isPartial ? " (in progress)" : ""}
                  </Text>
                  <Text style={styles.cardSub}>
                    {selectedRecord.dataPoints} days of data
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text
                    style={[
                      styles.bigScore,
                      { color: getScoreStyle(selectedRecord.growScore).color },
                    ]}
                  >
                    {selectedRecord.growScore}
                  </Text>
                  <ScoreBadge score={selectedRecord.growScore} />
                </View>
              </View>
              <View style={styles.metricsGrid}>
                {[
                  {
                    label: "Avg Temp",
                    value: `${selectedRecord.avgTemp}°C`,
                    ideal: "18–30°C",
                    ok:
                      selectedRecord.avgTemp >= IDEAL.tempMin &&
                      selectedRecord.avgTemp <= IDEAL.tempMax,
                  },
                  {
                    label: "Avg Humidity",
                    value: `${selectedRecord.avgHumidity}%`,
                    ideal: "55–75%",
                    ok:
                      selectedRecord.avgHumidity >= IDEAL.humMin &&
                      selectedRecord.avgHumidity <= IDEAL.humMax,
                  },
                  {
                    label: "Total Rain",
                    value: `${selectedRecord.totalRainfall}mm`,
                    ideal: "20–100mm",
                    ok:
                      selectedRecord.totalRainfall >= IDEAL.rainMin &&
                      selectedRecord.totalRainfall <= IDEAL.rainMax,
                  },
                  {
                    label: "Avg Wind",
                    value: `${selectedRecord.avgWind} km/h`,
                    ideal: "<30 km/h",
                    ok: selectedRecord.avgWind < 30,
                  },
                ].map((s, i) => (
                  <View key={i} style={styles.metricCard}>
                    <Text style={styles.metricLabel}>{s.label}</Text>
                    <Text style={styles.metricValue}>{s.value}</Text>
                    <Text
                      style={{
                        fontSize: 10,
                        color: s.ok ? colors.emerald : colors.red,
                        fontFamily: fonts.regular,
                        marginTop: 2,
                      }}
                    >
                      {s.ok ? "✅" : "⚠️"} {s.ideal}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Recommendations */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recommendations</Text>
            <Text style={styles.cardSub}>
              {monthReco
                ? `Planting assessment for ${selectedMonth} ${selectedYear}`
                : `Derived from ${data.length} months of climate data`}
            </Text>

            {!monthReco ? (
              <View style={{ gap: 10, marginTop: 4 }}>
                {insights.map((obs, i) => (
                  <View key={i} style={styles.insightRow}>
                    <Text style={styles.insightIcon}>{obs.icon}</Text>
                    <Text style={styles.insightText}>{obs.text}</Text>
                  </View>
                ))}
              </View>
            ) : (
              selectedRecord && (
                <View style={{ gap: 12, marginTop: 4 }}>
                  {/* Verdict */}
                  <View
                    style={[
                      styles.verdictCard,
                      {
                        backgroundColor: getScoreStyle(selectedRecord.growScore)
                          .bg,
                        borderColor: getScoreStyle(selectedRecord.growScore)
                          .border,
                      },
                    ]}
                  >
                    <Text style={styles.verdictIcon}>
                      {monthReco.verdict.icon}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.verdictTitle,
                          {
                            color: getScoreStyle(selectedRecord.growScore)
                              .color,
                          },
                        ]}
                      >
                        {monthReco.verdict.title}
                      </Text>
                      <Text style={styles.verdictDesc}>
                        {monthReco.verdict.desc}
                      </Text>
                    </View>
                  </View>

                  {/* Action items */}
                  {monthReco.flags.length > 0 ? (
                    <View style={{ gap: 6 }}>
                      <Text style={styles.sectionLabel}>ACTION ITEMS</Text>
                      {monthReco.flags.map((f, i) => (
                        <View key={i} style={styles.flagRow}>
                          <Text style={styles.flagIcon}>{f.icon}</Text>
                          <Text style={styles.flagText}>{f.text}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.allGoodBox}>
                      <Text style={styles.allGoodText}>
                        ✅ All climate conditions are within ideal range. No
                        corrective actions needed.
                      </Text>
                    </View>
                  )}

                  {/* Alternatives */}
                  {monthReco.alternatives.length > 0 && (
                    <View>
                      <Text style={styles.sectionLabel}>
                        {selectedRecord.growScore >= 80
                          ? `OTHER STRONG MONTHS IN ${selectedYear}`
                          : `BETTER ALTERNATIVES IN ${selectedYear}`}
                      </Text>
                      <View
                        style={{ flexDirection: "row", gap: 10, marginTop: 6 }}
                      >
                        {monthReco.alternatives.map((alt, i) => {
                          const s = getScoreStyle(alt.growScore);
                          return (
                            <TouchableOpacity
                              key={i}
                              onPress={() => setSelectedMonth(alt.shortLabel)}
                              style={[
                                styles.altCard,
                                {
                                  backgroundColor: s.bg,
                                  borderColor: s.border,
                                },
                              ]}
                            >
                              <View
                                style={{
                                  flexDirection: "row",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  marginBottom: 4,
                                }}
                              >
                                <Text style={styles.altMonth}>{alt.month}</Text>
                                <ScoreBadge score={alt.growScore} />
                              </View>
                              <Text
                                style={[styles.altScore, { color: s.color }]}
                              >
                                {alt.growScore}
                                <Text style={styles.altScoreSub}>/100</Text>
                              </Text>
                              <Text style={styles.altMeta}>
                                {alt.avgTemp}°C · {alt.avgHumidity}% ·{" "}
                                {alt.totalRainfall}mm
                              </Text>
                              <Text style={styles.altTap}>Tap to view →</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              )
            )}
          </View>

          {/* Climate Charts */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Climate Charts — {selectedYear}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 12 }}
              contentContainerStyle={{ gap: 6 }}
            >
              {(
                [
                  ["score", "Score"],
                  ["climate", "Temp & Hum"],
                  ["rainfall", "Rainfall"],
                ] as const
              ).map(([tab, lbl]) => (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveChart(tab)}
                  style={[
                    styles.chartTab,
                    activeChart === tab && styles.chartTabActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chartTabText,
                      activeChart === tab && { color: colors.primary },
                    ]}
                  >
                    {lbl}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {activeChart === "score" && (
              <PercentLineChartJS
                labels={chartData.map((d) => d.label)}
                values={chartData.map((d) => d.score)}
                color={colors.emerald}
              />
            )}
            {activeChart === "climate" && (
              <MultiLineChart
                data={chartData.map((d) => ({
                  month: d.label,
                  temp: d.temp,
                  humidity: d.humidity,
                }))}
                lines={[
                  { key: "temp", color: colors.orange, label: "Temp °C" },
                  { key: "humidity", color: colors.cyan, label: "Humidity %" },
                ]}
                height={100}
              />
            )}
            {activeChart === "rainfall" && (
              <MiniLineChart
                data={chartData.map((d) => ({
                  label: d.label,
                  value: d.rainfall,
                }))}
                lineColor={colors.primary}
                height={100}
                refLines={[
                  { value: IDEAL.rainMax, color: colors.red },
                  { value: IDEAL.rainMin, color: colors.emerald },
                ]}
              />
            )}

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 8,
              }}
            >
              {chartData
                .filter((_, i) => i % 2 === 0 || chartData.length <= 6)
                .map((d, i) => (
                  <Text
                    key={i}
                    style={{
                      fontSize: 9,
                      color: colors.grayText,
                      fontFamily: fonts.regular,
                    }}
                  >
                    {d.label}
                  </Text>
                ))}
            </View>

            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 10,
                marginTop: 10,
                borderTopWidth: 1,
                borderTopColor: colors.grayBorder,
                paddingTop: 10,
              }}
            >
              {activeChart === "score" && (
                <>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <View
                      style={{
                        width: 16,
                        height: 2,
                        backgroundColor: colors.emerald,
                      }}
                    />
                    <Text style={styles.legendSmall}>80 = Excellent</Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <View
                      style={{
                        width: 16,
                        height: 2,
                        backgroundColor: colors.primary,
                      }}
                    />
                    <Text style={styles.legendSmall}>65 = Good</Text>
                  </View>
                </>
              )}
              {activeChart === "climate" && (
                <>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <View
                      style={{
                        width: 16,
                        height: 2,
                        backgroundColor: colors.orange,
                      }}
                    />
                    <Text style={styles.legendSmall}>Temp °C</Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <View
                      style={{
                        width: 16,
                        height: 2,
                        backgroundColor: colors.cyan,
                      }}
                    />
                    <Text style={styles.legendSmall}>Humidity %</Text>
                  </View>
                </>
              )}
              {activeChart === "rainfall" && (
                <>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <View
                      style={{
                        width: 16,
                        height: 2,
                        backgroundColor: colors.red,
                      }}
                    />
                    <Text style={styles.legendSmall}>100mm max ideal</Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <View
                      style={{
                        width: 16,
                        height: 2,
                        backgroundColor: colors.emerald,
                      }}
                    />
                    <Text style={styles.legendSmall}>20mm min ideal</Text>
                  </View>
                </>
              )}
            </View>
          </View>

          <View style={{ height: 32 }} />
        </Animated.ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayBorder,
  },
  backButton: { padding: 8 },
  headerTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.dark },
  headerSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.grayText,
    marginTop: 1,
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  loaderText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.grayText,
    textAlign: "center",
  },
  errorBox: {
    margin: 16,
    padding: 16,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.red,
    marginBottom: 10,
  },
  retryBtn: {
    backgroundColor: colors.red,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  retryBtnText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.white,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  controlsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  controlPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.grayBorder,
  },
  yearChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.grayBorder,
    backgroundColor: colors.surface,
  },
  yearChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  yearChipText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.grayText,
  },
  monthChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.grayBorder,
    backgroundColor: colors.white,
  },
  monthChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  monthChipText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.grayText,
  },
  monthChipTextActive: { color: colors.white },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.grayBorder,
    gap: 10,
  },
  summaryItem: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  summaryLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.dark,
    flex: 1,
  },
  summaryValue: { fontFamily: fonts.bold, fontSize: 12 },
  summaryDivider: { width: 1, height: 20, backgroundColor: colors.grayBorder },
  bestWorstRow: { flexDirection: "row", gap: 10 },
  bestWorstCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  bwLabel: { fontFamily: fonts.regular, fontSize: 10, color: colors.grayText },
  bwValue: { fontFamily: fonts.bold, fontSize: 14 },
  bwSub: { fontFamily: fonts.regular, fontSize: 10, color: colors.grayText },
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.grayBorder,
  },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.dark },
  cardSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.grayText,
    marginTop: 2,
    marginBottom: 10,
  },
  bigScore: { fontFamily: fonts.bold, fontSize: 32 },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metricCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
  },
  metricLabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.grayText,
  },
  metricValue: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.dark,
    marginTop: 2,
  },
  insightRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayBorder,
  },
  insightIcon: { fontSize: 16 },
  insightText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: "#475569",
    lineHeight: 18,
  },
  verdictCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 12,
    borderWidth: 2,
    padding: 12,
  },
  verdictIcon: { fontSize: 22 },
  verdictTitle: { fontFamily: fonts.bold, fontSize: 14 },
  verdictDesc: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: "#475569",
    marginTop: 3,
    lineHeight: 18,
  },
  sectionLabel: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    color: colors.grayText,
    letterSpacing: 0.5,
  },
  flagRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    padding: 10,
  },
  flagIcon: { fontSize: 14 },
  flagText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: "#374151",
    lineHeight: 18,
  },
  allGoodBox: { backgroundColor: "#F0FDF4", borderRadius: 8, padding: 10 },
  allGoodText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: "#166534",
    lineHeight: 18,
  },
  altCard: { flex: 1, borderRadius: 12, borderWidth: 2, padding: 10 },
  altMonth: { fontFamily: fonts.bold, fontSize: 12, color: colors.dark },
  altScore: { fontFamily: fonts.bold, fontSize: 24 },
  altScoreSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.grayText,
  },
  altMeta: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.grayText,
    marginTop: 2,
  },
  altTap: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.primary,
    marginTop: 6,
  },
  chartTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
  },
  chartTabActive: { backgroundColor: "#EFF6FF" },
  chartTabText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.grayText,
  },
  legendSmall: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.grayText,
  },
});
