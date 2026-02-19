import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import SplashScreen from '../screens/SplashScreen';
import { colors as themeColors } from '../src/theme/colors';

export default function Index() {
  console.log('[Index] Component function called');
  
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const [showSplash, setShowSplash] = useState(true);
  const [forceStopLoading, setForceStopLoading] = useState(false);

  console.log('[Index] State initialized - isLoading:', isLoading, 'isAuthenticated:', isAuthenticated);

  useEffect(() => {
    console.log('[Index] useEffect triggered, starting auth check...');
    // Start auth check immediately
    checkAuth()
      .then(() => {
        console.log('[Index] Auth check completed successfully');
      })
      .catch((error) => {
        console.warn('[Index] Auth check error:', error);
        setForceStopLoading(true);
      });

    // Set a maximum loading time (8 seconds) - if still loading, force stop
    const timeout = setTimeout(() => {
      console.warn('[Index] Auth check timeout reached, forcing stop');
      setForceStopLoading(true);
    }, 8000);

    return () => clearTimeout(timeout);
  }, [checkAuth]);

  // Log current state for debugging
  console.log('[Index] Render - isLoading:', isLoading, 'isAuthenticated:', isAuthenticated, 'showSplash:', showSplash, 'forceStopLoading:', forceStopLoading);

  // Show splash screen first (max 2 seconds)
  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  // After splash, show loading if still checking auth (but not forever)
  if (isLoading && !forceStopLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: themeColors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={themeColors.accent} />
      </View>
    );
  }

  // If loading took too long OR auth check is done, redirect appropriately
  if (forceStopLoading || !isLoading) {
    if (isAuthenticated) {
      console.log('[Index] Authenticated, redirecting to tabs');
      return <Redirect href="/(tabs)" />;
    } else {
      console.log('[Index] Not authenticated, redirecting to login');
      return <Redirect href="/login" />;
    }
  }

  // Fallback (shouldn't reach here)
  console.log('[Index] Fallback redirect to login');
  return <Redirect href="/login" />;
}
