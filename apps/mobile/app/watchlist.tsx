import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, useWindowDimensions, View } from 'react-native';
import { getWatchlist } from '@cinewave/shared';
import { PosterCard } from '@/components/Poster';
import { Button, Empty, ErrorState, Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

export default function Watchlist() {
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const cols = width > 600 ? 4 : 3;
  const cardW = (width - 32 - (cols - 1) * 12) / cols;
  const { data, error, loading, reload } = useAsync(() => getWatchlist(supabase), [session?.user.id]);

  // Refresh when returning from a title page.
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  if (!session) {
    return (
      <Empty title="Sign in to use My List" text="Your list syncs across web and Android.">
        <Button label="Sign in" onPress={() => router.push('/login')} style={{ marginTop: 16 }} />
      </Empty>
    );
  }
  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data?.length) {
    return (
      <Empty title="Your list is empty" text="Add films with “+ My List” and they’ll show up here.">
        <Button label="Browse films" onPress={() => router.push('/search')} style={{ marginTop: 16 }} />
      </Empty>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        key={cols}
        data={data}
        numColumns={cols}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: 16, gap: 18 }}
        columnWrapperStyle={{ gap: 12 }}
        renderItem={({ item }) => <PosterCard title={item} width={cardW} />}
      />
    </View>
  );
}
