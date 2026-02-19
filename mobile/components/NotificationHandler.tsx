// DISABLED: Push notifications disabled for now
// This component is disabled to prevent expo-notifications from loading

import React from 'react';

export function NotificationHandler() {
  // Return null - notifications are disabled
  return null;
}

/* DISABLED CODE - Re-enable when notifications are needed
import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useNotificationStore } from '../store/useNotificationStore';
import { notificationService } from '../services/notificationService';
import type { NotificationData } from '../services/notificationService';

export function NotificationHandler() {
  const router = useRouter();
  const { addNotification } = useNotificationStore();
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    // Check if running in Expo Go (which doesn't support push notifications)
    const isExpoGo = Constants.executionEnvironment === Constants.ExecutionEnvironment.StoreClient;
    if (isExpoGo) {
      console.warn('NotificationHandler: Push notifications are not supported in Expo Go. Use a development build for full functionality.');
      return;
    }

    // Configure notification handler
    try {
      notificationService.configureNotifications();
    } catch (error) {
      console.warn('Failed to configure notifications:', error);
      return;
    }

    // Handle notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(
      async (notification) => {
        const notificationData: NotificationData = {
          id: notification.request.identifier,
          title: notification.request.content.title || '',
          body: notification.request.content.body || '',
          data: notification.request.content.data as any,
          receivedAt: Date.now(),
          read: false,
          type: notification.request.content.data?.type || 'info',
        };

        await addNotification(notificationData);
      }
    );

    // Handle notification taps (when user taps on notification)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const notification = response.notification;
        const data = notification.request.content.data as any;

        // Store notification
        const notificationData: NotificationData = {
          id: notification.request.identifier,
          title: notification.request.content.title || '',
          body: notification.request.content.body || '',
          data,
          receivedAt: Date.now(),
          read: false,
          type: data?.type || 'info',
        };

        await addNotification(notificationData);

        // Handle deep linking to VideoDetail screen
        if (data?.videoId) {
          router.push({
            pathname: '/video-detail',
            params: {
              videoId: data.videoId,
              ...data,
            },
          });
        } else if (data?.url) {
          // Handle custom URL deep links
          router.push(data.url as any);
        }
      }
    );

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [router, addNotification]);

  // Return null - this is a handler component with no UI
  return null;
}
*/
