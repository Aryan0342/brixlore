export interface AdminPlanDto {
  id: string;
  name: string;
  price: string;
  duration: string;
  deviceLimit: number;
  offlineAllowed: boolean;
  maxOfflineDownloads: number;
  isPopular: boolean;
  perks: string[];
  stripePriceId?: string;
  activeSubscribers: number;
  createdAt: string;
  updatedAt: string;
}
