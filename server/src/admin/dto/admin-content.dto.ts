export class AdminContentItemDto {
  id: string;
  title: string;
  description?: string;
  type: string;
  thumbnailUrl: string;
  posterUrl?: string;
  releaseYear: number;
  ageRating: string;
  duration?: string;
  trailerId?: string;
  category?: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt?: string;
  seasons?: {
    id: string;
    seasonNumber: number;
    title: string;
    episodeCount: number;
  }[];
  episodes?: {
    id: string;
    seasonId?: string;
    episodeNumber: number;
    title: string;
    duration: string;
  }[];
}
