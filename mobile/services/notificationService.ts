// DISABLED: Push notifications disabled for now
// This file is stubbed out to prevent expo-notifications from loading

export type NotificationData = {
  id: string;
  title: string;
  body: string;
  data?: {
    videoId?: string;
    contentType?: string;
    [key: string]: any;
  };
  receivedAt: number;
  read: boolean;
  type?: 'info' | 'video' | 'system';
};

class NotificationService {
  private token: string | null = null;
  private backendUrl: string;

  constructor() {
    this.backendUrl = process.env.EXPO_PUBLIC_API_URL || 'https://your-backend.com/api';
  }

  configureNotifications(): void {
    // No-op when disabled
  }

  async requestPermissions(): Promise<boolean> {
    return false;
  }

  async getToken(): Promise<string | null> {
    return null;
  }

  async registerForPushNotifications(userId?: string): Promise<string | null> {
    return null;
  }

  async storeNotification(notification: NotificationData): Promise<void> {
    // No-op when disabled
  }

  async markAsRead(notificationId: string): Promise<void> {
    // No-op when disabled
  }

  getStoredToken(): string | null {
    return null;
  }
}

export const notificationService = new NotificationService();

/* DISABLED CODE - Re-enable when notifications are needed
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as Constants from 'expo-constants';
import { Platform } from 'react-native';
import { databaseService } from './database';
import axios from 'axios';

// ... rest of the original implementation ...
*/
