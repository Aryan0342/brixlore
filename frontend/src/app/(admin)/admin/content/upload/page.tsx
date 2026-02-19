"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
} from "@/components/ui";
import { getApiErrorUserMessage } from "@/lib/api-client";
import { adminService } from "@/lib/services";
import type { AdminCategoryDto, ContentType } from "@/types/api";
import { useAuth } from "@/contexts";

const VIDEO_TYPES = ["video/mp4", "video/webm", "video/mkv"];
const THUMBNAIL_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_VIDEO_BYTES = 20 * 1024 * 1024 * 1024;

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: "MOVIE", label: "Movie" },
  { value: "DOCUMENTARY", label: "Documentary" },
  { value: "SERIES", label: "Series" },
  { value: "ANIMATION", label: "Animation" },
  { value: "SHORT", label: "Short" },
  { value: "TRAILER", label: "Trailer" },
];

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function isValidDuration(value: string): boolean {
  return /^\d{1,2}:\d{2}(?::\d{2})?$/.test(value.trim());
}

function getCategoryOptions(list: AdminCategoryDto[]): AdminCategoryDto[] {
  const seen = new Set<string>();
  return list.filter((item) => {
    const name = item.name.trim();
    if (!name) return false;
    const key = name.toLowerCase();
    if (key === "uncategorized") return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function AdminUploadPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isReadOnly = user?.role === "CUSTOMER_SUPPORT";
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [contentType, setContentType] = useState<ContentType>("MOVIE");
  const [animationMode, setAnimationMode] = useState<"single" | "episodic">(
    "single",
  );
  const [releaseYear, setReleaseYear] = useState("");
  const [ageRating, setAgeRating] = useState("NR");
  const [seasonNumber, setSeasonNumber] = useState("1");
  const [seasonTitle, setSeasonTitle] = useState("");
  const [episodeNumber, setEpisodeNumber] = useState("1");
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [episodeDuration, setEpisodeDuration] = useState("");
  const [categories, setCategories] = useState<AdminCategoryDto[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [episodeVideoFile, setEpisodeVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isEpisodic =
    contentType === "SERIES" ||
    (contentType === "ANIMATION" && animationMode === "episodic");

  useEffect(() => {
    let active = true;
    setCategoriesLoading(true);
    setCategoriesError(null);
    adminService
      .getCategories()
      .then((list) => {
        if (!active) return;
        setCategories(list);
      })
      .catch((err) => {
        if (!active) return;
        setCategories([]);
        setCategoriesError(
          err instanceof Error ? err.message : "Failed to load categories.",
        );
      })
      .finally(() => {
        if (!active) return;
        setCategoriesLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (isReadOnly) {
    return (
      <Card className="border-neutral-700/60 bg-neutral-900/50">
        <CardHeader>
          <CardTitle>Upload content</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-neutral-400">
          Customer Support accounts have read-only access and cannot upload
          content.
        </CardContent>
        <CardFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.back()}
          >
            Back
          </Button>
        </CardFooter>
      </Card>
    );
  }

  function runValidation(): boolean {
    if (!title.trim()) {
      setError("Title is required.");
      return false;
    }
    if (!releaseYear.trim()) {
      setError("Release year is required.");
      return false;
    }
    if (!/^\d{4}$/.test(releaseYear.trim())) {
      setError("Release year must be a 4-digit year.");
      return false;
    }
    if (!ageRating.trim()) {
      setError("Age rating is required.");
      return false;
    }
    if (!isEpisodic) {
      if (!duration.trim()) {
        setError("Duration is required (e.g. 12:34 or 1:22:10).");
        return false;
      }
      if (!isValidDuration(duration)) {
        setError("Duration must be MM:SS or HH:MM:SS.");
        return false;
      }
      if (!videoFile) {
        setError("Please select a video file.");
        return false;
      }
      if (!VIDEO_TYPES.includes(videoFile.type)) {
        setError("Video type must be MP4, WebM, or MKV.");
        return false;
      }
      if (videoFile.size > MAX_VIDEO_BYTES) {
        setError(`Video exceeds ${formatBytes(MAX_VIDEO_BYTES)}.`);
        return false;
      }
    } else {
      if (!episodeTitle.trim()) {
        setError("Episode title is required.");
        return false;
      }
      if (!episodeNumber.trim()) {
        setError("Episode number is required.");
        return false;
      }
      if (!/^\d+$/.test(episodeNumber.trim())) {
        setError("Episode number must be a number.");
        return false;
      }
      if (seasonNumber.trim() && !/^\d+$/.test(seasonNumber.trim())) {
        setError("Season number must be a number.");
        return false;
      }
      if (!episodeDuration.trim()) {
        setError("Episode duration is required (e.g. 12:34).");
        return false;
      }
      if (!isValidDuration(episodeDuration)) {
        setError("Episode duration must be MM:SS or HH:MM:SS.");
        return false;
      }
      const episodeVideo = episodeVideoFile ?? videoFile;
      if (!episodeVideo) {
        setError("Please select an episode video file.");
        return false;
      }
      if (!VIDEO_TYPES.includes(episodeVideo.type)) {
        setError("Episode video must be MP4, WebM, or MKV.");
        return false;
      }
      if (episodeVideo.size > MAX_VIDEO_BYTES) {
        setError(`Episode video exceeds ${formatBytes(MAX_VIDEO_BYTES)}.`);
        return false;
      }
    }
    if (!thumbnailFile) {
      setError("Please select a thumbnail image.");
      return false;
    }
    if (!THUMBNAIL_TYPES.includes(thumbnailFile.type)) {
      setError("Thumbnail must be JPEG, PNG, or WebP.");
      return false;
    }
    setError(null);
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!runValidation()) return;
    if (!thumbnailFile) return;
    setSubmitting(true);
    try {
      const activeVideoFile = isEpisodic
        ? (episodeVideoFile ?? videoFile)
        : videoFile;
      if (!activeVideoFile) return;

      const videoPresign = await adminService.presignUpload({
        kind: "video",
        fileName: activeVideoFile.name,
        contentType: activeVideoFile.type,
        sizeBytes: activeVideoFile.size,
      });

      const thumbnailPresign = await adminService.presignUpload({
        kind: "thumbnail",
        fileName: thumbnailFile.name,
        contentType: thumbnailFile.type,
        sizeBytes: thumbnailFile.size,
        uploadId: videoPresign.uploadId,
      });

      await Promise.all([
        fetch(videoPresign.url, {
          method: "PUT",
          headers: { "Content-Type": activeVideoFile.type },
          body: activeVideoFile,
        }),
        fetch(thumbnailPresign.url, {
          method: "PUT",
          headers: { "Content-Type": thumbnailFile.type },
          body: thumbnailFile,
        }),
      ]).then(async (responses) => {
        const failed = responses.find((res) => !res.ok);
        if (failed) {
          const message = await failed.text();
          throw new Error(message || "Upload failed");
        }
      });

      const created = await adminService.createContent({
        title: title.trim(),
        description: description.trim() || undefined,
        type: contentType,
        thumbnailKey: thumbnailPresign.key,
        releaseYear: Number(releaseYear),
        ageRating: ageRating.trim(),
        duration: isEpisodic ? undefined : duration.trim(),
        category: category.trim() || undefined,
        videoKey: isEpisodic ? undefined : videoPresign.key,
      });

      if (isEpisodic) {
        const parsedSeason = Number(seasonNumber) || 1;
        const parsedEpisode = Number(episodeNumber) || 1;
        const season = await adminService.createSeason({
          contentId: created.id,
          seasonNumber: parsedSeason,
          title: seasonTitle.trim() || `Season ${parsedSeason}`,
        });
        await adminService.createEpisode({
          contentId: created.id,
          seasonId: season.id,
          episodeNumber: parsedEpisode,
          title: episodeTitle.trim(),
          duration: episodeDuration.trim(),
          videoKey: videoPresign.key,
        });
      }

      setSuccess(true);
      setTitle("");
      setDuration("");
      setDescription("");
      setCategory("");
      setReleaseYear("");
      setAgeRating("NR");
      setSeasonNumber("1");
      setSeasonTitle("");
      setEpisodeNumber("1");
      setEpisodeTitle("");
      setEpisodeDuration("");
      setVideoFile(null);
      setEpisodeVideoFile(null);
      setThumbnailFile(null);
    } catch (err) {
      const message = getApiErrorUserMessage(err);
      const isNetwork =
        message.includes("Network") ||
        (err instanceof Error &&
          (err.message === "Failed to fetch" ||
            err.message === "Network request failed"));
      setError(
        isNetwork
          ? "Network error. Check that the backend is running and NEXT_PUBLIC_API_BASE_URL points to it (e.g. http://localhost:5000). If the backend responded but upload failed, configure CORS on your storage (R2/S3) to allow PUT from this site."
          : message,
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <>
        <h1 className="text-2xl font-semibold text-white">Upload content</h1>
        <Card className="mt-6 max-w-lg">
          <CardHeader>
            <CardTitle>Saved</CardTitle>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Your content has been uploaded.
            </p>
          </CardHeader>
          <CardFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSuccess(false);
                router.push("/admin/content");
              }}
            >
              View content list
            </Button>
            <Button type="button" onClick={() => setSuccess(false)}>
              Add another
            </Button>
          </CardFooter>
        </Card>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-white">Upload content</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Upload a video or episode and then add metadata.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
        <span className="rounded-full border border-neutral-700/70 px-3 py-1">
          {contentType === "ANIMATION"
            ? `Animation (${animationMode})`
            : contentType.toLowerCase()}
        </span>
        <span className="rounded-full border border-neutral-700/70 px-3 py-1">
          {isEpisodic ? "Episodic workflow" : "Single asset"}
        </span>
      </div>
      <Card className="mt-6 max-w-lg">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Content upload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
              {isEpisodic
                ? "This will create the content entry first, then create Season 1 and Episode 1 with the uploaded file."
                : "This will create the content entry and attach the uploaded file as the main asset."}
            </div>
            {error && (
              <p
                className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400"
                role="alert"
              >
                {error}
              </p>
            )}
            <div className="pt-2 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Content basics
            </div>
            <Input
              label="Title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Content title"
              required
            />
            <div>
              <label
                htmlFor="content-type"
                className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
              >
                Content type
              </label>
              <select
                id="content-type"
                value={contentType}
                onChange={(e) => setContentType(e.target.value as ContentType)}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
              >
                {CONTENT_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {contentType === "ANIMATION" && (
              <div>
                <span className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Animation format
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAnimationMode("single")}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      animationMode === "single"
                        ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                    }`}
                  >
                    Single
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnimationMode("episodic")}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      animationMode === "episodic"
                        ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                    }`}
                  >
                    Episodic
                  </button>
                </div>
              </div>
            )}
            <div className="pt-2 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Release & rating
            </div>
            <Input
              label="Release year"
              type="text"
              value={releaseYear}
              onChange={(e) => setReleaseYear(e.target.value)}
              placeholder="2024"
              required
            />
            <div>
              <label
                htmlFor="age-rating"
                className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
              >
                Age rating
              </label>
              <select
                id="age-rating"
                value={ageRating}
                onChange={(e) => setAgeRating(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
              >
                {["G", "PG", "PG-13", "R", "TV-MA", "NR"].map((rating) => (
                  <option key={rating} value={rating}>
                    {rating}
                  </option>
                ))}
              </select>
            </div>
            <div className="pt-2 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Asset details
            </div>
            <Input
              label="Duration"
              type="text"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 12:34 or 1:22:10"
              hint="Format: MM:SS or HH:MM:SS"
              disabled={isEpisodic}
            />
            {isEpisodic && (
              <div className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  Episode setup
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Season number"
                    type="text"
                    value={seasonNumber}
                    onChange={(e) => setSeasonNumber(e.target.value)}
                    placeholder="1"
                  />
                  <Input
                    label="Season title"
                    type="text"
                    value={seasonTitle}
                    onChange={(e) => setSeasonTitle(e.target.value)}
                    placeholder="Season 1"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Episode number"
                    type="text"
                    value={episodeNumber}
                    onChange={(e) => setEpisodeNumber(e.target.value)}
                    placeholder="1"
                  />
                  <Input
                    label="Episode title"
                    type="text"
                    value={episodeTitle}
                    onChange={(e) => setEpisodeTitle(e.target.value)}
                    placeholder="Episode 1"
                  />
                </div>
                <Input
                  label="Episode duration"
                  type="text"
                  value={episodeDuration}
                  onChange={(e) => setEpisodeDuration(e.target.value)}
                  placeholder="e.g. 24:00"
                  hint="Format: MM:SS or HH:MM:SS"
                />
              </div>
            )}
            <div>
              <label
                htmlFor="video-file"
                className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
              >
                {isEpisodic ? "Episode video file" : "Video file"}
              </label>
              <input
                id="video-file"
                type="file"
                accept={VIDEO_TYPES.join(",")}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (isEpisodic) {
                    setEpisodeVideoFile(file);
                  } else {
                    setVideoFile(file);
                  }
                  if (file) setError(null);
                }}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-200 file:px-3 file:py-1.5 file:text-sm file:text-neutral-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:file:bg-neutral-700 dark:file:text-neutral-100"
              />
              <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                MP4, WebM, or MKV. Max {formatBytes(MAX_VIDEO_BYTES)}.
              </p>
            </div>
            <div className="pt-2 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Artwork
            </div>
            <div>
              <label
                htmlFor="thumbnail-file"
                className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
              >
                Thumbnail image
              </label>
              <input
                id="thumbnail-file"
                type="file"
                accept={THUMBNAIL_TYPES.join(",")}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setThumbnailFile(file);
                  if (file) setError(null);
                }}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-200 file:px-3 file:py-1.5 file:text-sm file:text-neutral-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:file:bg-neutral-700 dark:file:text-neutral-100"
              />
              <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                JPEG, PNG, or WebP.
              </p>
            </div>
            <div>
              <label
                htmlFor="category"
                className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
              >
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
              >
                <option value="">Select category</option>
                <option value="Uncategorized">Uncategorized</option>
                {getCategoryOptions(categories).map((opt) => (
                  <option key={opt.id} value={opt.name}>
                    {opt.name}
                  </option>
                ))}
              </select>
              {categoriesLoading ? (
                <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                  Loading categories...
                </p>
              ) : categoriesError ? (
                <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">
                  {categoriesError}
                </p>
              ) : categories.length === 0 ? (
                <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                  No categories yet. Create one in the Categories page.
                </p>
              ) : null}
            </div>
            <div>
              <label
                htmlFor="description"
                className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
              >
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-500 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-400"
                placeholder="Optional description"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Uploading..." : "Upload content"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/admin/content")}
            >
              Cancel
            </Button>
          </CardFooter>
        </form>
      </Card>
    </>
  );
}
