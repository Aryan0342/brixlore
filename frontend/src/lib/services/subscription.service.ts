import type {
  GetSubscriptionResponseDto,
  PublicPlanDto,
  SubscribeRequestDto,
  SubscribeResponseDto,
  UpdateSubscriptionRequestDto,
  UpdateSubscriptionResponseDto,
  BillingSummaryDto,
} from "@/types/api";
import { get, post, ApiError } from "@/lib/api-client";
import { getStoredAuth } from "@/lib/auth-storage";
import { getMockSubscription, setMockSubscription } from "@/lib/mock-auth";
import { USE_MOCK_API } from "./config";
import { SUBSCRIPTION_PLANS } from "@/lib/subscription-plans";
import { authService } from "./auth.service";

const SUBSCRIPTION_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** In-memory cache for GET /subscriptions/me so we don't check on every action. */
let subscriptionCache: {
  at: number;
  data: GetSubscriptionResponseDto;
} | null = null;

/**
 * Clear subscription cache (e.g. on logout so next user doesn't see stale data).
 */
function clearSubscriptionCache(): void {
  subscriptionCache = null;
}

/**
 * Subscription service. Uses real API (GET /subscriptions/me) when USE_MOCK_API is false.
 * When using the real API, subscription status is cached for 24 hours.
 */
export const subscriptionService = {
  async getPlans(): Promise<PublicPlanDto[]> {
    if (!USE_MOCK_API) {
      return get<PublicPlanDto[]>("subscriptions/plans");
    }
    try {
      return await get<PublicPlanDto[]>("subscriptions/plans");
    } catch {
      return SUBSCRIPTION_PLANS.map((plan) => ({
        id: plan.id,
        name: plan.name,
        price: Number(plan.price),
        duration: plan.period.toUpperCase(),
        deviceLimit:
          plan.benefits.find((item) => item.label === "Multi-device")?.value ===
          "Up to 6 devices"
            ? 6
            : plan.benefits.find((item) => item.label === "Multi-device")
                  ?.value === "Up to 4 devices"
              ? 4
              : 1,
        offlineAllowed: plan.benefits.some(
          (item) => item.label === "Downloads" && item.value === true,
        ),
        maxOfflineDownloads: plan.benefits.some(
          (item) => item.label === "Downloads" && item.value === true,
        )
          ? 10
          : 0,
        isPopular: plan.featured ?? false,
        perks:
          plan.benefits
            .filter((item) => item.label === "Perks")
            .map((item) => String(item.value)) ?? [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
    }
  },
  async getPlanById(planId: string): Promise<PublicPlanDto | null> {
    if (!planId.trim()) return null;
    if (!USE_MOCK_API) {
      try {
        return await get<PublicPlanDto>(`subscriptions/plans/${planId}`);
      } catch {
        return null;
      }
    }
    const plans = await this.getPlans();
    return plans.find((plan) => plan.id === planId) ?? null;
  },
  async getSubscription(): Promise<GetSubscriptionResponseDto> {
    if (USE_MOCK_API) {
      const isSubscribed = getMockSubscription();
      return {
        isSubscribed,
        planId: isSubscribed ? "monthly" : "free",
      };
    }
    const auth = getStoredAuth();
    if (!auth?.accessToken) {
      clearSubscriptionCache();
      return { isSubscribed: false };
    }
    const now = Date.now();
    if (
      subscriptionCache &&
      now - subscriptionCache.at < SUBSCRIPTION_CACHE_TTL_MS
    ) {
      return subscriptionCache.data;
    }
    try {
      const res = await get<GetSubscriptionResponseDto>("subscriptions/me", {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      const data = res ?? { isSubscribed: false };
      subscriptionCache = { at: now, data };
      return data;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await authService.getSession().catch(() => null);
        const refreshed = getStoredAuth();
        if (refreshed?.accessToken) {
          try {
            const res = await get<GetSubscriptionResponseDto>(
              "subscriptions/me",
              { headers: { Authorization: `Bearer ${refreshed.accessToken}` } },
            );
            const data = res ?? { isSubscribed: false };
            subscriptionCache = { at: Date.now(), data };
            return data;
          } catch {
            return { isSubscribed: false };
          }
        }
      }
      return { isSubscribed: false };
    }
  },

  /** Clear the 24h subscription cache (call on logout). */
  clearSubscriptionCache,

  async subscribe(body: SubscribeRequestDto): Promise<SubscribeResponseDto> {
    void body; // reserved for real API (plan selection, etc.)
    setMockSubscription(true);
    return {
      subscription: {
        isSubscribed: true,
        planId: "monthly",
        createdAt: new Date().toISOString(),
      },
    };
  },

  async updateSubscription(
    body: UpdateSubscriptionRequestDto,
  ): Promise<UpdateSubscriptionResponseDto> {
    void body; // reserved for real API
    const isSubscribed = getMockSubscription();
    return {
      subscription: {
        isSubscribed,
        planId: isSubscribed ? "monthly" : "free",
      },
    };
  },

  async createPortalSession(returnUrl?: string): Promise<{ url: string }> {
    if (USE_MOCK_API) {
      throw new Error("Billing portal is not available in mock mode.");
    }
    const auth = getStoredAuth();
    if (!auth?.accessToken) {
      throw new Error("Not authenticated");
    }
    try {
      return await post<{ url: string }>(
        "subscriptions/portal-session",
        { returnUrl },
        {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
        },
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await authService.getSession().catch(() => null);
        const refreshed = getStoredAuth();
        if (refreshed?.accessToken) {
          return post<{ url: string }>(
            "subscriptions/portal-session",
            { returnUrl },
            {
              headers: { Authorization: `Bearer ${refreshed.accessToken}` },
            },
          );
        }
      }
      throw err;
    }
  },

  async getBillingSummary(): Promise<BillingSummaryDto> {
    if (USE_MOCK_API) {
      return { paymentMethod: null, invoices: [] };
    }
    const auth = getStoredAuth();
    if (!auth?.accessToken) {
      return { paymentMethod: null, invoices: [] };
    }
    try {
      return await get<BillingSummaryDto>("subscriptions/billing-summary", {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await authService.getSession().catch(() => null);
        const refreshed = getStoredAuth();
        if (refreshed?.accessToken) {
          return get<BillingSummaryDto>("subscriptions/billing-summary", {
            headers: { Authorization: `Bearer ${refreshed.accessToken}` },
          });
        }
      }
      return { paymentMethod: null, invoices: [] };
    }
  },

  /** Local helper to set subscribed state (used by AuthContext / SubscriptionPrompt). */
  setSubscribed(subscribed: boolean): void {
    setMockSubscription(subscribed);
  },

  /** Local helper to read subscribed state from storage (used by AuthContext). */
  getSubscribed(): boolean {
    return getMockSubscription();
  },
};
