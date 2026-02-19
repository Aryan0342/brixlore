import { useMemo } from 'react';
import type { VideoThumbnailItem } from '../components';

export function useContinueWatching(): VideoThumbnailItem[] {
  return useMemo(
    () => [
      {
        id: '1',
        title: 'The First 48',
        subtitle: 'Season 1, Episode 9',
        thumbnailUri: 'https://picsum.photos/seed/cw1/640/360',
      },
      {
        id: '2',
        title: 'Sample Show',
        subtitle: 'Season 2, Episode 3',
        thumbnailUri: 'https://picsum.photos/seed/cw2/640/360',
      },
    ],
    []
  );
}
