import { create } from 'zustand';
import { downloadService } from '../services/downloadService';
import type { DownloadProgress } from '../services/downloadService';
import type { DownloadMetadata } from '../services/database';
import { databaseService } from '../services/database';

type DownloadState = {
  downloads: Map<string, DownloadProgress>;
  metadata: DownloadMetadata[];
  isLoading: boolean;
  error: string | null;
};

type DownloadActions = {
  startDownload: (
    contentId: string,
    episodeId: string,
    expiresAt: number,
    title?: string
  ) => Promise<void>;
  cancelDownload: (contentId: string) => Promise<void>;
  deleteDownload: (contentId: string) => Promise<void>;
  updateProgress: (progress: DownloadProgress) => void;
  loadDownloads: () => Promise<void>;
  syncWithBackend: () => Promise<void>;
  getDownloadProgress: (contentId: string) => DownloadProgress | undefined;
  cleanupExpired: () => Promise<void>;
};

export const useDownloadStore = create<DownloadState & DownloadActions>((set, get) => ({
  downloads: new Map(),
  metadata: [],
  isLoading: false,
  error: null,

  startDownload: async (contentId, episodeId, expiresAt, title) => {
    try {
      set({ isLoading: true, error: null });

      const existing = get().downloads.get(contentId);
      if (existing && existing.status === 'downloading') {
        throw new Error('Download already in progress');
      }

      const exists = await downloadService.downloadExists(contentId);
      if (exists) {
        throw new Error('Content already downloaded');
      }

      const initialProgress: DownloadProgress = {
        contentId,
        progress: 0,
        bytesWritten: 0,
        totalBytes: 0,
        status: 'downloading',
      };

      set((state) => {
        const newDownloads = new Map(state.downloads);
        newDownloads.set(contentId, initialProgress);
        return { downloads: newDownloads };
      });

      await downloadService.startDownload(
        contentId,
        signedUrl,
        expiresAt,
        title,
        (progress) => {
          get().updateProgress(progress);
        }
      );

      await get().loadDownloads();
      set({ isLoading: false });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'Failed to start download',
      });
      
      set((state) => {
        const newDownloads = new Map(state.downloads);
        newDownloads.delete(contentId);
        return { downloads: newDownloads };
      });
      
      throw error;
    }
  },

  cancelDownload: async (contentId) => {
    try {
      await downloadService.cancelDownload(contentId);
      
      set((state) => {
        const newDownloads = new Map(state.downloads);
        newDownloads.delete(contentId);
        return { downloads: newDownloads };
      });
    } catch (error: any) {
      set({ error: error.message || 'Failed to cancel download' });
    }
  },

  deleteDownload: async (contentId) => {
    try {
      set({ isLoading: true });
      await downloadService.deleteDownload(contentId);
      
      set((state) => {
        const newDownloads = new Map(state.downloads);
        newDownloads.delete(contentId);
        return { downloads: newDownloads };
      });

      await get().loadDownloads();
      set({ isLoading: false });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'Failed to delete download',
      });
    }
  },

  updateProgress: (progress) => {
    set((state) => {
      const newDownloads = new Map(state.downloads);
      newDownloads.set(progress.contentId, progress);
      return { downloads: newDownloads };
    });
  },

  loadDownloads: async () => {
    try {
      set({ isLoading: true });
      // Sync with backend first (Neon PostgreSQL)
      await downloadService.syncWithBackend();
      // Then load from local cache (SQLite)
      const metadata = await databaseService.getAllDownloads();
      set({ metadata, isLoading: false });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'Failed to load downloads',
      });
    }
  },

  syncWithBackend: async () => {
    try {
      await downloadService.syncWithBackend();
      await get().loadDownloads();
    } catch (error: any) {
      set({ error: error.message || 'Failed to sync with backend' });
    }
  },

  getDownloadProgress: (contentId) => {
    return get().downloads.get(contentId);
  },

  cleanupExpired: async () => {
    try {
      await downloadService.cleanupExpiredDownloads();
      await get().loadDownloads();
    } catch (error: any) {
      set({ error: error.message || 'Failed to cleanup expired downloads' });
    }
  },
}));
