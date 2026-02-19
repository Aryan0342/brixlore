import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../storage/r2.service';
import type { CategoriesResponseDto } from './dto/categories-response.dto';
import type { ContentListResponseDto } from './dto/content-list-response.dto';
import type { ContentDetailResponseDto } from './dto/content-detail-response.dto';
import type { ContentSummaryDto } from './dto/content-summary.dto';
import type { SeasonResponseDto } from './dto/season-response.dto';
import type { EpisodeResponseDto } from './dto/episode-response.dto';

const CONTENT_TYPES = ['MOVIE', 'DOCUMENTARY', 'SERIES', 'ANIMATION', 'TRAILER', 'SHORT'] as const;

type ContentType = (typeof CONTENT_TYPES)[number];

/** Convert seconds to "M:SS" or "H:MM:SS" for API. */
function formatDurationSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2Service: R2Service,
  ) {}

  async getContent(page = 1, limit = 24, type?: ContentType): Promise<ContentListResponseDto> {
    const skip = (page - 1) * limit;
    const where = {
      isPublished: true,
      ...(type ? { type } : {}),
    };
    const [contentItems, total] = await Promise.all([
      (this.prisma as any).content.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { category: { select: { name: true } } },
      }),
      (this.prisma as any).content.count({ where }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const mapped = await Promise.all(
      contentItems.map((content: any) => this.toContentSummaryDto(content)),
    );
    return {
      items: mapped,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async getContentById(id: string): Promise<ContentDetailResponseDto | null> {
    const content = await (this.prisma as any).content.findUnique({
      where: { id },
      include: {
        trailer: { include: { episodes: true } },
        seasons: { include: { _count: { select: { episodes: true } } } },
        episodes: true,
      },
    });
    if (!content || !content.isPublished) return null;

    const trailer = content.trailer?.isPublished ? content.trailer : null;
    const trailerEpisode = trailer?.episodes?.[0];

    const seasons: SeasonResponseDto[] | undefined = content.seasons.length
      ? content.seasons
          .sort(
            (a: { seasonNumber: number }, b: { seasonNumber: number }) =>
              a.seasonNumber - b.seasonNumber,
          )
          .map((season: any) => ({
            id: season.id,
            seasonNumber: season.seasonNumber,
            title: season.title,
            description: season.description ?? undefined,
            episodeCount: season._count?.episodes ?? 0,
          }))
      : undefined;

    // Always include episodes if they exist, regardless of whether seasons exist.
    // Episodes can belong to seasons (via seasonId) or be standalone.
    const episodes: EpisodeResponseDto[] | undefined = content.episodes.length
      ? await Promise.all(
          content.episodes
            .sort(
              (a: { episodeNumber: number }, b: { episodeNumber: number }) =>
                a.episodeNumber - b.episodeNumber,
            )
            .map(async (episode: any) => ({
              id: episode.id,
              seasonId: episode.seasonId ?? undefined,
              episodeNumber: episode.episodeNumber,
              title: episode.title,
              description: episode.description ?? undefined,
              duration: formatDurationSeconds(episode.duration),
              thumbnailUrl: await this.resolveThumbnailUrl(episode.thumbnailUrl),
            })),
        )
      : undefined;

    return {
      content: {
        id: content.id,
        title: content.title,
        description: content.description ?? undefined,
        type: content.type,
        thumbnailUrl: await this.resolveThumbnailUrl(content.thumbnailUrl),
        posterUrl: content.posterUrl ?? undefined,
        releaseYear: content.releaseYear,
        ageRating: content.ageRating,
        duration:
          typeof content.duration === 'number'
            ? formatDurationSeconds(content.duration)
            : undefined,
        trailer: trailerEpisode
          ? {
              id: trailer!.id,
              title: trailer!.title,
              duration: formatDurationSeconds(trailerEpisode.duration),
            }
          : undefined,
        seasons,
        episodes,
      },
    };
  }

  async getSeasons(contentId: string): Promise<SeasonResponseDto[] | null> {
    const content = await (this.prisma as any).content.findUnique({
      where: { id: contentId },
      select: { id: true, isPublished: true },
    });
    if (!content || !content.isPublished) return null;
    const seasons = await (this.prisma as any).season.findMany({
      where: { contentId },
      include: { _count: { select: { episodes: true } } },
      orderBy: { seasonNumber: 'asc' },
    });
    return seasons.map((season: any) => ({
      id: season.id,
      seasonNumber: season.seasonNumber,
      title: season.title,
      description: season.description ?? undefined,
      episodeCount: season._count?.episodes ?? 0,
    }));
  }

  async getEpisodes(contentId: string, seasonId?: string): Promise<EpisodeResponseDto[] | null> {
    const content = await (this.prisma as any).content.findUnique({
      where: { id: contentId },
      select: { id: true, isPublished: true },
    });
    if (!content || !content.isPublished) return null;

    const where: { contentId: string; seasonId?: string | null } = { contentId };
    if (typeof seasonId === 'string') {
      where.seasonId = seasonId.trim() || null;
    }

    const episodes = await (this.prisma as any).episode.findMany({
      where,
      orderBy: { episodeNumber: 'asc' },
    });

    return Promise.all(
      episodes.map(async (episode: any) => ({
        id: episode.id,
        seasonId: episode.seasonId ?? undefined,
        episodeNumber: episode.episodeNumber,
        title: episode.title,
        description: episode.description ?? undefined,
        duration: formatDurationSeconds(episode.duration),
        thumbnailUrl: await this.resolveThumbnailUrl(episode.thumbnailUrl),
      })),
    );
  }

  async getCategories(): Promise<CategoriesResponseDto> {
    const contentItems = await (this.prisma as any).content.findMany({
      where: { isPublished: true },
      select: { category: { select: { name: true } } },
    });
    const set = new Set(
      contentItems
        .map((item: { category?: { name?: string } | null }) => item.category?.name)
        .filter(Boolean) as string[],
    );
    const categories = ['All', ...Array.from(set).sort()];
    return { categories };
  }

  private async toContentSummaryDto(content: {
    id: string;
    title: string;
    type: ContentType;
    thumbnailUrl: string;
    releaseYear: number;
    ageRating: string;
    category?: { name: string } | null;
  }): Promise<ContentSummaryDto> {
    const thumbnailUrl = await this.resolveThumbnailUrl(content.thumbnailUrl);
    return {
      id: content.id,
      title: content.title,
      type: content.type,
      thumbnailUrl,
      releaseYear: content.releaseYear,
      ageRating: content.ageRating,
      category: content.category?.name ?? undefined,
    };
  }

  private async resolveThumbnailUrl(value: string | null): Promise<string | null> {
    if (!value) return null;
    if (/^https?:\/\//i.test(value)) return value;
    const publicUrl = this.r2Service.getPublicUrl(value);
    if (publicUrl) return publicUrl;
    return this.r2Service.getSignedGetUrl(value);
  }
}
