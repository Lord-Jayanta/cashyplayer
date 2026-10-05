import { audius } from "./audius";
import { itunes } from "./itunes";
import { dedupeKey, score } from "./rank";
import type { Track, TrackSource } from "./types";

/** Playable sources first — a source with no playable audio ranks last. */
const sources: TrackSource[] = [audius, itunes];

export async function searchAll(query: string): Promise<Track[]> {
  const settled = await Promise.allSettled(sources.map((s) => s.search(query)));
  const tracks = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

  const seen = new Set<string>();
  const unique = tracks.filter((t) => {
    const k = dedupeKey(t);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return unique.sort((a, b) => score(b, query) - score(a, query));
}

/**
 * A YouTube link is recognised so it can be opened in YouTube, never streamed —
 * the watch page is HTML and `expo-audio` cannot decode it.
 */
const YOUTUBE = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/;

export async function resolveUrl(raw: string): Promise<Track | null> {
  const yt = raw.match(YOUTUBE);
  if (yt) {
    return {
      id: `youtube:${yt[1]}`,
      source: "youtube",
      title: `YouTube video ${yt[1]}`,
      artist: "Open in YouTube",
      streamUrl: raw,
      downloadable: false,
      // No audio is available in-app, so the UI must offer a link, not playback.
      externalOnly: true,
    };
  }

  for (const s of sources) {
    try {
      const track = await s.resolve(raw);
      if (track) return track;
    } catch {
      // A source failing to resolve shouldn't block the others.
    }
  }
  return null;
}

export function webUrlFor(track: Track): string {
  if (track.source === "youtube") return track.streamUrl;
  return (sources.find((s) => s.name === track.source)?.webUrl(track)) ?? track.streamUrl;
}

export * from "./types";