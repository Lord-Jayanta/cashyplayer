import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, space } from "@/ui/theme";
import { favorites, playlists, toggleFavorite, type StoredTrack } from "@/features/library/library";
import { usePlayer } from "@/features/player/PlayerProvider";
import type { Track } from "@/sources";

export default function Library() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [lists, setLists] = useState<{ id: string; name: string; count: number }[]>([]);
  const [open, setOpen] = useState<string>("favorites");

  // Re-query on focus so favourites reflect rows deleted by the expiry sweep.
  const load = useCallback(async () => setLists(await playlists(db)), [db]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + space(4) }]}>
      <Text style={styles.heading}>Library</Text>

      <View style={styles.chips}>
        {lists.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => {
              Haptics.selectionAsync();
              setOpen(p.id);
            }}
            style={[styles.chip, open === p.id && styles.chipOn]}
          >
            <Text style={[styles.chipText, open === p.id && styles.chipTextOn]}>{p.name}</Text>
            <Text style={styles.chipCount}>{p.count}</Text>
          </Pressable>
        ))}
      </View>

      <FavoriteList playlistId={open} key={open} />
    </View>
  );
}

const toTrack = (r: StoredTrack): Track => ({
  id: r.id,
  source: r.source,
  title: r.title,
  artist: r.artist,
  artworkUrl: r.artwork_url ?? undefined,
  streamUrl: r.stream_url,
  downloadable: false,
});

function FavoriteList({ playlistId }: { playlistId: string }) {
  const db = useSQLiteContext();
  const player = usePlayer();
  const [rows, setRows] = useState<StoredTrack[]>([]);

  // playlistId is in the key, so the list reloads when the chip changes.
  useFocusEffect(
    useCallback(() => {
      favorites(db).then(setRows);
    }, [db])
  );

  if (!rows.length) {
    return <Text style={styles.empty}>Nothing here yet. Tap the heart on a search result.</Text>;
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.id}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      renderItem={({ item }) => (
        <Pressable
          style={styles.row}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            player.play(
              toTrack(item),
              rows.map(toTrack)
            );
          }}
        >
          <Image
            source={item.artwork_url ? { uri: item.artwork_url } : undefined}
            style={styles.art}
            contentFit="cover"
          />
          <View style={styles.meta}>
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {item.artist}
            </Text>
          </View>
          <Pressable
            hitSlop={10}
            onPress={async () => {
              await toggleFavorite(db, item.id);
              setRows(await favorites(db));
            }}
          >
            <Text style={styles.fav}>♥</Text>
          </Pressable>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space(5) },
  heading: { color: colors.text, fontSize: 28, fontWeight: "800", marginBottom: space(4) },
  chips: { flexDirection: "row", gap: space(2), marginBottom: space(4), flexWrap: "wrap" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(2),
    paddingHorizontal: space(4),
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.accent },
  chipText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  chipTextOn: { color: "#fff" },
  chipCount: { color: colors.textMuted, fontSize: 11 },
  list: { paddingBottom: space(30) },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  row: { flexDirection: "row", alignItems: "center", gap: space(3), paddingVertical: space(3) },
  art: { width: 48, height: 48, borderRadius: radius.art, backgroundColor: colors.surface },
  meta: { flex: 1, gap: 2 },
  title: { color: colors.text, fontSize: 15, fontWeight: "600" },
  artist: { color: colors.textMuted, fontSize: 13 },
  fav: { color: colors.accent, fontSize: 20 },
  empty: { color: colors.textMuted, marginTop: space(10), textAlign: "center" },
});