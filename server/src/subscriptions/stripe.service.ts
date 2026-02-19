import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import {
  BillingInvoiceDto,
  BillingPaymentMethodDto,
  BillingSummaryDto,
} from './dto/billing-summary.dto';

type SubscriptionStatus = 'ACTIVE' | 'CANCELLED' | 'EXPIRED';

type StripeSubscription = Stripe.Subscription & {
  current_period_start: number;
  current_period_end: number;
};

type StripeInvoiceWithIntent = Stripe.Invoice & {
  payment_intent?: Stripe.PaymentIntent | string | null;
};

type StripeInvoiceRef = StripeInvoiceWithIntent | string | null;

@Injectable()
export class StripeService {
  private stripe: Stripe | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private getStripe(): Stripe {
    if (!this.stripe) {
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key) {
        throw new BadRequestException('Stripe is not configured (STRIPE_SECRET_KEY)');
      }
      this.stripe = new Stripe(key);
    }
    return this.stripe;
  }

  private async resolvePaymentIntent(
    stripe: Stripe,
    paymentIntent: Stripe.PaymentIntent | string | null | undefined,
  ): Promise<Stripe.PaymentIntent | null> {
    if (!paymentIntent) return null;
    if (typeof paymentIntent === 'string') {
      return stripe.paymentIntents.retrieve(paymentIntent);
    }
    if (!paymentIntent.client_secret || !paymentIntent.status) {
      if (paymentIntent.id) {
        return stripe.paymentIntents.retrieve(paymentIntent.id);
      }
    }
    return paymentIntent;
  }

  private async resolvePaymentIntentFromInvoice(
    stripe: Stripe,
    invoice: StripeInvoiceRef,
  ): Promise<Stripe.PaymentIntent | null> {
    if (!invoice) return null;
    let fullInvoice: StripeInvoiceWithIntent | null = null;
    if (typeof invoice === 'string') {
      fullInvoice = (await stripe.invoices.retrieve(invoice, {
        expand: ['payment_intent'],
      })) as StripeInvoiceWithIntent;
    } else {
      fullInvoice = invoice;
    }

    let paymentIntent = fullInvoice.payment_intent ?? null;
    paymentIntent = await this.resolvePaymentIntent(stripe, paymentIntent);
    if (paymentIntent) return paymentIntent;

    if (fullInvoice.id) {
      const refreshed = (await stripe.invoices.retrieve(fullInvoice.id, {
        expand: ['payment_intent'],
      })) as StripeInvoiceWithIntent;
      return this.resolvePaymentIntent(stripe, refreshed.payment_intent ?? null);
    }
    return null;
  }

  private async resolveInvoice(
    stripe: Stripe,
    invoice: StripeInvoiceRef,
  ): Promise<StripeInvoiceWithIntent | null> {
    if (!invoice) return null;
    if (typeof invoice === 'string') {
      return (await stripe.invoices.retrieve(invoice, {
        expand: ['payment_intent'],
      })) as StripeInvoiceWithIntent;
    }
    if (invoice.id) {
      return (await stripe.invoices.retrieve(invoice.id, {
        expand: ['payment_intent'],
      })) as StripeInvoiceWithIntent;
    }
    return invoice;
  }

  private async ensureInvoiceWithIntent(
    stripe: Stripe,
    invoice: StripeInvoiceRef,
  ): Promise<StripeInvoiceWithIntent | null> {
    const resolved = await this.resolveInvoice(stripe, invoice);
    if (!resolved) return null;
    if (resolved.amount_due > 0 && !resolved.payment_intent) {
      if (resolved.status === 'draft') {
        const finalized = (await stripe.invoices.finalizeInvoice(resolved.id, {
          expand: ['payment_intent'],
        })) as StripeInvoiceWithIntent;
        return finalized;
      }
      const refreshed = (await stripe.invoices.retrieve(resolved.id, {
        expand: ['payment_intent'],
      })) as StripeInvoiceWithIntent;
      return refreshed;
    }
    return resolved;
  }

  private computePeriodFromDuration(duration: string): { startDate: Date; endDate: Date } {
    const startDate = new Date();
    const endDate = new Date(startDate);
    const normalized = duration.trim().toUpperCase();
    const numberMatch = normalized.match(/\d+/);
    const count = numberMatch ? Number(numberMatch[0]) : 1;

    if (normalized.includes('YEAR')) {
      endDate.setFullYear(endDate.getFullYear() + count);
    } else if (normalized.includes('MONTH')) {
      endDate.setMonth(endDate.getMonth() + count);
    } else if (Number.isFinite(count)) {
      endDate.setMonth(endDate.getMonth() + count);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    return { startDate, endDate };
  }

  /**
   * Create a Stripe customer + subscription for signup using a PaymentMethod ID.
   * Uses payment_behavior=error_if_incomplete to ensure payment succeeds.
   */
  async createSubscriptionForSignup(params: {
    planId: string;
    customerEmail: string;
    customerName?: string | null;
    paymentMethodId: string;
  }): Promise<{
    customerId: string;
    subscription: StripeSubscription;
  }> {
    const { planId, customerEmail, customerName, paymentMethodId } = params;
    const plan = await (this.prisma as any).plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');
    if (!plan.stripePriceId) {
      throw new BadRequestException(
        `Plan "${plan.name}" is not linked to a Stripe Price. Add stripePriceId in the database.`,
      );
    }

    const stripe = this.getStripe();
    const customer = await stripe.customers.create({
      email: customerEmail,
      name: customerName ?? undefined,
    });

    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customer.id,
    });
    await stripe.customers.update(customer.id, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    const subscription = (await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: plan.stripePriceId, quantity: 1 }],
      payment_behavior: 'error_if_incomplete',
      expand: ['latest_invoice.payment_intent'],
    })) as unknown as StripeSubscription;

    return { customerId: customer.id, subscription };
  }

  /**
   * Create subscription in default_incomplete mode and return client secret for SCA/3DS.
   * When trialPeriodDays is set, Stripe creates subscription in trialing state (no immediate charge).
   */
  async createSubscriptionIntentForSignup(params: {
    planId: string;
    customerEmail: string;
    customerName?: string | null;
    paymentMethodId: string;
    trialPeriodDays?: number;
  }): Promise<{
    customerId: string;
    subscriptionId: string;
    clientSecret: string | null;
  }> {
    const { planId, customerEmail, customerName, paymentMethodId, trialPeriodDays } = params;
    const plan = await (this.prisma as any).plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');
    if (!plan.stripePriceId) {
      throw new BadRequestException(
        `Plan "${plan.name}" is not linked to a Stripe Price. Add stripePriceId in the database.`,
      );
    }

    const stripe = this.getStripe();
    const customer = await stripe.customers.create({
      email: customerEmail,
      name: customerName ?? undefined,
    });

    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customer.id,
    });
    await stripe.customers.update(customer.id, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    const subscriptionCreateParams: Stripe.SubscriptionCreateParams = {
      customer: customer.id,
      items: [{ price: plan.stripePriceId, quantity: 1 }],
      collection_method: 'charge_automatically',
      default_payment_method: paymentMethodId,
      payment_behavior: 'default_incomplete',
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
      ...(trialPeriodDays != null && trialPeriodDays > 0
        ? { trial_period_days: trialPeriodDays }
        : {}),
    };

    // Create subscription with default_incomplete to get a PaymentIntent requiring confirmation
    const subscription = (await stripe.subscriptions.create(
      subscriptionCreateParams,
    )) as unknown as StripeSubscription & {
      latest_invoice?: StripeInvoiceRef;
    };

    // Get the invoice ID from the subscription
    const latestInvoice = subscription.latest_invoice;
    const invoiceId = typeof latestInvoice === 'string' ? latestInvoice : latestInvoice?.id;

    // Retrieve the invoice directly with payment_intent expanded
    let resolvedInvoice: StripeInvoiceWithIntent | null = null;
    if (invoiceId) {
      resolvedInvoice = (await stripe.invoices.retrieve(invoiceId, {
        expand: ['payment_intent'],
      })) as StripeInvoiceWithIntent;
    }

    let paymentIntent = await this.resolvePaymentIntent(
      stripe,
      resolvedInvoice?.payment_intent ?? null,
    );

    // If still no PaymentIntent, try paying the invoice to trigger its creation
    if (!paymentIntent && resolvedInvoice && resolvedInvoice.amount_due > 0) {
      try {
        const paidResult = await stripe.invoices.pay(resolvedInvoice.id, {
          payment_method: paymentMethodId,
          expand: ['payment_intent'],
        });
        const paidInvoice = paidResult as StripeInvoiceWithIntent;
        const refreshedInvoice = (await stripe.invoices.retrieve(resolvedInvoice.id, {
          expand: ['payment_intent'],
        })) as StripeInvoiceWithIntent;
        paymentIntent = await this.resolvePaymentIntent(
          stripe,
          refreshedInvoice.payment_intent ?? paidInvoice.payment_intent ?? null,
        );
      } catch (payErr: any) {
        console.warn('[stripe] invoice pay error', payErr?.message ?? payErr);
        // Check if error contains the PaymentIntent that requires action
        if (payErr.payment_intent) {
          paymentIntent = payErr.payment_intent;
        } else if (payErr.raw?.payment_intent) {
          paymentIntent = payErr.raw.payment_intent;
        }
      }
    }

    if (resolvedInvoice) {
      resolvedInvoice = (await stripe.invoices.retrieve(resolvedInvoice.id, {
        expand: ['payment_intent'],
      })) as StripeInvoiceWithIntent;
    }

    const invoicePaid =
      resolvedInvoice?.status === 'paid' ||
      (typeof resolvedInvoice?.amount_remaining === 'number' &&
        resolvedInvoice.amount_remaining === 0);

    if (!paymentIntent || !paymentIntent.client_secret) {
      if (invoicePaid || (resolvedInvoice && resolvedInvoice.amount_due === 0)) {
        return {
          customerId: customer.id,
          subscriptionId: subscription.id,
          clientSecret: null,
        };
      }
      throw new BadRequestException('Unable to start payment. Please try again.');
    }
    return {
      customerId: customer.id,
      subscriptionId: subscription.id,
      clientSecret: paymentIntent.client_secret,
    };
  }

  async verifySubscriptionPayment(params: {
    subscriptionId: string;
    customerId: string;
    planId: string;
  }): Promise<{
    isActive: boolean;
    startDate: Date;
    endDate: Date;
  }> {
    const { subscriptionId, customerId, planId } = params;
    const plan = await (this.prisma as any).plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');
    if (!plan.stripePriceId) {
      throw new BadRequestException('Plan is not linked to a Stripe Price.');
    }

    const stripe = this.getStripe();
    const subscription = (await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['latest_invoice.payment_intent'],
    })) as unknown as StripeSubscription & {
      latest_invoice?: StripeInvoiceRef;
    };

    const periodStart = subscription.current_period_start
      ? new Date(subscription.current_period_start * 1000)
      : null;
    const periodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : null;
    const hasValidPeriod =
      Boolean(periodStart && !Number.isNaN(periodStart.getTime())) &&
      Boolean(periodEnd && !Number.isNaN(periodEnd.getTime()));
    const fallbackPeriod = this.computePeriodFromDuration(plan.duration);
    const resolvedStartDate =
      hasValidPeriod && periodStart ? periodStart : fallbackPeriod.startDate;
    const resolvedEndDate = hasValidPeriod && periodEnd ? periodEnd : fallbackPeriod.endDate;

    const latestInvoice = subscription.latest_invoice ?? null;
    const resolvedInvoice = await this.resolveInvoice(stripe, latestInvoice);

    if (subscription.customer !== customerId) {
      throw new BadRequestException('Subscription does not match customer.');
    }

    const hasPlan = subscription.items.data.some((item) => item.price?.id === plan.stripePriceId);
    if (!hasPlan) {
      throw new BadRequestException('Subscription does not match selected plan.');
    }

    const paymentIntent = await this.resolvePaymentIntentFromInvoice(stripe, latestInvoice);
    const paymentIntentStatus = paymentIntent?.status ?? null;
    if (paymentIntent) {
      if (paymentIntentStatus !== 'succeeded' && paymentIntentStatus !== 'processing') {
        throw new BadRequestException('Payment has not completed.');
      }
      return {
        isActive: true,
        startDate: resolvedStartDate,
        endDate: resolvedEndDate,
      };
    }

    const invoicePaid =
      resolvedInvoice?.status === 'paid' ||
      (typeof resolvedInvoice?.amount_remaining === 'number' &&
        resolvedInvoice.amount_remaining === 0);

    if (invoicePaid || (resolvedInvoice && resolvedInvoice.amount_due === 0)) {
      return {
        isActive: true,
        startDate: resolvedStartDate,
        endDate: resolvedEndDate,
      };
    }

    const isActive = subscription.status === 'active' || subscription.status === 'trialing';
    if (!isActive) {
      throw new BadRequestException('Payment has not completed.');
    }
    return { isActive, startDate: resolvedStartDate, endDate: resolvedEndDate };
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    const stripe = this.getStripe();
    await stripe.subscriptions.cancel(subscriptionId);
  }

  /**
   * Get or create Stripe customer for user.
   */
  async getOrCreateStripeCustomer(
    userId: string,
    email: string,
    name?: string | null,
  ): Promise<string> {
    const user = await (this.prisma as any).user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.stripeCustomerId) return user.stripeCustomerId;

    const stripe = this.getStripe();
    const customer = await stripe.customers.create({
      email,
      name: name ?? undefined,
      metadata: { userId },
    });
    await (this.prisma as any).user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });
    return customer.id;
  }

  /**
   * Create Checkout Session for subscription. Plan must have stripePriceId set.
   */
  async createCheckoutSession(
    userId: string,
    planId: string,
    successUrl: string,
    cancelUrl: string,
    userEmail: string,
    userName?: string | null,
  ): Promise<{ url: string }> {
    const plan = await (this.prisma as any).plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');
    if (!plan.stripePriceId) {
      throw new BadRequestException(
        `Plan "${plan.name}" is not linked to a Stripe Price. Add stripePriceId in the database.`,
      );
    }

    const customerId = await this.getOrCreateStripeCustomer(userId, userEmail, userName);
    const stripe = this.getStripe();

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId, planId },
      subscription_data: {
        metadata: { userId, planId },
      },
    });

    const url = session.url;
    if (!url) throw new BadRequestException('Failed to create checkout session');
    return { url };
  }

  /**
   * Create Customer Portal session for managing subscription.
   */
  async createPortalSession(userId: string, returnUrl: string): Promise<{ url: string }> {
    const user = await (this.prisma as any).user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });
    if (!user?.stripeCustomerId) {
      throw new BadRequestException('No Stripe customer linked. Subscribe first.');
    }

    const stripe = this.getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    });
    return { url: session.url };
  }

  /**
   * Get default payment method and recent invoices for billing UI.
   */
  async getBillingSummary(userId: string): Promise<BillingSummaryDto> {
    const user = await (this.prisma as any).user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });
    if (!user?.stripeCustomerId) {
      throw new BadRequestException('No Stripe customer linked. Subscribe first.');
    }

    const stripe = this.getStripe();
    const customer = (await stripe.customers.retrieve(user.stripeCustomerId, {
      expand: ['invoice_settings.default_payment_method'],
    })) as Stripe.Customer;

    let paymentMethod: Stripe.PaymentMethod | null = null;
    const defaultPm = customer.invoice_settings?.default_payment_method ?? null;
    if (defaultPm && typeof defaultPm !== 'string') {
      paymentMethod = defaultPm as Stripe.PaymentMethod;
    } else if (typeof defaultPm === 'string') {
      paymentMethod = await stripe.paymentMethods.retrieve(defaultPm);
    }

    if (!paymentMethod) {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: user.stripeCustomerId,
        type: 'card',
        limit: 1,
      });
      paymentMethod = paymentMethods.data[0] ?? null;
    }

    const card = paymentMethod?.card ?? null;
    const paymentMethodDto: BillingPaymentMethodDto | null = card
      ? {
          brand: card.brand ?? 'card',
          last4: card.last4 ?? '----',
          expMonth: card.exp_month ?? 0,
          expYear: card.exp_year ?? 0,
        }
      : null;

    const invoices = await stripe.invoices.list({
      customer: user.stripeCustomerId,
      limit: 10,
    });

    const invoiceDtos: BillingInvoiceDto[] = invoices.data.map((invoice) => ({
      id: invoice.id,
      amountDue: invoice.amount_due ?? 0,
      amountPaid: invoice.amount_paid ?? 0,
      currency: invoice.currency ?? 'usd',
      status: invoice.status ?? 'unknown',
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      invoicePdf: invoice.invoice_pdf ?? null,
      createdAt: new Date(invoice.created * 1000).toISOString(),
    }));

    return {
      paymentMethod: paymentMethodDto,
      invoices: invoiceDtos,
    };
  }

  /**
   * Revoke offline access for a user: set all their downloads to REVOKED.
   */
  async revokeOfflineAccess(userId: string): Promise<number> {
    const result = await (this.prisma as any).download.updateMany({
      where: { userId },
      data: { status: 'REVOKED' },
    });
    return result.count;
  }

  /**
   * Sync our Subscription from Stripe subscription object. Create or update record.
   * Returns our Subscription record and whether offline was revoked (subscription ended).
   */
  async syncSubscriptionFromStripe(stripeSubscription: Stripe.Subscription): Promise<{
    subscriptionId: string;
    userId: string;
    revokedOffline: boolean;
  }> {
    const stripeSubId = stripeSubscription.id;
    const userId = stripeSubscription.metadata?.userId as string | undefined;
    const planId = stripeSubscription.metadata?.planId as string | undefined;

    if (!userId || !planId) {
      throw new BadRequestException('Stripe subscription missing metadata userId/planId');
    }

    const plan = await (this.prisma as any).plan.findUnique({ where: { id: planId } });
    if (!plan) throw new BadRequestException('Plan not found');

    const sub = stripeSubscription as StripeSubscription;
    const startDate = new Date(sub.current_period_start * 1000);
    const endDate = new Date(sub.current_period_end * 1000);
    const isActive =
      stripeSubscription.status === 'active' || stripeSubscription.status === 'trialing';

    const status: SubscriptionStatus = isActive
      ? 'ACTIVE'
      : stripeSubscription.status === 'canceled' || stripeSubscription.cancel_at_period_end
        ? 'CANCELLED'
        : 'EXPIRED';

    const existing = await (this.prisma as any).subscription.findUnique({
      where: { stripeSubscriptionId: stripeSubId },
    });

    let revokedOffline = false;
    if (existing) {
      const wasActive = existing.status === 'ACTIVE';
      await (this.prisma as any).subscription.update({
        where: { id: existing.id },
        data: { status, startDate, endDate },
      });
      if (wasActive && !isActive) {
        await this.revokeOfflineAccess(userId);
        revokedOffline = true;
      }
      return { subscriptionId: existing.id, userId, revokedOffline };
    }

    if (!isActive) {
      await this.revokeOfflineAccess(userId);
      revokedOffline = true;
    }

    const created = await (this.prisma as any).subscription.create({
      data: {
        userId,
        planId,
        stripeSubscriptionId: stripeSubId,
        status,
        startDate,
        endDate,
      },
    });
    return { subscriptionId: created.id, userId, revokedOffline };
  }

  /**
   * Handle Stripe webhook event. Verify signature with STRIPE_WEBHOOK_SECRET.
   */
  async handleWebhookEvent(rawBody: Buffer, signature: string): Promise<void> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new BadRequestException('STRIPE_WEBHOOK_SECRET is not set');
    }

    const stripe = this.getStripe();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid signature';
      throw new BadRequestException(`Webhook signature verification failed: ${message}`);
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription' || !session.subscription) break;
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string, {
          expand: [],
        });
        await this.syncSubscriptionFromStripe(subscription);
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as StripeSubscription;
        await this.syncSubscriptionFromStripe(sub);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as StripeSubscription;
        const stripeSubId = subscription.id;
        const existing = await (this.prisma as any).subscription.findUnique({
          where: { stripeSubscriptionId: stripeSubId },
          select: { id: true, userId: true },
        });
        if (existing) {
          await (this.prisma as any).subscription.update({
            where: { id: existing.id },
            data: { status: 'EXPIRED', endDate: new Date() },
          });
          await this.revokeOfflineAccess(existing.userId);
        }
        break;
      }
      default:
        // Ignore other events
        break;
    }
  }
}
