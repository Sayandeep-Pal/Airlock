import { useCallback, useEffect, useState } from 'react';
import { warmUpDeviceModel } from '../ai/models';
import { nanoStatus, type NanoStatus } from '../ai/nano';
import { DETECT_PARAMS } from '../ai/nanoPrompt';
import { firebase } from '../firebase';

export interface NanoState {
  status: NanoStatus | null;
  /** Firebase configured and Gemini Nano downloaded. */
  ready: boolean;
  /** Download/initialise progress 0–1 while warming up, else null. */
  progress: number | null;
  warm: boolean;
  error: string | null;
  /** Must be called from a user gesture (click / key press). */
  warmUp: () => Promise<void>;
  refresh: () => void;
}

export function useNano(): NanoState {
  const [status, setStatus] = useState<NanoStatus | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [warm, setWarm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    nanoStatus().then(setStatus);
  }, []);
  useEffect(refresh, [refresh]);

  const warmUp = useCallback(async () => {
    if (!firebase || warm || progress !== null) return;
    if (status !== 'available' && status !== 'downloadable' && status !== 'downloading') return;
    setProgress(0);
    setError(null);
    try {
      await warmUpDeviceModel((f) => setProgress(f), DETECT_PARAMS);
      setWarm(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
      refresh();
    }
  }, [warm, progress, status, refresh]);

  return { status, ready: Boolean(firebase) && status === 'available', progress, warm, error, warmUp, refresh };
}
