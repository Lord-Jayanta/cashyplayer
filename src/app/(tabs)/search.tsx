import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, space } from "@/ui/theme";
import { searchAll, resolveUrl, webUrlFor, type Track } from "@/sources";
import { usePlayer } from "@/features/player/PlayerProvider";
import { downloadTrack, localUriFor, touchPlay } from "@/features/downloads/downloads";
import { saveTrack, toggleFavorite, isFavorite } from "@/features/library/library";
import { YouTubeSearch } from "@/ui/YouTubeSearch";

const isUrl = (s: string) => /^https?:\/\//.test(s.trim());

export default function Search() {
  const { q = "" } = useLocalSearchParams<{ q: string }>();
  // Results are tagged with the query that produced them, so a pending search
  // reads as loading without setState inside the effect body.
  const [res, setRes] = useState<{ q: string; tracks: Track[]; error: string | null }>({
    q: "",
    tracks: [],
    error: null,
  });

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // A pasted link takes a different path: resolve to one track instead of
        // running a search query.
        const found = isUrl(q) ? [await resolveUrl(q)].filter(Boolean) : await searchAll(q);
        if (alive) setRes({ q, tracks: found as Track[], error: null });
      } catch (e) {
        if (alive) setRes({ q, tracks: [], error: e instanceof Error ? e.message : "Search failed" });
      }
    })();

    return () => {
      alive = false;
    };
  }, [q]);

  const loading = res.q !== q;
  const { tracks, error } = loading ? { tracks: [], error: null } : res;

  return (
    <View style={[styles.root, { paddingTop: useSafeAreaInsets().top + space(4) }]}>
      <Text style={styles.heading} numberOfLines={1}>
        {q}
      </Text>

      {loading ? (
        <ActivityIndicator style={styles.center} color={colors.accent} />
      ) : error ? (
        <Text style={[styles.center, styles.error]}>{error}</Text>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => <Row track={item} queue={tracks} />}
          ListEmptyComponent={
            <View>
              <Text style={styles.center}>
                Nothing playable for “{q}” in our catalogues.
              </Text>
            </View>
          }
          // Always last: this is how a missing track gets found rather than
          // becoming a dead end.
          ListFooterComponent={q ? <YouTubeSearch query={q} /> : null}
        />
      )}
    </View>
  );
}

function Row({ track, queue }: { track: Track; queue: Track[] }) {
  const db = useSQLiteContext();
  const player = usePlayer();
  const [fav, setFav] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    isFavorite(db, track.id).then(setFav);
  }, [db, track.id]);

  const isCurrent = player.track?.id === track.id;

  // Be explicit about what a tap will actually do. A preview that silently
  // stops after 30s reads as a bug.
  const badge = track.externalOnly
    ? "opens in YouTube"
    : saving
      ? "downloading…"
      : track.downloadable
        ? track.source
        : `${track.source} · 30s preview`;

  const glyph = track.externalOnly ? "↗" : isCurrent && player.playing ? "❚❚" : "▶";

  const press = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // No in-app audio (YouTube link, unknown URL): hand off rather than feed an
    // HTML page to the decoder, which fails with an opaque error.
    if (track.externalOnly) {
      await WebBrowser.openBrowserAsync(webUrlFor(track));
      return;
    }

    // Local file if we have an unexpired copy, else stream — and kick off a
    // download in parallel when the source permits one.
    const local = await localUriFor(db, track.id);
    await saveTrack(db, track);
    player.play({ ...track, streamUrl: local ?? track.streamUrl }, queue);
    if (local) await touchPlay(db, track.id);

    if (track.downloadable && !local) {
      setSaving(true);
      downloadTrack(db, track).catch(() => {}).finally(() => setSaving(false));
    }
  };

  const longPress = async () => {
    // Preview-only sources have nothing to save, so long-press opens externally.
    if (track.downloadable) {
      await downloadTrack(db, track);
      return;
    }
    await WebBrowser.openBrowserAsync(webUrlFor(track));
  };

  return (
    <Pressable
      onPress={press}
      onLongPress={longPress}
      delayLongPress={350}
      style={styles.row}
    >
      <Image
        source={track.artworkUrl ? { uri: track.artworkUrl } : undefined}
        style={styles.art}
        contentFit="cover"
      />
      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {track.artist}
        </Text>
        <Text style={styles.tag} numberOfLines={1}>
          {badge}
        </Text>
      </View>

      <Pressable
        hitSlop={10}
        onPress={async () => {
          setFav(await toggleFavorite(db, track.id));
        }}
      >
        <Text style={styles.fav}>{fav ? "♥" : "♡"}</Text>
      </Pressable>

      <Text style={styles.play}>{glyph}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space(5) },
  heading: { color: colors.text, fontSize: 17, fontWeight: "600", marginBottom: space(4) },
  center: { marginTop: space(20), color: colors.textMuted, textAlign: "center" },
  error: { color: colors.textMuted },
  list: { paddingBottom: space(30) },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  row: { flexDirection: "row", alignItems: "center", gap: space(3), paddingVertical: space(3) },
  art: { width: 52, height: 52, borderRadius: radius.art, backgroundColor: colors.surface },
  meta: { flex: 1, gap: 2 },
  title: { color: colors.text, fontSize: 15, fontWeight: "600" },
  artist: { color: colors.textMuted, fontSize: 13 },
  tag: { color: colors.accent, fontSize: 11 },
  fav: { color: colors.accent, fontSize: 20, paddingHorizontal: space(1) },
  play: { color: colors.text, fontSize: 15 },
});