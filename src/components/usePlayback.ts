import { useCallback, useEffect, useState } from "react";

const FULL_RUN_MS = 14000;

export type Playback = {
  progress: number;
  playing: boolean;
  toggle: () => void;
  skip: () => void;
  seek: (fraction: number) => void;
  reset: () => void;
};

export function usePlayback(): Playback {
  const [progress, setProgress] = useState(1);
  const [wantsPlay, setWantsPlay] = useState(false);
  const playing = wantsPlay && progress < 1;

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      const elapsed = now - last;
      last = now;
      setProgress((value) => Math.min(1, value + elapsed / FULL_RUN_MS));
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const toggle = useCallback(() => {
    if (playing) {
      setWantsPlay(false);
      return;
    }
    setProgress((value) => (value >= 1 ? 0 : value));
    setWantsPlay(true);
  }, [playing]);

  const skip = useCallback(() => {
    setWantsPlay(false);
    setProgress(1);
  }, []);

  const seek = useCallback((fraction: number) => {
    setWantsPlay(false);
    setProgress(Math.min(1, Math.max(0, fraction)));
  }, []);

  return { progress, playing, toggle, skip, seek, reset: skip };
}
