import type { Track } from "@/sources";

const RELEASES = "https://api.jamendo.com/v3.0";

type JamendoTrack = {
  id: string;
  name: string;
  artist_name: string;
  album_image?: string;
  image?: string;
  audio: string;
  audiodownload?: string;
  audiodownload_allowed?: boolean;
  license_ccurl?: string;
  duration?: number;
};

function map(t: JamendoTrack): Track {
  return {
    id: `jamendo:${t.id}`,
    source: "jamendo",
    title: t.name,
    artist: t.artist_name,
    artworkUrl: t.album_image ?? t.image,
    streamUrl: t.audio,
    downloadUrl: t.audiodownload_allowed && t.audiodownload ? t.audiodownload : undefined,
    licenseUrl: t.license_ccurl,
    duration: t.duration,
    downloadable: Boolean(t.audiodownload_allowed && t.audiodownload),
  };
}

/**
 * Secondary source, kept because its catalogue and licence terms are the
 * strongest of the three — not because it needs no key (it does).
 *
 * Jamendo is the only source here that ships a per-track Creative Commons URL,
 * which is the cleanest licence position for anything we persist to disk. Worth
 * wiring up if you ever want a Jamendo client id: then it returns tracks Audius
 * doesn't have, with explicit licence metadata attached.
 *
 * ponytail: unreachable without EXPO_PUBLIC_JAMENDO_CLIENT_ID — remove this file
 * and its registry line rather than shipping a source that always throws.
 */
export async function jamendoSearch(
  clientId: string,
  query: string
): Promise<Track[]> {
  if (!clientId) throw new Error("Jamendo needs EXPO_PUBLIC_JAMENDO_CLIENT_ID");

  const url = new URL(`${RELEASES}/tracks`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("format", "json");
  url.searchParams.set("search", query);
  url.searchParams.set("limit", "25");
  url.searchParams.set("audioformat", "mp32");
  url.searchParams.set("imagesize", "300");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Jamendo: ${res.status}`);
  const { results } = (await res.json()) as { results: JamendoTrack[] };
  return results.map(map);
}