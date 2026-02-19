import { ForbiddenException, NotFoundException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Platform } from '@prisma/client';
import type { Device, User } from '@prisma/client';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the user's active subscription with plan (for device limit).
   * Returns null if no active subscription.
   */
  async getActiveSubscriptionWithPlan(userId: string) {
    const now = new Date();
    return this.prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        endDate: { gte: now },
      },
      include: { plan: true },
      orderBy: { endDate: 'desc' },
    });
  }

  /**
   * Get device limit for user (from active subscription plan). Returns 0 if no active subscription.
   */
  async getDeviceLimitForUser(userId: string): Promise<number> {
    const subscription = await this.getActiveSubscriptionWithPlan(userId);
    if (!subscription?.plan) return 0;
    return subscription.plan.deviceLimit;
  }

  /**
   * Register a device for the user. Enforces plan device limit.
   * If the same device (userId + deviceIdentifier) already exists, updates lastActiveAt and returns it.
   */
  async registerDevice(
    userId: string,
    platform: Platform,
    deviceIdentifier: string,
  ): Promise<Device> {
    const deviceLimit = await this.getDeviceLimitForUser(userId);
    if (deviceLimit < 1) {
      throw new ForbiddenException(
        'No active subscription with device allowance. Please subscribe to register devices.',
      );
    }

    const existing = await this.prisma.device.findUnique({
      where: {
        userId_deviceIdentifier: { userId, deviceIdentifier },
      },
    });

    if (existing) {
      return this.prisma.device.update({
        where: { id: existing.id },
        data: { lastActiveAt: new Date(), platform },
      });
    }

    const count = await this.prisma.device.count({ where: { userId } });
    if (count >= deviceLimit) {
      throw new ForbiddenException(
        `Device limit reached (${deviceLimit}). Remove a device from your account or upgrade your plan.`,
      );
    }

    return this.prisma.device.create({
      data: {
        userId,
        platform,
        deviceIdentifier,
      },
    });
  }

  /**
   * List all devices for the authenticated user.
   */
  async listDevices(userId: string): Promise<Device[]> {
    return this.prisma.device.findMany({
      where: { userId },
      orderBy: { lastActiveAt: 'desc' },
    });
  }

  /**
   * Remove a device. User can only remove their own device.
   */
  async removeDevice(userId: string, deviceId: string): Promise<Device> {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, userId },
    });
    if (!device) {
      throw new NotFoundException('Device not found');
    }
    await this.prisma.device.delete({ where: { id: deviceId } });
    return device;
  }
}
