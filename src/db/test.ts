/**
 * Self-check for the non-trivial rules in this app. Run with `bun run test`.
 * Asserts only — no framework. The resolveUrl cases hit the live network.
 *
 * ponytail: one runnable check per non-trivial branch, no fixtures.
 */

// Imports the real implementations, not copies — a mirror would pass while the
// shipped code broke.
import { SEVEN_DAYS, expiryFor, isExpired, trackKey } from "./index";
import { isDerivative, score } from "@/sources/rank";
import { resolveUrl } from "@/sources";
import type { Track } from "@/sources";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    console.log(`  ok  ${label}`);
  } else {
    console.log(`  FAIL ${label}`);
    failures++;
  }
}

console.log("expiry");
{
  const now = 1_700_000_000_000;
  const exp = expiryFor(now);
  check("is exactly 7 days", exp - now === SEVEN_DAYS);
  check("not expired at issue", !isExpired(exp, now));
  check("not expired 6d 23h later", !isExpired(exp, now + SEVEN_DAYS - 3_600_000));
  check("expired exactly 7d later", isExpired(exp, now + SEVEN_DAYS + 1));
  check("expired well after", isExpired(exp, now + 30 * SEVEN_DAYS));
}

console.log("track keys");
{
  // The reason keys are namespaced: a collision would let two sources' rows
  // overwrite each other, and `ondelete cascade` would wipe a favourite.
  check("differs across sources", trackKey("jamendo", 12) !== trackKey("itunes", 12));
  check("stable across calls", trackKey("jamendo", 12) === trackKey("jamendo", 12));
  check("round-trips the id", trackKey("jamendo", 12).split(":")[1] === "12");
}

console.log("download gating");
{
  // Both gates from the Jamendo contract must hold, not just one.
  const downloadable = (allowed: boolean | undefined, url: string | undefined) =>
    Boolean(allowed && url);

  check("allowed + url", downloadable(true, "https://x/a.mp3"));
  check("allowed, no url", !downloadable(true, undefined));
  check("not allowed, url present", !downloadable(false, "https://x/a.mp3"));
  check("neither", !downloadable(undefined, undefined));
  check("empty string counts as absent", !downloadable(true, ""));
}

console.log("result ranking");
{
  const track = (title: string, artist: string, downloadable = true) =>
    ({ id: `t:${title}`, source: "x", title, artist, streamUrl: "u", downloadable }) as Track;

  // The reported bug: a karaoke/remix outranking the genuine article.
  check("flags remix", isDerivative("One More Time (Sury Have Dubz Remix)"));
  check("flags karaoke", isDerivative("Get Lucky (Karaoke Version)"));
  check("flags live", isDerivative("Get Lucky (Live)"));
  check("flags 12-inch mix", isDerivative("One More Time (12 Mix)"));
  check("clears a plain title", !isDerivative("One More Time"));

  const q = "one more time daft punk";
  const real = track("One More Time", "Daft Punk");
  const remix = track("One More Time (Sury Have Dubz Remix)", "Someone Else");
  check("original outranks remix", score(real, q) > score(remix, q));

  const plain = track("One More Time", "Daft Punk");
  const karaoke = track("Get Lucky (Karaoke Version)", "Stagetraxx");
  check("karaoke does not outrank a clean match", score(plain, q) > score(karaoke, q));

  // Prefer what we can actually keep when the text match is otherwise equal.
  const dl = track("Breathe", "X", true);
  const preview = track("Breathe", "X", false);
  check("downloadable wins a tie", score(dl, "breathe") > score(preview, "breathe"));
}

console.log("youtube links");
{
  // A watch page is HTML. It must never be handed to the audio decoder.
  const yt = await resolveUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  check("resolves", yt !== null);
  check("marked external only", yt?.externalOnly === true);
  check("not downloadable", yt?.downloadable === false);

  const short = await resolveUrl("https://youtu.be/dQw4w9WgXcQ");
  check("short form resolves", short?.externalOnly === true);

  const aud = await resolveUrl("https://audius.co/tracks/mWB22");
  check("audius link is playable in-app", aud?.externalOnly !== true);
}

if (failures) {
  console.error(`\n${failures} failing check(s)`);
  process.exit(1);
}
console.log("\nall checks passed");