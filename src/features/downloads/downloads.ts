import { Directory, File, Paths } from "expo-file-system";
import type { SQLiteDatabase } from "expo-sqlite";
import type { Track } from "@/sources";
import { expiryFor, isExpired } from "@/db";

export { expiryFor };

/** Downloads live in document dir, not cache — cache can be evicted by the OS
 *  behind our back, which would silently invalidate expires_at. */
const dir = new Directory(Paths.document, "tracks");

function ensureDir() {
  if (!dir.exists) dir.create({ intermediates: true });
}

/** One in-flight download per track; a second request joins the first. */
const inflight = new Map<string, Promise<void>>();

export async function downloadTrack(db: SQLiteDatabase, track: Track): Promise<void> {
  if (!track.downloadUrl) return;
  const existing = inflight.get(track.id);
  if (existing) return existing;

  const job = (async () => {
    ensureDir();
    const now = Date.now();
    const file = new File(dir, `${track.id.replace(":", "-")}.mp3`);

    await File.downloadFileAsync(track.downloadUrl!, file);

    await db.runAsync(
      `INSERT INTO downloads (track_id, local_uri, bytes, downloaded_at, expires_at, last_played_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(track_id) DO UPDATE SET
         local_uri = excluded.local_uri,
         bytes = excluded.bytes,
         expires_at = excluded.expires_at,
         last_played_at = excluded.last_played_at`,
      track.id,
      file.uri,
      file.size,
      now,
      expiryFor(now),
      now
    );
  })().finally(() => inflight.delete(track.id));

  inflight.set(track.id, job);
  return job;
}

/** Local file if present and unexpired, else null so the caller streams. */
export async function localUriFor(db: SQLiteDatabase, trackId: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ local_uri: string; expires_at: number }>(
    "SELECT local_uri, expires_at FROM downloads WHERE track_id = ?",
    trackId
  );
  if (!row) return null;
  if (isExpired(row.expires_at)) return null;

  const file = new File(row.local_uri);
  if (!file.exists) {
    await db.runAsync("DELETE FROM downloads WHERE track_id = ?", trackId);
    return null;
  }
  return row.local_uri;
}

export async function touchPlay(db: SQLiteDatabase, trackId: string) {
  await db.runAsync(
    "UPDATE downloads SET last_played_at = ?, expires_at = ? WHERE track_id = ?",
    Date.now(),
    expiryFor(),
    trackId
  );
}

/**
 * Runs on app foreground. Cascades to playlist_tracks via the foreign key, so a
 * deleted track disappears from Favorites too — intended, since we no longer
 * have metadata to render its row.
 */
export async function sweepExpired(db: SQLiteDatabase): Promise<number> {
  const now = Date.now();
  const stale = await db.getAllAsync<{ track_id: string; local_uri: string }>(
    "SELECT track_id, local_uri FROM downloads WHERE expires_at < ?",
    now
  );

  for (const { local_uri } of stale) {
    const file = new File(local_uri);
    if (file.exists) file.delete();
  }

  await db.runAsync("DELETE FROM tracks WHERE id IN (SELECT track_id FROM downloads WHERE expires_at < ?)", now);
  return stale.length;
}

export function downloadedBytes(db: SQLiteDatabase) {
  return db.getFirstAsync<{ total: number | null }>(
    "SELECT SUM(bytes) AS total FROM downloads"
  );
}