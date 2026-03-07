import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const colors = {
  primary: '#3B82F6',
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

export default function PatternAnalyzerScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="chevron-left" size={18} color={colors.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Environmental Condition Pattern Analyzer</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.placeholder}>
          <FontAwesome name="line-chart" size={64} color={colors.grayText} />
          <Text style={styles.placeholderTitle}>Coming Soon</Text>
          <Text style={styles.placeholderText}>
            Environmental condition pattern analysis will analyze weather patterns (sunny vs rainy)
            to help optimize irrigation decisions.
          </Text>
        </View>
      </ScrollView>
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
    fontSize: 14,
    color: colors.dark,
    flex: 1,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 24 },
  placeholder: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 16,
  },
  placeholderTitle: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.dark,
  },
  placeholderText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.grayText,
    textAlign: 'center',
    lineHeight: 22,
  },
});
