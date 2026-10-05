import type { Track } from "./types";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Signals "not the studio original". Deliberately broad: a karaoke, live or
 * 12-inch mix outranking the real track is the exact wrong-result bug this
 * exists to stop.
 */
const DERIVATIVE =
  /\b(remix|flip|tribute|cover|mashup|bootleg|edit|rework|dub|karaoke|acoustic|instrumental|live|version|mix|mono|sped|slowed|reprise)\b/i;

export const isDerivative = (title: string) => DERIVATIVE.test(title);

/**
 * Ranking exists because the catalogues disagree sharply: searching "daft punk"
 * on Audius returns only unofficial remixes and flips, never an original, while
 * iTunes returns the genuine release as a 30s preview. Neither source wins on
 * its own, so results are interleaved by how well each actually matches.
 *
 * Known limit: a cover and the original can look identical to this scorer,
 * because no source reports "is this the original recording". Ranking fixes the
 * remix flood; it cannot fix a catalogue that lacks the track.
 */
export function score(t: Track, query: string): number {
  const q = norm(query);
  const title = norm(t.title);
  const artist = norm(t.artist);

  let s = 0;
  if (title === q) s += 100;
  else if (title.startsWith(q)) s += 60;
  else if (title.includes(q)) s += 35;

  if (artist.includes(q)) s += 30;
  for (const word of q.split(" ").filter((w) => w.length > 2)) {
    if (title.includes(word)) s += 12;
    if (artist.includes(word)) s += 8;
  }

  // Heavy penalty, not a filter: a labelled remix is still better than nothing.
  if (isDerivative(t.title)) s -= 70;

  // Prefer what we can actually keep. Previews are last resort.
  s += t.downloadable ? 15 : 0;

  return s;
}

/** Dedupe key. The same song on two albums shares this. */
export const dedupeKey = (t: Track) => norm(`${t.title}|${t.artist}`);