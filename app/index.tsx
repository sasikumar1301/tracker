import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';

import { Loading, Screen } from '@/components/ui';
import { getLatestBudget, getSettings } from '@/db/queries';
import { todayLocal } from '@/lib/date';

type Destination = '/setup' | '/new-cycle' | '/(tabs)';

export default function IndexScreen() {
  const [destination, setDestination] = useState<Destination | null>(null);

  useEffect(() => {
    Promise.all([getSettings(), getLatestBudget()]).then(([appSettings, latestBudget]) => {
      if (!appSettings || !latestBudget) {
        setDestination('/setup');
      } else if (todayLocal() > latestBudget.cycleEnd) {
        setDestination('/new-cycle');
      } else {
        setDestination('/(tabs)');
      }
    });
  }, []);

  if (destination) return <Redirect href={destination} />;
  return (
    <Screen>
      <Loading label="Opening DailyBudget…" />
    </Screen>
  );
}
