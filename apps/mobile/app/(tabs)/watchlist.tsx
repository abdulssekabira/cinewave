import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getWatchlist } from '@cinewave/shared';
import { PosterGrid } from '@/components/Grid';
import { Button, Empty, ErrorState, Loading, ScreenTitle } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

export default function Watchlist() {
  const { session } = useAuth();
  const { data, error, loading, reload } = useAsync(
    () => (session ? getWatchlist(supabase) : Promise.resolve([])),
    [session?.user.id],
  );
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  let content;
  if (!session) {
    content = (
      <Empty icon="time-outline" title="Sign in to use your Watchlist" text="Save films to watch later. Your list syncs between the app and the website.">
        <Button label="Sign in" onPress={() => router.push('/login')} style={{ marginTop: 20, alignSelf: 'stretch' }} />
      </Empty>
    );
  } else if (loading && !data) content = <Loading />;
  else if (error) content = <ErrorState message={error} onRetry={reload} />;
  else if (!data?.length) {
    content = (
      <Empty icon="bookmark-outline" title="Your watchlist is empty" text="Tap + on any film to save it here.">
        <Button label="Browse films" onPress={() => router.push('/search')} style={{ marginTop: 20, alignSelf: 'stretch' }} />
      </Empty>
    );
  } else content = <PosterGrid titles={data} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenTitle title="Watchlist" />
      {content}
    </SafeAreaView>
  );
}
