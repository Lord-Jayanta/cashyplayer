import { trackKey } from "@/db";
import type { Track, TrackSource } from "./types";

type ITunesTrack = {
  trackId: number;
  trackName: string;
  artistName: string;
  artworkUrl100: string;
  previewUrl: string;
  trackTimeMillis?: number;
  collectionViewUrl?: string;
  trackViewUrl?: string;
};

/**
 * Metadata only. Gives mainstream chart artists and real artwork, but the
 * `previewUrl` is a 30s clip — there is no download, so `downloadable` is
 * always false. Used so users can locate real releases and open them externally.
 */
export const itunes: TrackSource = {
  name: "itunes",

  async search(query) {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=25`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`iTunes: ${res.status}`);
    const { results } = (await res.json()) as { results: ITunesTrack[] };

    return results.map<Track>((t) => ({
      id: trackKey("itunes", t.trackId),
      source: "itunes",
      title: t.trackName,
      artist: t.artistName,
      artworkUrl: t.artworkUrl100?.replace("100x100", "300x300"),
      streamUrl: t.previewUrl,
      duration: t.trackTimeMillis ? Math.round(t.trackTimeMillis / 1000) : undefined,
      downloadable: false,
    }));
  },

  async resolve(rawUrl) {
    const m = rawUrl.match(/itunes\.apple\.com\/.*\/id(\d+)/);
    if (!m) return null;
    const res = await fetch(`https://itunes.apple.com/lookup?id=${m[1]}`);
    if (!res.ok) return null;
    const { results } = (await res.json()) as { results: ITunesTrack[] };
    if (!results[0]) return null;

    const t = results[0];
    return {
      id: trackKey("itunes", t.trackId),
      source: "itunes",
      title: t.trackName,
      artist: t.artistName,
      artworkUrl: t.artworkUrl100?.replace("100x100", "300x300"),
      streamUrl: t.previewUrl,
      downloadable: false,
    };
  },

  webUrl(track) {
    return `https://music.apple.com/us/search?term=${encodeURIComponent(track.title)}`;
  },
};