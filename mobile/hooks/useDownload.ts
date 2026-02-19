import { useEffect, useState } from 'react';
import { useDownloadStore } from '../store/useDownloadStore';
import { downloadService } from '../services/downloadService';
import type { DownloadProgress } from '../services/downloadService';

export function useDownload(contentId: string) {
  const { startDownload, deleteDownload, getDownloadProgress, loadDownloads } =
    useDownloadStore();
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const progress = getDownloadProgress(contentId);

  useEffect(() => {
    checkDownloadStatus();
  }, [contentId]);

  useEffect(() => {
    if (progress) {
      if (progress.status === 'completed') {
        setIsDownloaded(true);
      } else if (progress.status === 'error') {
        setIsDownloaded(false);
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

  const download = async (
    episodeId: string,
    expiresAt: number,
    title?: string
  ) => {
    try {
      await startDownload(contentId, episodeId, expiresAt, title);
    } catch (error) {
      throw error;
    }
  };

  const remove = async () => {
    try {
      await deleteDownload(contentId);
      setIsDownloaded(false);
      await checkDownloadStatus();
    } catch (error) {
      throw error;
    }
  };

  const getPath = async () => {
    return await downloadService.getDownloadPath(contentId);
  };

  return {
    isDownloaded,
    isChecking,
    progress,
    download,
    remove,
    getPath,
    refresh: checkDownloadStatus,
  };
}
