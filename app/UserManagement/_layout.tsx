import { Stack } from 'expo-router';

export default function UserManagementLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="splashScreen"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="welcomeScreen"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="login"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="signup"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen name="dashboard" options={{ headerShown: false }} />
      <Stack.Screen name="weatherUpdate" options={{ headerShown: false }} />
      <Stack.Screen name="waterDistribution" options={{ headerShown: false }} />
      <Stack.Screen name="irrigationSchedule" options={{ headerShown: false }} />
    </Stack>
  );
}

