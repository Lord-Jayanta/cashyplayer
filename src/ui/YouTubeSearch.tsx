import { Pressable, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { colors, radius, space } from "@/ui/theme";

/**
 * The escape hatch for catalogue gaps. Audius and iTunes together do not have
 * the same reach as YouTube, so when a track isn't there this hands the query
 * to YouTube instead of showing a dead end. No key, no quota, fully legal.
 */
export function YouTubeSearch({ query }: { query: string }) {
  const open = () =>
    WebBrowser.openBrowserAsync(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
    );

  return (
    <Pressable style={styles.row} onPress={open}>
      <View style={styles.mark}>
        <Text style={styles.markText}>▶</Text>
      </View>
      <View style={styles.meta}>
        <Text style={styles.title}>Search YouTube</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {query}
        </Text>
      </View>
      <Text style={styles.arrow}>↗</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(3),
    padding: space(3),
    marginTop: space(4),
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  mark: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#2A1215",
    alignItems: "center",
    justifyContent: "center",
  },
  markText: { color: "#FF0033", fontSize: 15 },
  meta: { flex: 1, gap: 2 },
  title: { color: colors.text, fontSize: 14, fontWeight: "600" },
  sub: { color: colors.textMuted, fontSize: 12 },
  arrow: { color: colors.textMuted, fontSize: 18 },
});