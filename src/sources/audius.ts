import type { Track, TrackSource } from "./types";

const API = "https://discoveryprovider.audius.co/v1";
/** Audius asks clients to identify themselves; no key or signup is involved. */
const APP = "cashyplayer";

type AudiusTrack = {
  id: string;
  title: string;
  duration: number;
  genre?: string;
  artwork?: Record<string, string>;
  user?: { name?: string };
  license?: string;
};

const api = (path: string) => `${API}${path}${path.includes("?") ? "&" : "?"}app_name=${APP}`;

function art(t: AudiusTrack) {
  return t.artwork?.["480x480"] ?? t.artwork?.["150x150"];
}

function map(t: AudiusTrack): Track {
  return {
    id: `audius:${t.id}`,
    source: "audius",
    title: t.title,
    artist: t.user?.name ?? "Unknown artist",
    artworkUrl: art(t),
    // The discovery endpoint, not the CDN URL it 302s to: that one carries a
    // signature and must be re-resolved per play, so it is never persisted.
    streamUrl: api(`/tracks/${t.id}/stream`),
    licenseUrl: t.license,
    duration: t.duration,
    downloadable: true,
  };
}

export const audius: TrackSource = {
  name: "audius",

  async search(query) {
    const url = `/tracks/search?query=${encodeURIComponent(query)}&app_name=${APP}`;
    const res = await fetch(`${API}${url}`);
    if (!res.ok) throw new Error(`Audius: ${res.status}`);
    const { data } = (await res.json()) as { data: AudiusTrack[] };
    return (data ?? []).map(map);
  },

  async resolve(rawUrl) {
    const m = rawUrl.match(/audius\.co\/(?:tracks\/)?([\w]+)/);
    if (!m) return null;
    const res = await fetch(api(`/tracks/${m[1]}`));
    if (!res.ok) return null;
    const { data } = (await res.json()) as { data: AudiusTrack | null };
    return data ? map(data) : null;
  },

  webUrl: (track) => `https://audius.co/tracks/${track.id.split(":")[1]}`,
};

/**
 * Browse, used to fill the empty state. Audius is the only keyless source with
 * real music, so when a query finds nothing the useful answer is *something
 * playable*, not a dead end.
 *
 * ponytail: no genre picker. One trending list beats a menu of filters nobody
 * taps — add genres when a browse session is shown to want them.
 */
export async function audiusTrending(): Promise<Track[]> {
  const res = await fetch(api("/tracks/trending"));
  if (!res.ok) throw new Error(`Audius: ${res.status}`);
  const { data } = (await res.json()) as { data: AudiusTrack[] };
  return (data ?? []).slice(0, 15).map(map);
}