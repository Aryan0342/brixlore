import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors as themeColors } from '../src/theme/colors';
import { spacing, typography } from '../constants/theme';
import { useDownloadStore } from '../store/useDownloadStore';
import { downloadService } from '../services/downloadService';

export default function DownloadsScreen() {
  const router = useRouter();
  const { metadata, loadDownloads, deleteDownload, getDownloadProgress, cleanupExpired } =
    useDownloadStore();
  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    loadDownloads();
    cleanupExpired();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await cleanupExpired();
    await loadDownloads();
    setRefreshing(false);
  };

  const handleDelete = async (contentId: string) => {
    await deleteDownload(contentId);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  const handlePlay = async (contentId: string) => {
    const filePath = await downloadService.getDownloadPath(contentId);
    if (filePath) {
      router.push({
        pathname: '/video-player',
        params: {
          videoUrl: filePath,
          videoId: contentId,
          title: metadata.find((m) => m.contentId === contentId)?.title,
        },
      });
    }
  };

  const renderItem = ({ item }: { item: typeof metadata[0] }) => {
    const progress = getDownloadProgress(item.contentId);
    const isExpired = item.expiresAt < Date.now();

    return (
      <View style={styles.item}>
        <View style={styles.itemContent}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle} numberOfLines={2}>
              {item.title || `Content ${item.contentId}`}
            </Text>
            <Text style={styles.itemMeta}>
              {item.fileSize ? formatFileSize(item.fileSize) : 'Unknown size'} •{' '}
              {formatDate(item.createdAt)}
            </Text>
            {isExpired && (
              <Text style={styles.expiredText}>Expired</Text>
            )}
            {progress && progress.status === 'downloading' && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[styles.progressFill, { width: `${progress.progress}%` }]}
                  />
                </View>
                <Text style={styles.progressText}>{Math.round(progress.progress)}%</Text>
              </View>
            )}
          </View>
          <View style={styles.itemActions}>
            {progress?.status !== 'downloading' && !isExpired && (
              <Pressable
                style={styles.actionButton}
                onPress={() => handlePlay(item.contentId)}
              >
                <Ionicons name="play" size={24} color={themeColors.accent} />
              </Pressable>
            )}
            <Pressable
              style={styles.actionButton}
              onPress={() => handleDelete(item.contentId)}
            >
              <Ionicons name="trash-outline" size={24} color={themeColors.error} />
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={themeColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Downloads</Text>
        <View style={styles.headerSpacer} />
      </View>

      {metadata.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="download-outline" size={64} color={themeColors.muted} />
          <Text style={styles.emptyText}>No downloads yet</Text>
          <Text style={styles.emptySubtext}>
            Download videos to watch offline
          </Text>
        </View>
      ) : (
        <FlatList
          data={metadata}
          renderItem={renderItem}
          keyExtractor={(item) => item.contentId}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={themeColors.accent}
            />
          }
        />
      )}
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.border,
  },
  backButton: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  headerTitle: {
    ...typography.title,
    color: themeColors.textPrimary,
    flex: 1,
  },
  headerSpacer: {
    width: 40,
  },
  listContent: {
    padding: spacing.md,
  },
  item: {
    backgroundColor: themeColors.surface,
    borderRadius: 12,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: themeColors.border,
  },
  itemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  itemTitle: {
    ...typography.body,
    color: themeColors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  itemMeta: {
    ...typography.caption,
    color: themeColors.textSecondary,
    marginBottom: spacing.xs,
  },
  expiredText: {
    ...typography.caption,
    color: themeColors.error,
    marginTop: spacing.xs,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: themeColors.accent,
    borderRadius: 2,
  },
  progressText: {
    ...typography.caption,
    color: themeColors.textPrimary,
    minWidth: 40,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionButton: {
    padding: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    ...typography.sectionTitle,
    color: themeColors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    ...typography.body,
    color: themeColors.textSecondary,
    textAlign: 'center',
  },
});
