import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors as themeColors } from '../src/theme/colors';
import { spacing, typography, borderRadius, shadows } from '../constants/theme';
import { useDownloadStore } from '../store/useDownloadStore';
import { downloadService } from '../services/downloadService';
import { AnimatedPressableComponent } from './AnimatedPressable';

type DownloadButtonProps = {
  contentId: string;
  episodeId: string;
  expiresAt: number;
  title?: string;
  onDownloadComplete?: () => void;
  onError?: (error: string) => void;
};

export function DownloadButton({
  contentId,
  episodeId,
  expiresAt,
  title,
  onDownloadComplete,
  onError,
}: DownloadButtonProps) {
  const { startDownload, deleteDownload, getDownloadProgress, loadDownloads } =
    useDownloadStore();
  const [isChecking, setIsChecking] = useState(true);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const progress = getDownloadProgress(contentId);

  useEffect(() => {
    checkDownloadStatus();
    loadDownloads();
  }, [contentId]);

  useEffect(() => {
    if (progress) {
      setIsDownloading(progress.status === 'downloading');
      if (progress.status === 'completed') {
        setIsDownloaded(true);
        setIsDownloading(false);
        onDownloadComplete?.();
      } else if (progress.status === 'error') {
        setIsDownloading(false);
        onError?.(progress.error || 'Download failed');
      }
    }
  }, [progress]);

  const checkDownloadStatus = async () => {
    setIsChecking(true);
    try {
      const exists = await downloadService.downloadExists(contentId);
      setIsDownloaded(exists);
    } catch (error) {
      console.error('Failed to check download status:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      await startDownload(contentId, episodeId, expiresAt, title);
    } catch (error: any) {
      setIsDownloading(false);
      onError?.(error.message || 'Failed to start download');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDownload(contentId);
      setIsDownloaded(false);
      await checkDownloadStatus();
    } catch (error: any) {
      onError?.(error.message || 'Failed to delete download');
    }
  };

  if (isChecking) {
    return (
      <View style={styles.button}>
        <ActivityIndicator size="small" color={themeColors.textPrimary} />
      </View>
    );
  }

  if (isDownloaded) {
    return (
      <AnimatedPressableComponent style={[styles.button, styles.deleteButton]} onPress={handleDelete}>
        <Ionicons name="trash-outline" size={20} color={themeColors.error} />
        <Text style={styles.deleteText}>Delete</Text>
      </AnimatedPressableComponent>
    );
  }

  if (isDownloading && progress) {
    return (
      <View style={styles.downloadingContainer}>
        <AnimatedPressableComponent style={styles.cancelButton} onPress={() => useDownloadStore.getState().cancelDownload(contentId)}>
          <Ionicons name="close-circle" size={20} color={themeColors.error} />
        </AnimatedPressableComponent>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${progress.progress}%` }]}
            />
          </View>
          <Text style={styles.progressText}>{Math.round(progress.progress)}%</Text>
        </View>
      </View>
    );
  }

  return (
    <AnimatedPressableComponent style={[styles.button, styles.downloadButton]} onPress={handleDownload}>
      <Ionicons name="download-outline" size={20} color={themeColors.textPrimary} />
      <Text style={styles.downloadText}>Download</Text>
    </AnimatedPressableComponent>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
    ...shadows.card,
  },
  downloadButton: {
    backgroundColor: themeColors.accent,
  },
  deleteButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: themeColors.error,
  },
  downloadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cancelButton: {
    padding: spacing.xs,
  },
  progressContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
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
    textAlign: 'right',
  },
  downloadText: {
    ...typography.caption,
    color: themeColors.background,
    fontWeight: '600',
  },
  deleteText: {
    ...typography.caption,
    color: themeColors.error,
    fontWeight: '600',
  },
});
