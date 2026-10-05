import { createContext, use, useCallback, useEffect, useRef, useState } from "react";
import {
  createAudioPlayer,
  setAudioModeAsync,
  useAudioPlayerStatus,
} from "expo-audio";
import type { Track } from "@/sources";

type PlayerState = {
  track: Track | null;
  playing: boolean;
  position: number;
  duration: number;
};

type PlayerApi = PlayerState & {
  play(track: Track, queue?: Track[]): void;
  toggle(): void;
  seek(seconds: number): void;
  next(): void;
  previous(): void;
};

const PlayerContext = createContext<PlayerApi | null>(null);

/**
 * `createAudioPlayer`, not `useAudioPlayer`: the player must outlive any screen
 * unmount. `useAudioPlayer` releases on unmount, which would kill playback on
 * every tab change.
 */
export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const queueRef = useRef<Track[]>([]);
  const indexRef = useRef(-1);
  const [track, setTrack] = useState<Track | null>(null);

  // Lazy initialiser rather than a ref write during render: the player must be
  // created exactly once and outlive every screen.
  const [player] = useState(() => createAudioPlayer());
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      // Mandatory, not cosmetic: without it the OS may not associate the
      // player with lock screen controls.
      interruptionMode: "doNotMix",
    });
    return () => player.release();
  }, [player]);

  const start = useCallback(
    (next: Track) => {
      // On Android, lock screen activation is required or background playback
      // stops after ~3 minutes (OS limitation).
      player.setActiveForLockScreen(true, {
        title: next.title,
        artist: next.artist,
        artworkUrl: next.artworkUrl,
      });
      player.replace({ uri: next.streamUrl });
      player.play();
    },
    [player]
  );

  const play = useCallback(
    (next: Track, queue?: Track[]) => {
      if (queue?.length) {
        queueRef.current = queue;
        indexRef.current = queue.findIndex((t) => t.id === next.id);
      } else if (indexRef.current === -1) {
        queueRef.current = [next];
        indexRef.current = 0;
      }
      setTrack(next);
      start(next);
    },
    [start]
  );

  const step = useCallback(
    (delta: number) => {
      const q = queueRef.current;
      const i = indexRef.current + delta;
      if (i < 0 || i >= q.length) return;
      indexRef.current = i;
      setTrack(q[i]);
      start(q[i]);
    },
    [start]
  );

  const api: PlayerApi = {
    track,
    playing: status.playing,
    position: status.currentTime,
    duration: status.duration ?? track?.duration ?? 0,
    play,
    toggle: () => (player.playing ? player.pause() : player.play()),
    seek: (s) => player.seekTo(s),
    next: () => step(1),
    previous: () => step(-1),
  };

  return <PlayerContext value={api}>{children}</PlayerContext>;
}

export function usePlayer() {
  const ctx = use(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside PlayerProvider");
  return ctx;
}