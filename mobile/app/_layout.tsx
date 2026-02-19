import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { DarkThemeProvider } from '../context/ThemeContext';
import { databaseService } from '../services/database';
// import { NotificationHandler } from '../components/NotificationHandler'; // DISABLED: Push notifications disabled for now
import { ProtectedRoute } from '../components/ProtectedRoute';
// import { useNotificationStore } from '../store/useNotificationStore'; // DISABLED: Push notifications disabled for now
import { useAuthStore } from '../store/useAuthStore';

export default function RootLayout() {
  // const { register, loadNotifications } = useNotificationStore(); // DISABLED: Push notifications disabled for now
  // Removed checkAuth from here - it's called in index.tsx to avoid duplicate calls

  useEffect(() => {
    // Initialize database on app start
    databaseService.initialize().catch((error) => {
      console.error('Failed to initialize database:', error);
    });

    // DISABLED: Push notifications disabled for now
    // Register for push notifications (will gracefully fail in Expo Go)
    // register().catch((error) => {
    //   // Silently handle Expo Go limitations
    //   if (!error.message?.includes('Expo Go')) {
    //     console.error('Failed to register for notifications:', error);
    //   }
    // });

    // Load existing notifications
    // loadNotifications().catch((error) => {
    //   console.error('Failed to load notifications:', error);
    // });
  }, []);

  return (
    <SafeAreaProvider>
      <DarkThemeProvider>
        <StatusBar style="light" />
        <ProtectedRoute>
          {/* <NotificationHandler /> DISABLED: Push notifications disabled for now */}
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="signup" options={{ headerShown: false }} />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </ProtectedRoute>
      </DarkThemeProvider>
    </SafeAreaProvider>
  );
}
