export class PlanResponseDto {
  id: string;
  name: string;
  price: number;
  duration: string;
  deviceLimit: number;
  offlineAllowed: boolean;
  maxOfflineDownloads: number;
  isPopular: boolean;
  perks: string[];
  createdAt: Date;
  updatedAt: Date;

  static fromPlan(plan: {
    id: string;
    name: string;
    price: unknown;
    duration: string;
    deviceLimit: number;
    offlineAllowed: boolean;
    maxOfflineDownloads: number;
    isPopular?: boolean;
    perks?: string[];
    createdAt: Date;
    updatedAt: Date;
  }): PlanResponseDto {
    return {
      id: plan.id,
      name: plan.name,
      price: Number(plan.price),
      duration: plan.duration,
      deviceLimit: plan.deviceLimit,
      offlineAllowed: plan.offlineAllowed,
      maxOfflineDownloads: plan.maxOfflineDownloads,
      isPopular: plan.isPopular ?? false,
      perks: plan.perks ?? [],
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }
}
