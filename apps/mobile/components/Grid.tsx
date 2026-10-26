import { FlatList, useWindowDimensions } from 'react-native';
import type { CatalogTitle } from '@cinewave/shared';
import { PosterCard } from './Poster';

export function PosterGrid({ titles, header }: { titles: CatalogTitle[]; header?: React.ReactElement }) {
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
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 18 }}
      columnWrapperStyle={{ gap: 12 }}
      renderItem={({ item }) => <PosterCard title={item} width={cardW} />}
    />
  );
}
