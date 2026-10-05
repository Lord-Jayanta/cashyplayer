import type { SQLiteDatabase } from "expo-sqlite";
import type { TrackKey } from "@/db";
import type { Track } from "@/sources";

const FAVORITES = "favorites";

/** Catalog metadata. Playlists and downloads reference this, so it must exist
 *  before either can point at it. */
export async function saveTrack(db: SQLiteDatabase, t: Track) {
  await db.runAsync(
    `INSERT INTO tracks (id, source, title, artist, artwork_url, stream_url, download_url, license_url, duration)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       artist = excluded.artist,
       artwork_url = excluded.artwork_url,
       stream_url = excluded.stream_url,
       download_url = excluded.download_url,
       license_url = excluded.license_url,
       duration = excluded.duration`,
    t.id,
    t.source,
    t.title,
    t.artist,
    t.artworkUrl ?? null,
    t.streamUrl,
    t.downloadUrl ?? null,
    t.licenseUrl ?? null,
    t.duration ?? null
  );
}

export async function isFavorite(db: SQLiteDatabase, trackId: TrackKey): Promise<boolean> {
  const row = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?",
    FAVORITES,
    trackId
  );
  return Boolean(row?.n);
}

/** Returns the new state so callers can update directly. */
export async function toggleFavorite(db: SQLiteDatabase, trackId: TrackKey): Promise<boolean> {
  if (await isFavorite(db, trackId)) {
    await db.runAsync(
      "DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?",
      FAVORITES,
      trackId
    );
    return false;
  }

  const next = await db.getFirstAsync<{ n: number }>(
    "SELECT COALESCE(MAX(position), -1) + 1 AS n FROM playlist_tracks WHERE playlist_id = ?",
    FAVORITES
  );
  await db.runAsync(
    "INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at) VALUES (?, ?, ?, ?)",
    FAVORITES,
    trackId,
    next?.n ?? 0,
    Date.now()
  );
  return true;
}

/** Stored shape — snake_case columns, which is what the UI reads. */
export type StoredTrack = {
  id: string;
  source: string;
  title: string;
  artist: string;
  artwork_url: string | null;
  stream_url: string;
  expires_at: number | null;
  local_uri: string | null;
};

export function favorites(db: SQLiteDatabase) {
  return db.getAllAsync<StoredTrack>(
    `SELECT t.id, t.source, t.title, t.artist, t.artwork_url, t.stream_url,
            d.expires_at, d.local_uri
     FROM playlist_tracks pt
     JOIN tracks t ON t.id = pt.track_id
     LEFT JOIN downloads d ON d.track_id = t.id
     WHERE pt.playlist_id = ?
     ORDER BY pt.position`,
    FAVORITES
  );
}

export function playlists(db: SQLiteDatabase) {
  return db.getAllAsync<{ id: string; name: string; is_default: number; count: number }>(
    `SELECT p.id, p.name, p.is_default, COUNT(pt.track_id) AS count
     FROM playlists p
     LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
     GROUP BY p.id
     ORDER BY p.is_default DESC, p.created_at`
  );
}