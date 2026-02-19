"use client";

import { useEffect, useRef } from "react";
import videojs from "video.js";
import { cn } from "@/lib/utils";
import type { PlaybackType } from "@/types/api";

/** Player instance type from Video.js (avoids using internal types). */
type VideoJsPlayer = ReturnType<typeof videojs>;

const PROGRESS_REPORT_INTERVAL_SEC = 10;

export type HLSVideoPlayerProps = {
  /** HLS manifest URL (.m3u8) or MP4 URL. */
  src: string;
  /** Optional playback type hint (hls, dash, mp4). */
  type?: PlaybackType;
  /** Optional poster image URL. */
  poster?: string;
  /** Optional video title for accessibility. */
  title?: string;
  /** Optional class name for the wrapper. */
  className?: string;
  /** Optional callback when player is ready. */
  onReady?: (player: VideoJsPlayer) => void;
  /** Optional callback with current time in seconds (throttled on timeupdate, and on pause). */
  onProgress?: (progressSeconds: number) => void;
};

const VIDEO_JS_OPTIONS = {
  controls: true,
  fill: true,
  playbackRates: [0.5, 1, 1.25, 1.5, 2],
  html5: {
    vhs: { overrideNative: true },
    nativeAudioTracks: false,
    nativeVideoTracks: false,
  },
} as const;

function resolveVideoType(src: string): string | undefined {
  const normalized = src.toLowerCase();
  if (/\.m3u8(\?|$)/.test(normalized)) return "application/x-mpegURL";
  if (/\.mp4(\?|$)/.test(normalized)) return "video/mp4";
  return undefined;
}

function resolveMimeFromPlaybackType(type?: PlaybackType): string | undefined {
  if (type === "hls") return "application/x-mpegURL";
  if (type === "dash") return "application/dash+xml";
  if (type === "mp4") return "video/mp4";
  return undefined;
}

/**
 * HLS video player using Video.js. Supports adaptive streaming (HLS) and
 * fullscreen via the built-in control bar.
 */
export function HLSVideoPlayer({
  src,
  type,
  poster,
  title,
  className,
  onReady,
  onProgress,
}: HLSVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<VideoJsPlayer | null>(null);
  const lastReportedRef = useRef<number>(0);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !src) return;

    const rafId = requestAnimationFrame(() => {
      const player = videojs(
        videoEl,
        VIDEO_JS_OPTIONS,
        function (this: VideoJsPlayer) {
          if (onReady) onReady(this);
        },
      );

      const mimeType =
        resolveMimeFromPlaybackType(type) ?? resolveVideoType(src);
      player.src(mimeType ? { src, type: mimeType } : { src });
      if (poster) player.poster(poster);

      if (onProgress) {
        const report = () => {
          const t = player.currentTime();
          if (typeof t === "number" && t >= 0) {
            lastReportedRef.current = t;
            onProgress(t);
          }
        };
        player.on("timeupdate", () => {
          const t = player.currentTime();
          if (
            typeof t === "number" &&
            t >= 0 &&
            t - lastReportedRef.current >= PROGRESS_REPORT_INTERVAL_SEC
          ) {
            report();
          }
        });
        player.on("pause", report);
      }

      playerRef.current = player;
    });

    return () => {
      cancelAnimationFrame(rafId);
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-init when source/poster change
  }, [src, poster, type]);

  return (
    <div
      className={cn(
        "aspect-video w-full overflow-hidden rounded-lg bg-black",
        className,
      )}
      data-vjs-player
      title={title}
    >
      <video
        ref={videoRef}
        className="video-js vjs-default-skin vjs-big-play-centered vjs-fill h-full w-full"
        controls
        playsInline
        preload="auto"
        aria-label={title}
      />
    </div>
  );
}
