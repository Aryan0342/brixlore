"use client";

import { useEffect, useState } from "react";
import { adminService } from "@/lib/services";
import type { AdminPlanDto } from "@/types/api";
import { Button, Loader } from "@/components/ui";
import { useAuth } from "@/contexts";

type PlanDraft = {
  name: string;
  price: string;
  duration: string;
  deviceLimit: number;
  offlineAllowed: boolean;
  maxOfflineDownloads: number;
  isPopular: boolean;
  perks: string[];
  stripePriceId?: string;
};

export default function AdminPlansPage() {
  const { user } = useAuth();
  const isReadOnly = user?.role === "CUSTOMER_SUPPORT";
  const [plans, setPlans] = useState<AdminPlanDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, PlanDraft>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<PlanDraft>({
    name: "",
    price: "",
    duration: "MONTHLY",
    deviceLimit: 1,
    offlineAllowed: false,
    maxOfflineDownloads: 0,
    isPopular: false,
    perks: [],
    stripePriceId: "",
  });
  const [createPerkInput, setCreatePerkInput] = useState("");
  const [perkInputs, setPerkInputs] = useState<Record<string, string>>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await adminService.getPlans();
      setPlans(data);
      const seededDrafts: Record<string, PlanDraft> = {};
      for (const plan of data) {
        seededDrafts[plan.id] = {
          name: plan.name,
          price: plan.price,
          duration: plan.duration,
          deviceLimit: plan.deviceLimit,
          offlineAllowed: plan.offlineAllowed,
          maxOfflineDownloads: plan.maxOfflineDownloads,
          isPopular: plan.isPopular,
          perks: plan.perks ?? [],
          stripePriceId: plan.stripePriceId,
        };
      }
      setDrafts(seededDrafts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load plans.");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(plan: AdminPlanDto) {
    if (isReadOnly) {
      setSaveError("Customer Support accounts have read-only access.");
      return;
    }
    setNotice(null);
    setSaveError(null);
    setEditingId(plan.id);
  }

  function cancelEdit() {
    setEditingId(null);
    setSaveError(null);
  }

  function resetCreateForm() {
    setCreateDraft({
      name: "",
      price: "",
      duration: "MONTHLY",
      deviceLimit: 1,
      offlineAllowed: false,
      maxOfflineDownloads: 0,
      isPopular: false,
      perks: [],
      stripePriceId: "",
    });
    setCreatePerkInput("");
    setCreateError(null);
  }

  async function handleCreatePlan(e: React.FormEvent) {
    e.preventDefault();
    if (isReadOnly) {
      setCreateError("Customer Support accounts have read-only access.");
      return;
    }
    setCreateError(null);
    setNotice(null);

    if (!createDraft.name.trim()) {
      setCreateError("Plan name is required.");
      return;
    }
    if (!createDraft.price.trim()) {
      setCreateError("Price is required.");
      return;
    }
    if (!createDraft.duration.trim()) {
      setCreateError("Duration is required.");
      return;
    }

    setCreating(true);
    try {
      const created = await adminService.createPlan({
        name: createDraft.name.trim(),
        price: createDraft.price.trim(),
        duration: createDraft.duration.trim(),
        deviceLimit: createDraft.deviceLimit,
        offlineAllowed: createDraft.offlineAllowed,
        maxOfflineDownloads: createDraft.maxOfflineDownloads,
        isPopular: createDraft.isPopular,
        perks: createDraft.perks,
        stripePriceId: createDraft.stripePriceId?.trim() || undefined,
      });
      setPlans((prev) => {
        const next = [created, ...prev];
        if (!created.isPopular) return next;
        return next.map((plan) =>
          plan.id === created.id ? plan : { ...plan, isPopular: false },
        );
      });
      setDrafts((prev) => {
        const next: Record<string, PlanDraft> = { ...prev };
        if (created.isPopular) {
          for (const [key, value] of Object.entries(next)) {
            next[key] = { ...value, isPopular: false };
          }
        }
        next[created.id] = {
          name: created.name,
          price: created.price,
          duration: created.duration,
          deviceLimit: created.deviceLimit,
          offlineAllowed: created.offlineAllowed,
          maxOfflineDownloads: created.maxOfflineDownloads,
          isPopular: created.isPopular,
          perks: created.perks ?? [],
          stripePriceId: created.stripePriceId,
        };
        return next;
      });
      setNotice("Plan created.");
      setCreateOpen(false);
      resetCreateForm();
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create plan.",
      );
    } finally {
      setCreating(false);
    }
  }

  function updateDraft(id: string, patch: Partial<PlanDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  }

  function addCreatePerk() {
    const value = createPerkInput.trim();
    if (!value) return;
    setCreateDraft((prev) => ({
      ...prev,
      perks: Array.from(new Set([...(prev.perks ?? []), value])).slice(0, 12),
    }));
    setCreatePerkInput("");
  }

  function removeCreatePerk(perk: string) {
    setCreateDraft((prev) => ({
      ...prev,
      perks: prev.perks.filter((item) => item !== perk),
    }));
  }

  function addDraftPerk(id: string) {
    const input = (perkInputs[id] ?? "").trim();
    if (!input) return;
    updateDraft(id, {
      perks: Array.from(new Set([...(drafts[id]?.perks ?? []), input])).slice(
        0,
        12,
      ),
    });
    setPerkInputs((prev) => ({ ...prev, [id]: "" }));
  }

  function removeDraftPerk(id: string, perk: string) {
    updateDraft(id, {
      perks: (drafts[id]?.perks ?? []).filter((item) => item !== perk),
    });
  }

  async function saveDraft(id: string) {
    const next = drafts[id];
    if (!next) return;
    if (isReadOnly) {
      setSaveError("Customer Support accounts have read-only access.");
      return;
    }
    setSavingId(id);
    setSaveError(null);
    try {
      const updated = await adminService.updatePlan(id, {
        name: next.name.trim(),
        price: next.price,
        duration: next.duration,
        deviceLimit: next.deviceLimit,
        offlineAllowed: next.offlineAllowed,
        maxOfflineDownloads: next.maxOfflineDownloads,
        isPopular: next.isPopular,
        perks: next.perks,
        stripePriceId: next.stripePriceId?.trim() || undefined,
      });
      setPlans((prev) =>
        prev.map((plan) => {
          if (plan.id === id) return updated;
          if (updated.isPopular) return { ...plan, isPopular: false };
          return plan;
        }),
      );
      setDrafts((prev) => {
        if (!updated.isPopular) return prev;
        const nextDrafts: Record<string, PlanDraft> = { ...prev };
        for (const key of Object.keys(nextDrafts)) {
          if (key !== id) {
            nextDrafts[key] = { ...nextDrafts[key], isPopular: false };
          }
        }
        return nextDrafts;
      });
      setNotice("Plan changes saved.");
      setEditingId(null);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to update plan.",
      );
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(plan: AdminPlanDto) {
    if (isReadOnly) {
      setSaveError("Customer Support accounts have read-only access.");
      return;
    }
    const ok = window.confirm(
      `Delete plan "${plan.name}"? This cannot be undone.`,
    );
    if (!ok) return;
    setDeletingId(plan.id);
    setSaveError(null);
    setNotice(null);
    try {
      const res = await adminService.deletePlan(plan.id);
      setPlans((prev) => prev.filter((p) => p.id !== plan.id));
      setNotice(res.message);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to delete plan.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-neutral-700/50 bg-neutral-900/50 py-12">
        <Loader size="lg" label="Loading plans…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/20 py-12 text-center">
        <p className="text-red-300">{error}</p>
        <Button
          type="button"
          variant="secondary"
          className="mt-4"
          onClick={() => void load()}
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Plans
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          Manage subscription tiers, pricing, and access limits.
        </p>
      </header>

      {notice ? (
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-300">
          {notice}
        </div>
      ) : null}
      {saveError ? (
        <div className="rounded-xl border border-red-900/50 bg-red-950/20 px-4 py-3 text-sm text-red-300">
          {saveError}
        </div>
      ) : null}
      {isReadOnly ? (
        <div className="rounded-xl border border-neutral-700/60 bg-neutral-900/60 px-4 py-3 text-sm text-neutral-300">
          Read-only access: Customer Support accounts can view plans but cannot
          create or edit them.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-500">
          Create new plans and update existing tiers in one place.
        </p>
        <Button
          type="button"
          onClick={() => setCreateOpen((prev) => !prev)}
          disabled={isReadOnly}
        >
          {createOpen ? "Close" : "New plan"}
        </Button>
      </div>

      {createOpen ? (
        <div className="rounded-2xl border border-neutral-700/50 bg-neutral-900/60 p-6">
          <h2 className="text-lg font-semibold text-white">Create plan</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Define pricing, access limits, and offline entitlements.
          </p>
          <form onSubmit={handleCreatePlan} className="mt-5 space-y-4">
            {createError ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">
                {createError}
              </p>
            ) : null}
            <div className="grid gap-3">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                Plan name
              </label>
              <input
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
                value={createDraft.name}
                onChange={(e) =>
                  setCreateDraft((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                placeholder="Plan name"
                disabled={isReadOnly || creating}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                    Price
                  </label>
                  <input
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
                    value={createDraft.price}
                    onChange={(e) =>
                      setCreateDraft((prev) => ({
                        ...prev,
                        price: e.target.value,
                      }))
                    }
                    placeholder="Price"
                    disabled={isReadOnly || creating}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                    Duration
                  </label>
                  <input
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
                    value={createDraft.duration}
                    onChange={(e) =>
                      setCreateDraft((prev) => ({
                        ...prev,
                        duration: e.target.value,
                      }))
                    }
                    placeholder="Duration (e.g. MONTHLY)"
                    disabled={isReadOnly || creating}
                  />
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                  Device limit
                </label>
                <input
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
                  value={createDraft.deviceLimit}
                  onChange={(e) =>
                    setCreateDraft((prev) => ({
                      ...prev,
                      deviceLimit: Number(e.target.value) || 0,
                    }))
                  }
                  placeholder="Device limit"
                  type="number"
                  min={0}
                  disabled={isReadOnly || creating}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                  Max offline downloads
                </label>
                <input
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
                  value={createDraft.maxOfflineDownloads}
                  onChange={(e) =>
                    setCreateDraft((prev) => ({
                      ...prev,
                      maxOfflineDownloads: Number(e.target.value) || 0,
                    }))
                  }
                  placeholder="Max offline downloads"
                  type="number"
                  min={0}
                  disabled={isReadOnly || creating}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                  Offline access
                </label>
                <select
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
                  value={createDraft.offlineAllowed ? "yes" : "no"}
                  onChange={(e) =>
                    setCreateDraft((prev) => ({
                      ...prev,
                      offlineAllowed: e.target.value === "yes",
                    }))
                  }
                  disabled={isReadOnly || creating}
                >
                  <option value="yes">Offline enabled</option>
                  <option value="no">Offline disabled</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                  Stripe price ID
                </label>
                <input
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
                  value={createDraft.stripePriceId ?? ""}
                  onChange={(e) =>
                    setCreateDraft((prev) => ({
                      ...prev,
                      stripePriceId: e.target.value,
                    }))
                  }
                  placeholder="Stripe price ID"
                  disabled={isReadOnly || creating}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="create-popular"
                type="checkbox"
                className="h-4 w-4 rounded border-neutral-700 bg-neutral-950 text-accent"
                checked={createDraft.isPopular}
                onChange={(e) =>
                  setCreateDraft((prev) => ({
                    ...prev,
                    isPopular: e.target.checked,
                  }))
                }
                disabled={isReadOnly || creating}
              />
              <label
                htmlFor="create-popular"
                className="text-sm text-neutral-300"
              >
                Mark as Most Popular
              </label>
            </div>
            <div className="space-y-3">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                Extra perks
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  className="flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
                  value={createPerkInput}
                  onChange={(e) => setCreatePerkInput(e.target.value)}
                  placeholder="Add a perk (e.g. Early access)"
                  disabled={isReadOnly || creating}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addCreatePerk}
                  disabled={isReadOnly || creating}
                >
                  Add perk
                </Button>
              </div>
              {createDraft.perks.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {createDraft.perks.map((perk) => (
                    <button
                      key={perk}
                      type="button"
                      className="rounded-full border border-neutral-700/60 px-3 py-1 text-xs text-neutral-300 hover:border-accent hover:text-accent"
                      onClick={() => removeCreatePerk(perk)}
                      disabled={isReadOnly || creating}
                    >
                      {perk} ×
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-neutral-500">No perks added yet.</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={creating || isReadOnly}>
                {creating ? "Creating…" : "Create plan"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={resetCreateForm}
                disabled={isReadOnly || creating}
              >
                Reset
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {plans.length === 0 ? (
        <div className="rounded-xl border border-neutral-700/50 bg-neutral-900/50 py-12 text-center">
          <p className="text-neutral-400">No plans configured yet.</p>
        </div>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => {
            const isEditing = editingId === plan.id;
            const current = drafts[plan.id];
            return (
              <div
                key={plan.id}
                className={`rounded-2xl border bg-neutral-900/60 p-6 ${
                  isEditing
                    ? "border-accent/70 shadow-[0_0_0_1px_rgba(229,231,235,0.35)]"
                    : "border-neutral-700/50"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-white">
                        {plan.name}
                      </h2>
                      {plan.isPopular ? (
                        <span className="rounded-full border border-neutral-500/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-200">
                          Most popular
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-neutral-500">
                      {plan.duration}
                    </p>
                  </div>
                  <span className="rounded-full border border-neutral-700/60 px-2 py-1 text-xs text-neutral-300">
                    {plan.activeSubscribers} active
                  </span>
                </div>
                <p className="mt-4 text-3xl font-semibold text-white">
                  ${plan.price}
                </p>
                <p className="mt-1 text-sm text-neutral-400">
                  per {plan.duration.toLowerCase()}
                </p>
                <div className="mt-4 space-y-2 text-sm text-neutral-300">
                  <p>Device limit: {plan.deviceLimit}</p>
                  <p>
                    Offline access:{" "}
                    {plan.offlineAllowed ? "Enabled" : "Not included"}
                  </p>
                  <p>Max offline downloads: {plan.maxOfflineDownloads}</p>
                  {plan.perks.length > 0 ? (
                    <div className="pt-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                        Perks
                      </p>
                      <ul className="mt-2 space-y-1 text-sm text-neutral-300">
                        {plan.perks.map((perk) => (
                          <li key={perk}>• {perk}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => startEdit(plan)}
                    disabled={isReadOnly}
                  >
                    Edit plan
                  </Button>
                  <Button type="button" size="sm" variant="outline">
                    View subscribers
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleDelete(plan)}
                    disabled={isReadOnly || deletingId === plan.id}
                  >
                    {deletingId === plan.id ? "Deleting…" : "Delete"}
                  </Button>
                </div>

                {isEditing && current ? (
                  <div className="mt-6 space-y-4 border-t border-neutral-800 pt-5">
                    <div className="grid gap-3">
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                        Plan details
                      </label>
                      <input
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
                        value={current.name}
                        onChange={(e) =>
                          updateDraft(plan.id, { name: e.target.value })
                        }
                        placeholder="Plan name"
                        disabled={isReadOnly || savingId === plan.id}
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
                          value={current.price}
                          onChange={(e) =>
                            updateDraft(plan.id, { price: e.target.value })
                          }
                          placeholder="Price"
                          disabled={isReadOnly || savingId === plan.id}
                        />
                        <input
                          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
                          value={current.duration}
                          onChange={(e) =>
                            updateDraft(plan.id, { duration: e.target.value })
                          }
                          placeholder="Duration"
                          disabled={isReadOnly || savingId === plan.id}
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
                        value={current.deviceLimit}
                        onChange={(e) =>
                          updateDraft(plan.id, {
                            deviceLimit: Number(e.target.value) || 0,
                          })
                        }
                        placeholder="Device limit"
                        type="number"
                        min={0}
                        disabled={isReadOnly || savingId === plan.id}
                      />
                      <input
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
                        value={current.maxOfflineDownloads}
                        onChange={(e) =>
                          updateDraft(plan.id, {
                            maxOfflineDownloads: Number(e.target.value) || 0,
                          })
                        }
                        placeholder="Max offline downloads"
                        type="number"
                        min={0}
                        disabled={isReadOnly || savingId === plan.id}
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <select
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
                        value={current.offlineAllowed ? "yes" : "no"}
                        onChange={(e) =>
                          updateDraft(plan.id, {
                            offlineAllowed: e.target.value === "yes",
                          })
                        }
                        disabled={isReadOnly || savingId === plan.id}
                      >
                        <option value="yes">Offline enabled</option>
                        <option value="no">Offline disabled</option>
                      </select>
                      <input
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
                        value={current.stripePriceId ?? ""}
                        onChange={(e) =>
                          updateDraft(plan.id, {
                            stripePriceId: e.target.value || undefined,
                          })
                        }
                        placeholder="Stripe price ID"
                        disabled={isReadOnly || savingId === plan.id}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        id={`popular-${plan.id}`}
                        type="checkbox"
                        className="h-4 w-4 rounded border-neutral-700 bg-neutral-950 text-accent"
                        checked={current.isPopular}
                        onChange={(e) =>
                          updateDraft(plan.id, {
                            isPopular: e.target.checked,
                          })
                        }
                        disabled={isReadOnly || savingId === plan.id}
                      />
                      <label
                        htmlFor={`popular-${plan.id}`}
                        className="text-sm text-neutral-300"
                      >
                        Mark as Most Popular
                      </label>
                    </div>
                    <div className="space-y-3">
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                        Extra perks
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <input
                          className="flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
                          value={perkInputs[plan.id] ?? ""}
                          onChange={(e) =>
                            setPerkInputs((prev) => ({
                              ...prev,
                              [plan.id]: e.target.value,
                            }))
                          }
                          placeholder="Add a perk"
                          disabled={isReadOnly || savingId === plan.id}
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => addDraftPerk(plan.id)}
                          disabled={isReadOnly || savingId === plan.id}
                        >
                          Add perk
                        </Button>
                      </div>
                      {current.perks.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {current.perks.map((perk) => (
                            <button
                              key={perk}
                              type="button"
                              className="rounded-full border border-neutral-700/60 px-3 py-1 text-xs text-neutral-300 hover:border-accent hover:text-accent"
                              onClick={() => removeDraftPerk(plan.id, perk)}
                              disabled={isReadOnly || savingId === plan.id}
                            >
                              {perk} ×
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-500">
                          No perks added yet.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={savingId === plan.id || isReadOnly}
                        onClick={() => void saveDraft(plan.id)}
                      >
                        {savingId === plan.id ? "Saving…" : "Save changes"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={cancelEdit}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
