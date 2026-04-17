import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchUserProfileByCredentials } from '@/lib/fetchUserProfileByCredentials';
import { isAdminRole } from '@/lib/isAdminRole';
import { isFirstLaunch, isRememberMeEnabled, getSavedCredentials, getLoggedInEmail, clearSavedCredentials } from '@/lib/storage';
import { scale, fontScale } from '@/lib/responsive';
import * as Crypto from 'expo-crypto';

const colors = {
  brandGreen: '#3E9B4F',
};

export default function SplashScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Fade-in animation for logo + loader
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Check navigation logic
    const checkNavigation = async () => {
      try {
        // Check if it's first launch
        const firstLaunch = await isFirstLaunch();
        
        if (firstLaunch) {
          // First time: show welcome screen
          setTimeout(() => {
            router.replace('/UserManagement/welcomeScreen');
          }, 4000);
          return;
        }

        // Not first launch: check if Remember Me is enabled
        const rememberMeEnabled = await isRememberMeEnabled();
        
        if (rememberMeEnabled) {
          // Try to auto-login with saved credentials
          const savedCredentials = await getSavedCredentials();
          
          if (savedCredentials) {
            try {
              // Verify credentials are still valid
              const hashedPassword = await Crypto.digestStringAsync(
                Crypto.CryptoDigestAlgorithm.SHA256,
                savedCredentials.password
              );

              const trimmedInput = savedCredentials.email.trim();

              const { profile: userProfile, error } =
                await fetchUserProfileByCredentials(trimmedInput, hashedPassword);

              if (!error && userProfile && typeof userProfile.email === 'string') {
                if (isAdminRole(userProfile.role)) {
                  await clearSavedCredentials();
                  setTimeout(() => {
                    router.replace({
                      pathname: '/UserManagement/login',
                      params: { blocked: 'admin' },
                    });
                  }, 4000);
                  return;
                }
                // Farmer (or non-admin): go to dashboard
                setTimeout(() => {
                  router.replace({
                    pathname: '/UserManagement/dashboard',
                    params: { email: userProfile.email },
                  });
                }, 4000);
                return;
              } else {
                // Credentials are invalid, clear them
                await clearSavedCredentials();
              }
            } catch (error) {
              console.error('Error verifying saved credentials:', error);
              // If verification fails, clear saved credentials and go to login
              try {
                await clearSavedCredentials();
              } catch (clearError) {
                console.error('Error clearing invalid credentials:', clearError);
              }
            }
          }
        }

        // Default: go to login screen
        setTimeout(() => {
          router.replace('/UserManagement/login');
        }, 4000);
      } catch (error) {
        console.error('Error checking navigation:', error);
        // On error, default to login screen
        setTimeout(() => {
          router.replace('/UserManagement/login');
        }, 4000);
      } finally {
        setIsChecking(false);
      }
    };

    checkNavigation();
  }, [router, fadeAnim]);

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <Image
          source={require('@/assets/images/agri_hydra_logo.png')}
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
    width: scale(200),
    height: scale(200),
    tintColor: '#fff',
    marginBottom: scale(40),
  },
  loader: {
    marginTop: scale(20),
  },
});

