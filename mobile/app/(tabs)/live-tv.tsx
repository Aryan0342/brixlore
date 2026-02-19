import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography } from '../../constants/theme';

export default function LiveTVScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Live TV</Text>
      <Text style={styles.subtitle}>Live TV — coming soon</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
  },
  title: {
    ...typography.title,
    color: colors.foreground,
  },
  subtitle: {
    ...typography.body,
    color: colors.foreground,
    opacity: 0.8,
    marginTop: 8,
  },
});
