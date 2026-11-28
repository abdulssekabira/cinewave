import { FlatList, useWindowDimensions } from 'react-native';
import type { CatalogTitle } from '@cinewave/shared';
import { PosterCard } from './Poster';

export function PosterGrid({ titles, header, onEndReached, footer }: {
  titles: CatalogTitle[];
  header?: React.ReactElement;
  /** Endless scrolling: called near the bottom to load more. */
  onEndReached?: () => void;
  footer?: React.ReactElement | null;
}) {
  const { width } = useWindowDimensions();
  const cols = width > 600 ? 4 : 3;
  const cardW = (width - 40 - (cols - 1) * 12) / cols;
  return (
    <FlatList
      key={cols}
      data={titles}
      numColumns={cols}
      keyExtractor={(t) => t.id}
      ListHeaderComponent={header}
      ListFooterComponent={footer ?? undefined}
      onEndReached={onEndReached}
      onEndReachedThreshold={1.5}
      initialNumToRender={18}
      windowSize={11}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 18 }}
      columnWrapperStyle={{ gap: 12 }}
      renderItem={({ item }) => <PosterCard title={item} width={cardW} />}
    />
  );
}
