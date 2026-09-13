import { useCallback, useEffect, useState } from "react";

export const SPEEDS = [
  { label: "1x", intervalMs: 120 },
  { label: "4x", intervalMs: 30 },
  { label: "16x", intervalMs: 8 },
] as const;

export type Speed = (typeof SPEEDS)[number];

export type Playback = {
  progress: number;
  playing: boolean;
  speed: Speed;
  setSpeed: (speed: Speed) => void;
  advance: (fraction: number) => void;
  toggle: () => void;
  skip: () => void;
  seek: (fraction: number) => void;
  reset: () => void;
};

export function usePlayback(): Playback {
  const [progress, setProgress] = useState(1);
  const [wantsPlay, setWantsPlay] = useState(false);
  const [speed, setSpeed] = useState<Speed>(SPEEDS[0]);
  const playing = wantsPlay && progress < 1;

  const advance = useCallback((fraction: number) => {
    setProgress((value) => Math.min(1, value + fraction));
  }, []);

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

  return { progress, playing, speed, setSpeed, advance, toggle, skip, seek, reset: skip };
}

// Reveals one of `count` transactions every speed.intervalMs while playing.
export function usePlaybackClock({ playing, speed, advance }: Playback, count: number) {
  const fullRunMs = Math.max(1, count) * speed.intervalMs;

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      advance((now - last) / fullRunMs);
      last = now;
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, fullRunMs, advance]);
}
