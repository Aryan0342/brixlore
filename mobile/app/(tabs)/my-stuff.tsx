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
import { useRouter } from 'expo-router';
import { colors as themeColors } from '../../src/theme/colors';
import { spacing, typography, borderRadius, shadows } from '../../constants/theme';
import { VideoThumbnail, SectionCard } from '../../components';
import type { VideoThumbnailItem } from '../../components';
import { useAuthStore, useNotificationStore } from '../../store';
import { useContinueWatching } from '../../hooks';

export default function MyStuffScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { unreadCount } = useNotificationStore();
  const continueWatching = useContinueWatching();
  const listKey = useMemo(() => `continue-${Date.now()}`, []);

  const userName = user?.name || 'User';
  const userEmail = user?.email || '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={themeColors.textPrimary} />
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={styles.greeting}>Hello, {userName}</Text>
          <Text style={styles.email}>{userEmail}</Text>
        </View>
        <View style={styles.headerIcons}>
          <Pressable style={styles.iconButton} onPress={() => router.push('/notifications')}>
            <Ionicons name="notifications-outline" size={24} color={themeColors.textPrimary} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => router.push('/settings')}>
            <Ionicons name="settings-outline" size={24} color={themeColors.textPrimary} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Continue Watching Section */}
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
            scrollEnabled={true}
          />
        </View>

        {/* My List Section */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>My List</Text>
            <Pressable>
              <Ionicons name="chevron-forward" size={24} color={themeColors.textPrimary} />
            </Pressable>
          </View>
          <Text style={styles.sectionDesc}>
            Find movies and TV shows you saved to your list here
          </Text>
          <FlatList
            horizontal
            data={[{ id: 'add-more' }]}
            keyExtractor={(item) => item.id}
            renderItem={() => (
              <View style={styles.cardWrapper}>
                <SectionCard icon="add" title="Add More" onPress={() => {}} />
              </View>
            )}
            contentContainerStyle={styles.horizontalList}
            showsHorizontalScrollIndicator={false}
          />
        </View>

        {/* My Likes Section */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>My Likes</Text>
            <Pressable>
              <Ionicons name="chevron-forward" size={24} color={themeColors.textPrimary} />
            </Pressable>
          </View>
          <Text style={styles.sectionDesc}>
            Find movies and TV shows you liked here
          </Text>
          <FlatList
            horizontal
            data={[{ id: 'rate-titles' }]}
            keyExtractor={(item) => item.id}
            renderItem={() => (
              <View style={styles.cardWrapper}>
                <SectionCard icon="rate" title="Rate Titles" onPress={() => {}} />
              </View>
            )}
            contentContainerStyle={styles.horizontalList}
            showsHorizontalScrollIndicator={false}
          />
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.border,
  },
  backButton: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  headerContent: {
    flex: 1,
  },
  greeting: {
    ...typography.title,
    color: themeColors.textPrimary,
    fontWeight: '700',
  },
  email: {
    ...typography.caption,
    color: themeColors.textSecondary,
    marginTop: 2,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconButton: {
    padding: spacing.sm,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: themeColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: themeColors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: themeColors.textPrimary,
    fontWeight: '700',
  },
  sectionDesc: {
    ...typography.caption,
    color: themeColors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  horizontalList: {
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
  },
  cardWrapper: {
    marginRight: spacing.md,
  },
});
