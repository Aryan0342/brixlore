"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { HLSVideoPlayerLazy } from "@/components/player";
import { SubscriptionPrompt } from "@/components/content";
import { useAuth } from "@/contexts";
import { contentService, streamingService } from "@/lib/services";
import { ApiError } from "@/lib/api-client";
import type { ContentDetailDto, PlaybackType } from "@/types/api";
import { formatDuration, isLongForm, durationToSeconds } from "@/lib/video-utils";
import { DEFAULT_HLS_TEST_STREAM } from "@/lib/hls-streams";
import {
  Loader,
  Modal,
  ModalContent,
  ModalFooter,
  Button,
} from "@/components/ui";

type WatchPageClientProps = {
  params: { id: string };
};

type DisplayContent = {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl: string | null;
  category?: string;
  releaseYear?: number;
  duration?: string;
};

type PlayableEpisode = {
  id: string;
  title: string;
  duration?: string;
};

function toDisplayContent(dto: ContentDetailDto): DisplayContent {
  return {
    id: dto.id,
    title: dto.title,
    description: dto.description,
    thumbnailUrl: dto.thumbnailUrl ?? null,
    category: dto.category,
    releaseYear: dto.releaseYear,
    duration: dto.duration,
  };
}

function pickPrimaryEpisode(content: ContentDetailDto): PlayableEpisode | null {
  // If seasons exist, select the first episode from the first season
  if (content.seasons && content.seasons.length > 0 && content.episodes) {
    const firstSeason = content.seasons[0];
    const firstSeasonEpisodes = content.episodes
      .filter((e) => e.seasonId === firstSeason.id)
      .sort((a, b) => a.episodeNumber - b.episodeNumber);
    if (firstSeasonEpisodes.length > 0) {
      const first = firstSeasonEpisodes[0];
      return {
        id: first.id,
        title: first.title,
        duration: first.duration,
      };
    }
  }
  // Otherwise, use the first episode from the episodes array
  const firstEpisode = content.episodes?.[0];
  if (firstEpisode) {
    return {
      id: firstEpisode.id,
      title: firstEpisode.title,
      duration: firstEpisode.duration,
    };
  }
  // Fallback to trailer if available
  if (content.trailer) {
    return {
      id: content.trailer.id,
      title: content.trailer.title,
      duration: content.trailer.duration,
    };
  }
  return null;
}

export default function WatchPageClient({ params }: WatchPageClientProps) {
  const { id } = params;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const episodeIdFromUrl = searchParams.get("episodeId")?.trim() || null;
  const { isSubscribed, isLoading: authLoading } = useAuth();
  const [content, setContent] = useState<ContentDetailDto | null>(null);
  const [primaryEpisode, setPrimaryEpisode] = useState<PlayableEpisode | null>(
    null,
  );
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [playbackType, setPlaybackType] = useState<PlaybackType | undefined>();
  const [loading, setLoading] = useState(true);
  const [usingDevStream, setUsingDevStream] = useState(false);
  /** Set when playback permission is denied (401/403) or unavailable. */
  const [playbackError, setPlaybackError] = useState<
    "unauthorized" | "forbidden" | "unavailable" | "config_required" | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    setPlaybackError(null);
    setUsingDevStream(false);
    if (process.env.NODE_ENV !== "production") {
      //console.log("[Watch] loading content", { contentId: id });
    }
    (async () => {
      setLoading(true);
      try {
        const detailRes = await contentService.getContentById(id);
        if (cancelled) return;
        const contentDetail = detailRes?.content ?? null;
        setContent(contentDetail);
        if (!contentDetail) return;
        let episode: PlayableEpisode | null = null;
        if (episodeIdFromUrl) {
          const fromList = contentDetail.episodes?.find(
            (e) => e.id === episodeIdFromUrl,
          );
          if (fromList) {
            episode = {
              id: fromList.id,
              title: fromList.title,
              duration: fromList.duration,
            };
          }
          if (!episode && contentDetail.seasons?.length) {
            for (const season of contentDetail.seasons) {
              const episodes = await contentService.getEpisodes(
                contentDetail.id,
                season.id,
              );
              if (cancelled) return;
              const found = episodes?.find((e) => e.id === episodeIdFromUrl);
              if (found) {
                episode = {
                  id: found.id,
                  title: found.title,
                  duration: found.duration,
                };
                break;
              }
            }
          }
        }
        if (!episode) episode = pickPrimaryEpisode(contentDetail);
        if (!episode && contentDetail.seasons?.length) {
          const seasonId = contentDetail.seasons[0]?.id;
          const episodes = await contentService.getEpisodes(
            contentDetail.id,
            seasonId,
          );
          if (cancelled) return;
          const first = episodes?.[0];
          if (first) {
            episode = {
              id: first.id,
              title: first.title,
              duration: first.duration,
            };
          }
        }
        setPrimaryEpisode(episode);
        if (!episode) {
          if (process.env.NODE_ENV !== "production") {
            setStreamUrl(DEFAULT_HLS_TEST_STREAM);
            setUsingDevStream(true);
          }
          return;
        }
        // Playback metadata is authorized by the backend; the stream URL is built for the Worker.
        const playbackRes = await streamingService.getPlaybackInfo(episode.id);
        if (cancelled) return;
        if (!playbackRes?.url) {
          setStreamUrl(null);
          setPlaybackError("unavailable");
          setPlaybackType(undefined);
          if (process.env.NODE_ENV !== "production") {
            //console.warn("[Watch] missing playback URL", playbackRes);
          }
        } else {
          setStreamUrl(playbackRes.url);
          setPlaybackType(playbackRes.type);
          if (process.env.NODE_ENV !== "production") {
            //console.log("[Watch] playback URL", playbackRes.url);
            if (playbackRes.streamKey) {
              //console.log("[Watch] playback streamKey", playbackRes.streamKey);
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          const isWorkerConfigMissing =
            err instanceof ApiError &&
            err.status === 500 &&
            (err.message?.includes("R2 worker") ||
              err.message?.includes("worker base URL"));
          if (isWorkerConfigMissing) {
            setStreamUrl(null);
            setPlaybackType(undefined);
            setPlaybackError("config_required");
          } else if (process.env.NODE_ENV !== "production" && !(err instanceof ApiError)) {
            setStreamUrl(DEFAULT_HLS_TEST_STREAM);
            setUsingDevStream(true);
            setPlaybackError(null);
            setPlaybackType("hls");
          } else if (process.env.NODE_ENV === "production" || err instanceof ApiError) {
            setStreamUrl(null);
            setPlaybackType(undefined);
            if (err instanceof ApiError) {
              if (err.status === 401) setPlaybackError("unauthorized");
              else if (err.status === 403) setPlaybackError("forbidden");
              else setPlaybackError("unavailable");
            } else {
              setPlaybackError("unavailable");
            }
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, episodeIdFromUrl]);

  const displayContent = content ? toDisplayContent(content) : null;
  const title = displayContent?.title ?? `Content ${id}`;
  const longForm = displayContent ? isLongForm(displayContent) : false;
  const [offlineModalOpen, setOfflineModalOpen] = useState(false);

  if (authLoading || loading) {
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center px-4 py-12">
        <Loader size="lg" label="Loading video…" />
      </main>
    );
  }

  if (!content) {
    return (
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-4 py-12">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
          Content not found
        </h2>
        <p className="text-center text-neutral-600 dark:text-neutral-400">
          The content you’re looking for doesn’t exist or is no longer
          available.
        </p>
        <a
          href="/browse"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Browse content
        </a>
      </main>
    );
  }

  if (content && playbackError) {
    const returnUrl = pathname ?? `/watch/${id}`;
    return (
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-4 py-12">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
          {playbackError === "unauthorized"
            ? "Sign in to watch"
            : playbackError === "forbidden"
              ? "Active subscription required"
              : playbackError === "config_required"
                ? "Video playback not configured"
                : "Playback not available"}
        </h2>
        <p className="text-center text-neutral-600 dark:text-neutral-400 max-w-md">
          {playbackError === "unauthorized"
            ? "You need to sign in to stream this video."
            : playbackError === "forbidden"
              ? "An active subscription is required to watch. Subscribe to get access."
              : playbackError === "config_required"
                ? "Set NEXT_PUBLIC_R2_WORKER_BASE_URL in your frontend .env to the base URL of your R2 media worker (no trailing slash). The frontend loads video directly from that worker using the stream key returned by the backend."
                : "This video cannot be played right now. Try again later."}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {playbackError === "unauthorized" && (
            <Link
              href={`/login?returnUrl=${encodeURIComponent(returnUrl)}`}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Sign in
            </Link>
          )}
          {(playbackError === "forbidden" ||
            playbackError === "unauthorized") && (
            <Link
              href={`/subscription?returnUrl=${encodeURIComponent(returnUrl)}`}
              className="inline-flex h-10 items-center justify-center rounded-lg border-2 border-accent px-4 text-sm font-medium text-accent hover:bg-accent/10"
            >
              View plans
            </Link>
          )}
          <Link href="/browse">
            <Button type="button" variant="secondary">
              Browse content
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  if (!streamUrl) {
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center px-4 py-12">
        <p className="text-neutral-600 dark:text-neutral-400">
          Playback is not available for this content.
        </p>
      </main>
    );
  }

  // If a stream URL is available, show the player. Subscription is enforced server-side.
  const showPlayer = Boolean(streamUrl);
  const showSubscribePrompt = !showPlayer && !isSubscribed;

  return (
    <main className="min-h-0 min-w-0 flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto w-full min-w-0 max-w-5xl">
        {usingDevStream && (
          <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 sm:px-4">
            Using a dev test stream because real playback is not configured yet.
          </div>
        )}
        <section className="mb-4 sm:mb-6" aria-label="Video player">
          {showPlayer ? (
            <div className="aspect-video w-full min-w-0 overflow-hidden rounded-xl border border-neutral-700/60 bg-neutral-950 shadow-lg">
              {playbackType === "mp4" ? (
                <video
                  controls
                  playsInline
                  preload="auto"
                  className="h-full w-full"
                  src={streamUrl}
                />
              ) : (
                <HLSVideoPlayerLazy
                  src={streamUrl}
                  type={playbackType}
                  title={title}
                  className="vjs-theme-stream"
                  onProgress={
                    primaryEpisode
                      ? (progressSeconds) => {
                          const durationSec = durationToSeconds(
                            primaryEpisode?.duration,
                          );
                          void streamingService.reportProgress(
                            primaryEpisode.id,
                            progressSeconds,
                            durationSec > 0 ? durationSec : undefined,
                          );
                        }
                      : undefined
                  }
                  onReady={(player) => {
                    player.on("error", () => {});
                    player.on("loadedmetadata", () => {});
                  }}
                />
              )}
            </div>
          ) : showSubscribePrompt ? (
            <div className="overflow-hidden rounded-xl shadow-lg ring-1 ring-neutral-200 dark:ring-neutral-800">
              <SubscriptionPrompt
                contentTitle={title}
                returnUrl={pathname ?? `/watch/${id}`}
                className="rounded-xl border-0"
              />
            </div>
          ) : null}
        </section>

        {/* Title */}
        <header className="mb-3 sm:mb-4">
          <h1 className="break-words text-xl font-bold text-neutral-900 dark:text-white sm:text-2xl lg:text-3xl">
            {title}
          </h1>
        </header>

        {/* Metadata row: duration, category, date, long-form badge */}
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 sm:mb-6 sm:gap-x-4 sm:gap-y-2">
          {(primaryEpisode?.duration ?? displayContent?.duration) && (
            <span
              title={`Duration: ${
                primaryEpisode?.duration ?? displayContent?.duration
              }`}
            >
              {formatDuration(
                primaryEpisode?.duration ?? displayContent?.duration ?? "0:00",
              )}
            </span>
          )}
          {displayContent?.category && (
            <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
              {displayContent.category}
            </span>
          )}
          {displayContent?.releaseYear && (
            <span>{displayContent.releaseYear}</span>
          )}
          {longForm && (
            <span
              className="rounded-full bg-neutral-100 px-2.5 py-0.5 font-medium text-neutral-800 dark:bg-neutral-800/70 dark:text-neutral-200"
              aria-label="Long-form content"
            >
              Long-form
            </span>
          )}
          <button
            type="button"
            onClick={() => setOfflineModalOpen(true)}
            className="inline-flex min-w-0 shrink-0 items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1.5 font-medium text-neutral-700 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 dark:focus-visible:ring-neutral-100 dark:focus-visible:ring-offset-neutral-900 touch-manipulation"
            aria-label="Download for offline viewing — opens info"
          >
            <span aria-hidden>⬇</span>
            <span className="whitespace-nowrap">Download for Offline</span>
          </button>
        </div>

        <Modal
          isOpen={offlineModalOpen}
          onClose={() => setOfflineModalOpen(false)}
          title="Download for Offline"
        >
          <ModalContent>
            <p className="text-neutral-600 dark:text-neutral-300">
              Offline downloads let you save videos to your device and watch
              them without an internet connection.
            </p>
            <p className="mt-3 text-neutral-600 dark:text-neutral-300">
              <strong className="text-neutral-900 dark:text-white">
                Offline downloads are available on our iOS and Android apps.
              </strong>{" "}
              Install the BRIXLORE app from the App Store or Google Play, sign
              in with your subscription account, and use the download button on
              supported videos.
            </p>
            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
              This feature is not available in the web player. Download the
              mobile app to watch offline.
            </p>
          </ModalContent>
          <ModalFooter>
            <Button
              type="button"
              variant="primary"
              onClick={() => setOfflineModalOpen(false)}
            >
              Got it
            </Button>
          </ModalFooter>
        </Modal>

        {/* Description — supports long-form content (1–3+ hours) */}
        <section
          className="border-t border-neutral-200 pt-4 dark:border-neutral-800 sm:pt-6"
          aria-labelledby="description-heading"
        >
          <h2 id="description-heading" className="sr-only">
            Description
          </h2>
          <div className="min-w-0 max-w-none">
            {displayContent?.description ? (
              <p className="break-words whitespace-pre-wrap text-neutral-600 leading-relaxed dark:text-neutral-400">
                {displayContent.description}
              </p>
            ) : (
              <p className="text-neutral-500 dark:text-neutral-400">
                No description available.
              </p>
            )}
          </div>
        </section>

        {/* Episodes & Seasons List */}
        {content &&
        (content.type === "SERIES" || content.type === "ANIMATION") &&
        ((content.seasons?.length ?? 0) > 0 || (content.episodes?.length ?? 0) > 0) ? (
          <section
            className="mt-6 border-t border-neutral-200 pt-4 dark:border-neutral-800 sm:mt-8 sm:pt-6"
            aria-labelledby="episodes-heading"
          >
            <h2
              id="episodes-heading"
              className="mb-3 text-lg font-semibold text-neutral-900 dark:text-white sm:mb-4 sm:text-xl"
            >
              Episodes & Seasons
            </h2>
            {content.seasons && content.seasons.length > 0 ? (
              <div className="space-y-6">
                {content.seasons
                  .sort((a, b) => a.seasonNumber - b.seasonNumber)
                  .map((season) => {
                    const seasonEpisodes =
                      content.episodes?.filter(
                        (e) => e.seasonId === season.id,
                      ) ?? [];
                    return (
                      <div key={season.id}>
                        <h3 className="mb-3 text-lg font-medium text-neutral-800 dark:text-neutral-200">
                          {season.title || `Season ${season.seasonNumber}`}
                        </h3>
                        {seasonEpisodes.length > 0 ? (
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {seasonEpisodes
                              .sort((a, b) => a.episodeNumber - b.episodeNumber)
                              .map((episode) => {
                                const isActive = primaryEpisode?.id === episode.id;
                                return (
                                  <Link
                                    key={episode.id}
                                    href={`/watch/${content.id}?episodeId=${episode.id}`}
                                    className={`group relative overflow-hidden rounded-lg border transition-colors ${
                                      isActive
                                        ? "border-accent bg-accent/10 dark:bg-accent/20"
                                        : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
                                    }`}
                                  >
                                    <div className="flex flex-col">
                                      <div className="relative aspect-video w-full overflow-hidden bg-neutral-200 dark:bg-neutral-800">
                                        {episode.thumbnailUrl ? (
                                          <img
                                            src={episode.thumbnailUrl}
                                            alt={`${episode.title} thumbnail`}
                                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                          />
                                        ) : (
                                          <div className="flex h-full w-full items-center justify-center text-neutral-400">
                                            <span className="text-2xl">▶</span>
                                          </div>
                                        )}
                                        {isActive && (
                                          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                            <span
                                              className="text-2xl font-medium text-white"
                                              aria-label="Currently playing"
                                            >
                                              ▶
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                      <div className="p-3">
                                        <p
                                          className={`font-medium ${
                                            isActive
                                              ? "text-accent dark:text-accent"
                                              : "text-neutral-900 dark:text-neutral-100"
                                          }`}
                                        >
                                          Episode {episode.episodeNumber}
                                        </p>
                                        <p
                                          className={`mt-1 text-sm line-clamp-2 ${
                                            isActive
                                              ? "text-neutral-700 dark:text-neutral-300"
                                              : "text-neutral-600 dark:text-neutral-400"
                                          }`}
                                        >
                                          {episode.title}
                                        </p>
                                        {episode.duration && (
                                          <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-500">
                                            {formatDuration(episode.duration)}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </Link>
                                );
                              })}
                          </div>
                        ) : (
                          <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            No episodes available for this season.
                          </p>
                        )}
                      </div>
                    );
                  })}
              </div>
            ) : content.episodes && content.episodes.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {content.episodes
                  .sort((a, b) => a.episodeNumber - b.episodeNumber)
                  .map((episode) => {
                    const isActive = primaryEpisode?.id === episode.id;
                    return (
                      <Link
                        key={episode.id}
                        href={`/watch/${content.id}?episodeId=${episode.id}`}
                        className={`group relative overflow-hidden rounded-lg border transition-colors ${
                          isActive
                            ? "border-accent bg-accent/10 dark:bg-accent/20"
                            : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
                        }`}
                      >
                        <div className="flex flex-col">
                          <div className="relative aspect-video w-full overflow-hidden bg-neutral-200 dark:bg-neutral-800">
                            {episode.thumbnailUrl ? (
                              <img
                                src={episode.thumbnailUrl}
                                alt={`${episode.title} thumbnail`}
                                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-neutral-400">
                                <span className="text-2xl">▶</span>
                              </div>
                            )}
                            {isActive && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                <span
                                  className="text-2xl font-medium text-white"
                                  aria-label="Currently playing"
                                >
                                  ▶
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="p-3">
                            <p
                              className={`font-medium ${
                                isActive
                                  ? "text-accent dark:text-accent"
                                  : "text-neutral-900 dark:text-neutral-100"
                              }`}
                            >
                              Episode {episode.episodeNumber}
                            </p>
                            <p
                              className={`mt-1 text-sm line-clamp-2 ${
                                isActive
                                  ? "text-neutral-700 dark:text-neutral-300"
                                  : "text-neutral-600 dark:text-neutral-400"
                              }`}
                            >
                              {episode.title}
                            </p>
                            {episode.duration && (
                              <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-500">
                                {formatDuration(episode.duration)}
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
              </div>
            ) : null}
          </section>
        ) : null}

        <p className="mt-6 text-xs text-neutral-500 dark:text-neutral-500">
          HLS adaptive streaming · Use the control bar for play/pause, volume,
          quality, and fullscreen.
        </p>
      </div>
    </main>
  );
}
