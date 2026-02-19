import * as FileSystem from 'expo-file-system';
import { v4 as uuidv4 } from 'uuid';
import { databaseService } from './database';
import type { DownloadMetadata } from './database';
import { api } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';

export type DownloadProgress = {
  contentId: string;
  progress: number;
  bytesWritten: number;
  totalBytes: number;
  status: 'downloading' | 'completed' | 'error' | 'paused';
  error?: string;
};

const DEVICE_ID_KEY = '@device_id';

class DownloadService {
  private downloads: Map<string, FileSystem.FileSystemDownloadResult> = new Map();
  private progressCallbacks: Map<string, (progress: DownloadProgress) => void> = new Map();

  private getDownloadDirectory(): string {
    return `${FileSystem.documentDirectory}downloads/`;
  }

  private async ensureDownloadDirectory(): Promise<string> {
    const dir = this.getDownloadDirectory();
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    return dir;
  }

  private generateObfuscatedFilename(): string {
    return `${uuidv4()}.mp4`;
  }

  private async getDeviceId(): Promise<string> {
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = Device.modelName || uuidv4();
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      return token;
    } catch {
      return null;
    }
  }

  /**
   * Sync downloads with backend (Neon PostgreSQL)
   */
  async syncWithBackend(): Promise<void> {
    try {
      const token = await this.getAuthToken();
      if (!token) return;

      const deviceId = await this.getDeviceId();
      
      // Set auth token for API calls
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // Get active downloads from backend
      const response = await api.get('/downloads/active', {
        params: { deviceId },
      });

      const backendDownloads = response.data || [];

      // Sync local database with backend
      for (const download of backendDownloads) {
        const localMetadata = await databaseService.getDownloadByContentId(download.episodeId);
        
        if (!localMetadata) {
          // Add new download from backend
          await databaseService.insertDownload({
            contentId: download.episodeId,
            filePath: '', // Will be set when download starts
            expiresAt: new Date(download.expiresAt).getTime(),
            createdAt: new Date(download.createdAt).getTime(),
            title: download.episode?.title || download.contentId,
          });
        } else {
          // Update expiresAt if changed
          const backendExpiresAt = new Date(download.expiresAt).getTime();
          if (localMetadata.expiresAt !== backendExpiresAt) {
            await databaseService.updateDownloadPath(download.episodeId, localMetadata.filePath);
          }
        }
      }
    } catch (error) {
      console.error('Failed to sync downloads with backend:', error);
    }
  }

  /**
   * Authorize download with backend
   */
  async authorizeDownload(episodeId: string): Promise<{ token: string; expiresAt: number }> {
    const token = await this.getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const deviceId = await this.getDeviceId();
    
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    const response = await api.post('/downloads/authorize', {
      episodeId,
      deviceId,
    });

    return {
      token: response.data.id,
      expiresAt: new Date(response.data.expiresAt).getTime(),
    };
  }

  /**
   * Get download token from backend
   */
  async getDownloadToken(episodeId: string): Promise<{ token: string; expiresAt: number }> {
    const token = await this.getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const deviceId = await this.getDeviceId();
    
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    const response = await api.post('/downloads/token', {
      episodeId,
      deviceId,
    });

    return {
      token: response.data.token,
      expiresAt: response.data.expiresAt,
    };
  }

  /**
   * Redeem download token to get signed URL
   */
  async redeemDownloadToken(downloadToken: string): Promise<string> {
    const token = await this.getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const deviceId = await this.getDeviceId();
    
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    const response = await api.post('/downloads/redeem', {
      token: downloadToken,
      deviceId,
    });

    return response.data.url;
  }

  /**
   * Mark download as complete on backend
   */
  async markDownloadComplete(downloadId: string): Promise<void> {
    const token = await this.getAuthToken();
    if (!token) return;

    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    await api.post(`/downloads/${downloadId}/complete`);
  }

  async downloadExists(contentId: string): Promise<boolean> {
    const metadata = await databaseService.getDownloadByContentId(contentId);
    if (!metadata) return false;
    
    const fileInfo = await FileSystem.getInfoAsync(metadata.filePath);
    if (!fileInfo.exists) {
      await databaseService.deleteDownload(contentId);
      return false;
    }
    
    return true;
  }

  async startDownload(
    contentId: string,
    episodeId: string,
    expiresAt: number,
    title?: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<string> {
    const exists = await this.downloadExists(contentId);
    if (exists) {
      throw new Error('Download already exists');
    }

    // Get download token from backend
    const { token: downloadToken } = await this.getDownloadToken(episodeId);
    
    // Redeem token to get signed URL
    const signedUrl = await this.redeemDownloadToken(downloadToken);

    const downloadDir = await this.ensureDownloadDirectory();
    const filename = this.generateObfuscatedFilename();
    const filePath = `${downloadDir}${filename}`;

    if (onProgress) {
      this.progressCallbacks.set(contentId, onProgress);
    }

    try {
      await databaseService.insertDownload({
        contentId,
        filePath,
        expiresAt,
        createdAt: Date.now(),
        title,
      });

      const downloadResult = FileSystem.createDownloadResumable(
        signedUrl,
        filePath,
        {},
        (downloadProgress) => {
          const totalBytes = downloadProgress.totalBytesExpectedToWrite || downloadProgress.totalBytesWritten;
          const progress = totalBytes > 0 
            ? downloadProgress.totalBytesWritten / totalBytes 
            : 0;
          
          const progressData: DownloadProgress = {
            contentId,
            progress: progress * 100,
            bytesWritten: downloadProgress.totalBytesWritten,
            totalBytes: totalBytes,
            status: 'downloading',
          };

          const callback = this.progressCallbacks.get(contentId);
          if (callback) {
            callback(progressData);
          }
        }
      );

      this.downloads.set(contentId, downloadResult);

      const result = await downloadResult.downloadAsync();

      if (result) {
        const fileInfo = await FileSystem.getInfoAsync(result.uri);
        const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;
        
        await databaseService.updateDownloadPath(contentId, result.uri);

        // Mark as complete on backend
        try {
          await this.markDownloadComplete(downloadToken);
        } catch (error) {
          console.error('Failed to mark download complete on backend:', error);
        }

        const finalProgress: DownloadProgress = {
          contentId,
          progress: 100,
          bytesWritten: fileSize,
          totalBytes: fileSize,
          status: 'completed',
        };

        const callback = this.progressCallbacks.get(contentId);
        if (callback) {
          callback(finalProgress);
        }

        this.progressCallbacks.delete(contentId);
        return result.uri;
      } else {
        throw new Error('Download failed - no result');
      }
    } catch (error: any) {
      await this.cleanupFailedDownload(contentId, filePath);

      const errorProgress: DownloadProgress = {
        contentId,
        progress: 0,
        bytesWritten: 0,
        totalBytes: 0,
        status: 'error',
        error: error.message || 'Download failed',
      };

      const callback = this.progressCallbacks.get(contentId);
      if (callback) {
        callback(errorProgress);
      }

      this.progressCallbacks.delete(contentId);
      throw error;
    }
  }

  async cancelDownload(contentId: string): Promise<void> {
    const download = this.downloads.get(contentId);
    if (download) {
      try {
        await download.cancelAsync();
      } catch (error) {
        console.error('Error canceling download:', error);
      }
      this.downloads.delete(contentId);
    }
    this.progressCallbacks.delete(contentId);
  }

  async deleteDownload(contentId: string): Promise<boolean> {
    try {
      await this.cancelDownload(contentId);

      const metadata = await databaseService.getDownloadByContentId(contentId);
      if (!metadata) return false;

      const fileInfo = await FileSystem.getInfoAsync(metadata.filePath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(metadata.filePath, { idempotent: true });
      }

      await databaseService.deleteDownload(contentId);

      return true;
    } catch (error) {
      console.error('Failed to delete download:', error);
      return false;
    }
  }

  private async cleanupFailedDownload(contentId: string, filePath: string): Promise<void> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(filePath, { idempotent: true });
      }
      await databaseService.deleteDownload(contentId);
    } catch (error) {
      console.error('Failed to cleanup failed download:', error);
    }
  }

  async getDownloadPath(contentId: string): Promise<string | null> {
    const metadata = await databaseService.getDownloadByContentId(contentId);
    if (!metadata) return null;

    const fileInfo = await FileSystem.getInfoAsync(metadata.filePath);
    if (!fileInfo.exists) {
      await databaseService.deleteDownload(contentId);
      return null;
    }

    return metadata.filePath;
  }

  async cleanupExpiredDownloads(): Promise<number> {
    const expired = await databaseService.deleteExpiredDownloads();
    const downloads = await databaseService.getAllDownloads();

    for (const download of downloads) {
      const now = Date.now();
      if (download.expiresAt < now) {
        const fileInfo = await FileSystem.getInfoAsync(download.filePath);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(download.filePath, { idempotent: true }).catch(console.error);
        }
      }
    }

    return expired;
  }
}

export const downloadService = new DownloadService();
