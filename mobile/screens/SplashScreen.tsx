import React, { useEffect } from 'react';
import { View, StyleSheet, Animated as RNAnimated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors as themeColors } from '../src/theme/colors';
import { spacing, typography } from '../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type SplashScreenProps = {
  onFinish: () => void;
};

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const fadeAnim = React.useRef(new RNAnimated.Value(0)).current;
  const scaleAnim = React.useRef(new RNAnimated.Value(0.8)).current;

  useEffect(() => {
    console.log('[SplashScreen] Component mounted, starting animation...');
    // Fade in animation
    RNAnimated.parallel([
      RNAnimated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      RNAnimated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss after animation
    const timer = setTimeout(() => {
      console.log('[SplashScreen] Timer finished, calling onFinish...');
      RNAnimated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        console.log('[SplashScreen] Animation complete, calling onFinish');
        onFinish();
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[themeColors.background, themeColors.surface, themeColors.background]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      
      <RNAnimated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Logo/Brand */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <View style={styles.logoInner} />
          </View>
        </View>

        {/* Brand Name */}
        <RNAnimated.Text style={styles.brandName}>BRIXLORE</RNAnimated.Text>
        <RNAnimated.Text style={styles.tagline}>Premium Streaming</RNAnimated.Text>
      </RNAnimated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: themeColors.background,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: spacing.xl,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: themeColors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: themeColors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  logoInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: themeColors.background,
  },
  brandName: {
    ...typography.display,
    color: themeColors.textPrimary,
    letterSpacing: 4,
    marginBottom: spacing.sm,
  },
  tagline: {
    ...typography.body,
    color: themeColors.textSecondary,
    letterSpacing: 2,
  },
});
