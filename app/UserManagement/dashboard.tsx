import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

import { supabase } from '@/lib/supabase';
import { clearAllStorage } from '@/lib/storage';

const colors = {
  brandGreen: '#3E9B4F',
  brandBlue: '#007AFF',
  brandGrayText: '#6B7280',
  brandGrayBorder: '#E5E7EB',
  cardBg: '#F9FAFB',
  orange: '#F97316',
  purple: '#A855F7',
};

const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
};

const MENU_ITEMS = [
  { key: 'soil', icon: 'leaf', label: 'Soil Moisture' },
  { key: 'temp', icon: 'thermometer', label: 'Temperature' },
  { key: 'humidity', icon: 'tint', label: 'Humidity' },
  { key: 'weather', icon: 'cloud', label: 'Weather Update' },
  { key: 'water', icon: 'tint', label: 'Water Distribution' },
  { key: 'schedule', icon: 'calendar', label: 'Irrigation Schedule' },
  { key: 'sensor-device', icon: 'microchip', label: 'Sensor Device' },
];

const ANALYTICS_SUB_ITEMS = [
  { key: 'env', label: 'Pattern Analyzer' },
  { key: 'seasonal', label: 'Seasonal Summary' },
];

const DRAWER_WIDTH = Math.min(320, Dimensions.get('window').width * 0.8);

// Circular Gauge Component
interface GaugeProps {
  value: number;
  maxValue: number;
  size?: number;
  strokeWidth?: number;
  gradientColors: string[];
  label: string;
  subLabel: string;
  unit?: string;
  icon?: React.ReactNode;
}

function CircularGauge({
  value,
  maxValue,
  size = 90,
  strokeWidth = 8,
  gradientColors,
  label,
  subLabel,
  unit = '%',
  icon,
}: GaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / maxValue, 1);
  const strokeDashoffset = circumference * (1 - progress * 0.75); // 75% of circle (270 degrees)

  return (
    <View style={gaugeStyles.container}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Defs>
            <SvgLinearGradient id={`grad-${label}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor={gradientColors[0]} />
              <Stop offset="100%" stopColor={gradientColors[1]} />
            </SvgLinearGradient>
          </Defs>
          {/* Background circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#E5E7EB"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * 0.25}
            rotation={135}
            origin={`${size / 2}, ${size / 2}`}
            strokeLinecap="round"
          />
          {/* Progress circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={`url(#grad-${label})`}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            rotation={135}
            origin={`${size / 2}, ${size / 2}`}
            strokeLinecap="round"
          />
        </Svg>
        <View style={gaugeStyles.centerContent}>
          {icon}
          <Text style={gaugeStyles.valueText}>
            {value}
            {unit}
          </Text>
        </View>
      </View>
      <Text style={gaugeStyles.label}>{label}</Text>
      <Text style={gaugeStyles.subLabel}>{subLabel}</Text>
    </View>
  );
}

const gaugeStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
  },
  centerContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  valueText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: '#1F2937',
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#1F2937',
    marginTop: 4,
  },
  subLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.brandGrayText,
  },
});

export default function DashboardScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';
  const router = useRouter();

  // Mock sensor data - replace with real data from Supabase/sensors later
  const soilMoisturePercent = 65;
  const temperatureValue = 24;
  const humidityPercent = 48;
  const systemActive = true;
  const nextSchedule = 'Today, 6:00 PM';

  const [fullName, setFullName] = useState<string>('Farmer');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [loadingName, setLoadingName] = useState<boolean>(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const drawerX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  // Disable Android hardware back when on dashboard (so user can't go back to login)
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        // Returning true tells React Native we've handled the back press
        return true;
      };

      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, []),
  );

  useEffect(() => {
    const fetchProfile = async () => {
      if (!email) {
        setLoadingName(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('name, profile_picture')
          .eq('email', email)
          .maybeSingle();

        if (!error && data) {
          setFullName(data.name || 'Farmer');
          setProfilePicture(data.profile_picture);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoadingName(false);
      }
    };

    fetchProfile();
  }, [email]);

  useEffect(() => {
    Animated.timing(drawerX, {
      toValue: menuOpen ? 0 : -DRAWER_WIDTH,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [menuOpen, drawerX]);

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          setMenuOpen(false);
          setLoggingOut(true);
          try {
            // Clear logged in email but keep remember me credentials if user wants to use them again
            // Note: We're not clearing remember me credentials here, so if user has it checked,
            // they can still auto-login next time. If you want to clear everything on logout,
            // use clearAllStorage() instead.
            await clearAllStorage();
            // Small delay to show loader; navigation time still depends on device/network
            await new Promise(resolve => setTimeout(resolve, 600));
            router.replace('/UserManagement/login');
          } catch (error) {
            console.error('Error during logout:', error);
            // Still navigate to login even if storage clear fails
            router.replace('/UserManagement/login');
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  const handleMenuNavigate = (itemKey: string) => {
    setMenuOpen(false);

    if (itemKey === 'weather') {
      router.push({
        pathname: '/UserManagement/weatherUpdate',
        params: { email },
      });
    } else if (itemKey === 'humidity') {
      router.push({
        pathname: '/UserManagement/humidity',
        params: { email },
      });
    } else if (itemKey === 'temp') {
      router.push({
        pathname: '/UserManagement/temperature',
        params: { email },
      });
    } else if (itemKey === 'soil') {
      router.push({
        pathname: '/UserManagement/soilMoisture',
        params: { email },
      });
    } else if (itemKey === 'water') {
      router.push({
        pathname: '/UserManagement/waterDistribution',
        params: { email },
      });
    } else if (itemKey === 'schedule') {
      router.push({
        pathname: '/UserManagement/irrigationSchedule',
        params: { email },
      });
    } else if (itemKey === 'sensor-device') {
      router.push({
        pathname: '/UserManagement/sensorDevice',
        params: { email },
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top App Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setMenuOpen(true)}>
            <FontAwesome name="bars" size={22} color="#000" />
          </TouchableOpacity>

          <View style={styles.topBarRight}>
            <TouchableOpacity style={styles.iconButton}>
              <FontAwesome name="bell" size={20} color="#000" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Main dashboard content */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>

          {/* System Status Card */}
          <View style={[styles.card, styles.systemCard]}>
            <Text style={styles.systemCardTitle}>System Status</Text>

            <View style={styles.systemHeaderRow}>
              <View style={styles.systemHeaderText}>
                <Text style={styles.greetingText}>
                  Hi, {(() => {
                    const nameParts = fullName.trim().split(/\s+/).filter(part => part.length > 0);
                    if (nameParts.length === 0) return 'Farmer';
                    if (nameParts.length === 1) return nameParts[0];
                    // If 2 or more names, show first two names
                    return `${nameParts[0]} ${nameParts[1]}`;
                  })()}
                </Text>
                <Text style={styles.systemSubtitle}>
                  Your string beans irrigation is{' '}
                  {systemActive ? 'running smoothly.' : 'currently paused.'}
                </Text>
              </View>

              <View style={styles.systemBadge}>
                <View style={[styles.statusIcon, systemActive && styles.statusIconActive]}>
                  <FontAwesome name="check" size={18} color="#fff" />
                </View>
                <Text style={styles.statusBadgeText}>
                  {systemActive ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>

            <View style={styles.scheduleRow}>
              <View>
                <Text style={styles.scheduleLabel}>Next scheduled cycle</Text>
                <Text style={styles.scheduleTime}>{nextSchedule}</Text>
              </View>
              <TouchableOpacity style={styles.pauseButton}>
                <Text style={styles.pauseButtonText}>Pause System</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Field Conditions Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Field Conditions</Text>
            <View style={styles.gaugesRow}>
              <CircularGauge
                value={soilMoisturePercent}
                maxValue={100}
                gradientColors={['#60A5FA', '#3B82F6']}
                label="Soil Moisture"
                subLabel="Optimal"
                icon={<FontAwesome name="tint" size={14} color="#3B82F6" style={{ marginBottom: 2 }} />}
              />
              <CircularGauge
                value={temperatureValue}
                maxValue={50}
                gradientColors={['#FBBF24', '#F97316']}
                label="Temperature"
                subLabel="Mild"
                unit="°C"
                icon={<FontAwesome name="thermometer" size={14} color="#F97316" style={{ marginBottom: 2 }} />}
              />
              <CircularGauge
                value={humidityPercent}
                maxValue={100}
                gradientColors={['#C084FC', '#A855F7']}
                label="Humidity"
                subLabel="Comfortable"
                icon={<FontAwesome name="cloud" size={14} color="#A855F7" style={{ marginBottom: 2 }} />}
              />
            </View>
          </View>

          {/* Irrigation Controls Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Irrigation Controls</Text>
            <View style={styles.controlsRow}>
              <TouchableOpacity style={styles.controlButton}>
                <View style={styles.controlIconCircle}>
                  <FontAwesome name="tint" size={20} color="#6B7280" />
                </View>
                <Text style={styles.controlLabel}>Manual</Text>
                <Text style={styles.controlLabel}>Water</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.controlButton}>
                <View style={styles.controlIconCircle}>
                  <FontAwesome name="cloud" size={20} color="#6B7280" />
                </View>
                <Text style={styles.controlLabel}>Rain Delay</Text>
                <Text style={styles.controlLabel}>(24h)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.controlButton}>
                <View style={styles.controlIconCircle}>
                  <FontAwesome name="th-large" size={20} color="#6B7280" />
                </View>
                <Text style={styles.controlLabel}>View All</Text>
                <Text style={styles.controlLabel}>Zones</Text>
              </TouchableOpacity>
            </View>
          </View>

        </ScrollView>

        {/* Backdrop for drawer */}
        {menuOpen && (
          <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)} />
        )}

        {/* Sliding sidebar menu */}
        <Animated.View
          style={[
            styles.drawer,
            {
              transform: [{ translateX: drawerX }],
            },
          ]}>
          <ScrollView
            contentContainerStyle={styles.drawerContent}
            showsVerticalScrollIndicator={false}>
            {/* User header inside drawer */}
            <View style={styles.userHeader}>
              {profilePicture ? (
                <Image 
                  source={{ uri: profilePicture }} 
                  style={styles.profilePicture}
                  onError={(e) => {
                    console.log('Profile picture failed to load:', profilePicture);
                  }}
                />
              ) : (
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarInitial}>{fullName.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.userInfo}>
                {loadingName ? (
                  <ActivityIndicator size="small" color={colors.brandBlue} />
                ) : (
                  <Text style={styles.userName}>{fullName}</Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.editProfileButton}
                activeOpacity={0.8}
                onPress={() => {
                  setMenuOpen(false);
                  router.push({
                    pathname: '/UserManagement/farmerProfile',
                    params: { email },
                  });
                }}
              >
                <Text style={styles.editProfileText}>Edit Profile</Text>
              </TouchableOpacity>
            </View>

            {/* Main menu + logout */}
            <View style={styles.menuSection}>
              <Text style={styles.menuTitle}>Menu</Text>

              {MENU_ITEMS.map(item => (
                <TouchableOpacity
                  key={item.key}
                  style={styles.menuItem}
                  activeOpacity={0.8}
                  onPress={() => handleMenuNavigate(item.key)}>
                  <View style={styles.menuItemLeft}>
                    <FontAwesome name={item.icon as any} size={18} color={colors.brandBlue} />
                    <Text style={styles.menuItemLabel}>{item.label}</Text>
                  </View>
                  <FontAwesome name="chevron-right" size={14} color={colors.brandGrayText} />
                </TouchableOpacity>
              ))}

              {/* Analytics & Reporting */}
              <TouchableOpacity
                style={styles.analyticsHeader}
                activeOpacity={0.8}
                onPress={() => setAnalyticsOpen(prev => !prev)}>
                <View style={styles.menuItemLeft}>
                  <FontAwesome name="bar-chart" size={18} color={colors.brandBlue} />
                  <Text style={styles.menuItemLabel}>Analytics &amp; Reporting</Text>
                </View>
                <FontAwesome
                  name={analyticsOpen ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={colors.brandGrayText}
                />
              </TouchableOpacity>

              {analyticsOpen &&
                ANALYTICS_SUB_ITEMS.map(sub => (
                  <TouchableOpacity key={sub.key} style={styles.subMenuItem} activeOpacity={0.8}>
                    <Text style={styles.subMenuItemLabel}>{sub.label}</Text>
                  </TouchableOpacity>
                ))}

              {/* Logout */}
              <TouchableOpacity style={styles.logoutItem} activeOpacity={0.8} onPress={handleLogout}>
                <View style={styles.menuItemLeft}>
                  <FontAwesome name="sign-out" size={18} color="#FF3B30" />
                  <Text style={styles.logoutLabel}>Log Out</Text>
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>

        {loggingOut && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Logging out...</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.brandGrayBorder,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    padding: 4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 12,
  },
  // System overview card
  systemCard: {
    backgroundColor: colors.brandGreen,
    padding: 18,
  },
  systemCardTitle: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  systemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  systemHeaderText: {
    flex: 1,
    paddingRight: 12,
  },
  greetingText: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 4,
  },
  systemSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  systemBadge: {
    alignItems: 'center',
  },
  statusBadgeText: {
    marginTop: 6,
    fontFamily: fonts.medium,
    fontSize: 13,
    color: '#ECFDF5',
  },
  // System Status
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#9CA3AF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIconActive: {
    backgroundColor: colors.brandGreen,
  },
  statusText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: '#1F2937',
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  scheduleLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
  },
  scheduleTime: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: '#ffffff',
  },
  pauseButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  pauseButtonText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: '#ffffff',
  },
  // Gauges
  gaugesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  // Quick Controls
  controlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  controlButton: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.cardBg,
  },
  controlIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  controlLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: '#1F2937',
    textAlign: 'center',
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginTop: 4,
  },
  menuTile: {
    width: '48%',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  menuTileIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTileLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: '#111827',
    textAlign: 'center',
  },
  userHeader: {
    alignItems: 'center',
    paddingVertical: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.brandGrayBorder,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E6F4FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.brandBlue,
  },
  profilePicture: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'transparent',
  },
  userInfo: {
    marginTop: 12,
  },
  userLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.brandGrayText,
  },
  userName: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: '#111827',
  },
  editProfileButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.brandBlue,
  },
  editProfileText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.brandBlue,
  },
  menuSection: {
    borderRadius: 12,
    paddingVertical: 8,
  },
  menuTitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.brandGrayText,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.brandGrayBorder,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.brandGrayBorder,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuItemLabel: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: '#000',
  },
  analyticsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.brandGrayBorder,
    backgroundColor: '#F7F7F8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subMenuItem: {
    paddingLeft: 40,
    paddingRight: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.brandGrayBorder,
  },
  subMenuItemLabel: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.brandGrayText,
  },
  logoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 4,
  },
  logoutLabel: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: '#FF3B30',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  drawerContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: '#fff',
  },
});


