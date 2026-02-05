import { useEffect } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const colors = {
  brandGreen: '#3E9B4F',
};

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    // Navigate to login after 3 seconds
    const timer = setTimeout(() => {
      router.replace('/UserManagement/login');
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Image
          source={require('../../app/(tabs)/logo_string_beans.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color="#fff" style={styles.loader} />
      </View>
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

