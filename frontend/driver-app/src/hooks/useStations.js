import { useCallback, useEffect, useState } from 'react';
import { fetchStations } from '../api';

export function useStations() {
  const [stations, setStations] = useState([]);

  const refetch = useCallback(async () => {
    try {
      setStations(await fetchStations());
    } catch (err) {
      console.error('Error fetching stations:', err);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { stations, refetch };
}
