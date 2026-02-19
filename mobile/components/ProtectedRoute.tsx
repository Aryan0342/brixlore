import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../store/useAuthStore';
import { colors as themeColors } from '../src/theme/colors';

type ProtectedRouteProps = {
  children: React.ReactNode;
};

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading } = useAuthStore();

  // Don't call checkAuth here - it's already called in index.tsx
  // This prevents duplicate calls

  useEffect(() => {
    if (!isLoading) {
      const isLoginScreen = segments[0] === 'login';
      const isSignUpScreen = segments[0] === 'signup';
      const isIndexScreen = segments.length === 0;
      
      // Don't redirect if we're on index screen (let index.tsx handle it)
      if (isIndexScreen) {
        return;
      }
      
      // Don't redirect if we're on login or signup screens
      if (!isAuthenticated && !isLoginScreen && !isSignUpScreen) {
        // Redirect to login if not authenticated (but not if already on login, signup, or index)
        router.replace('/login');
      } else if (isAuthenticated && (isLoginScreen || isSignUpScreen)) {
        // Redirect to home if authenticated and on login or signup screen
        router.replace('/(tabs)');
      }
    }
  }, [isAuthenticated, isLoading, segments, router]);

  // Always allow index screen, login screen, and signup screen to render
  const isIndexScreen = segments.length === 0;
  const isLoginScreen = segments[0] === 'login';
  const isSignUpScreen = segments[0] === 'signup';
  
  if (isIndexScreen || isLoginScreen || isSignUpScreen) {
    return <>{children}</>;
  }

  // Show loading only if we're actually loading AND not on login/index screen
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={themeColors.accent} />
      </View>
    );
  }

  // For other screens, require authentication
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: themeColors.background,
  },
});
