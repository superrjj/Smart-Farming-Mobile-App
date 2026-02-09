import { useEffect, useRef } from 'react';
import { ActivityIndicator, Image, StyleSheet, View, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const colors = {
  brandGreen: '#3E9B4F',
};

export default function SplashScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade-in animation for logo + loader
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Navigate to welcome screen after a short delay
    const timer = setTimeout(() => {
      router.replace('/UserManagement/welcomeScreen');
    }, 4000);

    return () => clearTimeout(timer);
  }, [router, fadeAnim]);

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <Image
          source={require('@/assets/images/logo_string_beans.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color="#fff" style={styles.loader} />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.brandGreen,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 200,
    tintColor: '#fff',
    marginBottom: 40,
  },
  loader: {
    marginTop: 20,
  },
});

