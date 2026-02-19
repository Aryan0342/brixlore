import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../constants/theme';
import { VideoThumbnail, SectionCard } from '../components';
import type { VideoThumbnailItem } from '../components';
import { useContinueWatching } from '../hooks';

export default function HomeScreen() {
  const continueWatching = useContinueWatching();
  const listKey = useMemo(() => `continue-${Date.now()}`, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, Jay</Text>
            <Text style={styles.email}>youngfaker1000@gmail.com</Text>
          </View>
          <View style={styles.headerIcons}>
            <Pressable style={styles.iconButton}>
              <Ionicons name="notifications-outline" size={24} color={colors.foreground} />
              <View style={styles.badge}>
                <Text style={styles.badgeText}>2</Text>
              </View>
            </Pressable>
            <Pressable style={styles.iconButton}>
              <Ionicons name="settings-outline" size={24} color={colors.foreground} />
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Continue Watching</Text>
          <FlatList
            key={listKey}
            data={continueWatching}
            horizontal
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <VideoThumbnail item={item} onPress={() => {}} />}
            contentContainerStyle={styles.horizontalList}
            showsHorizontalScrollIndicator={false}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>My List</Text>
            <Pressable>
              <Ionicons name="chevron-forward" size={24} color={colors.foreground} />
            </Pressable>
          </View>
          <Text style={styles.sectionDesc}>Find movies and TV shows you saved to your list here</Text>
          <View style={styles.sectionCardRow}>
            <SectionCard icon="add" title="Add More" onPress={() => {}} />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>My Likes</Text>
            <Pressable>
              <Ionicons name="chevron-forward" size={24} color={colors.foreground} />
            </Pressable>
          </View>
          <Text style={styles.sectionDesc}>Find movies and TV shows you liked here</Text>
          <View style={styles.sectionCardRow}>
            <SectionCard icon="rate" title="Rate Titles" onPress={() => {}} />
          </View>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  greeting: {
    ...typography.title,
    color: colors.foreground,
  },
  email: {
    ...typography.caption,
    color: colors.foreground,
    opacity: 0.9,
    marginTop: 2,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconButton: {
    padding: spacing.sm,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accentForeground,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.foreground,
  },
  sectionDesc: {
    ...typography.caption,
    color: colors.foreground,
    opacity: 0.85,
    marginTop: spacing.xs,
  },
  sectionCardRow: {
    marginTop: spacing.sm,
  },
  horizontalList: {
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
  },
});
