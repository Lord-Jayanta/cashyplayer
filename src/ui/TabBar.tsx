import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, space } from "@/ui/theme";
import { usePlayer } from "@/features/player/PlayerProvider";

/**
 * Structural subset of BottomTabBarProps. React Navigation isn't a direct
 * dependency here — expo-router bundles it — so we type only the two fields
 * this component uses rather than importing an internal build path.
 */
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate(name: string): void };
  /** Needed for the human title — route.name is the filename ("index"). */
  descriptors: Record<string, { options: { title?: string } }>;
};

/** Plain glyphs, not SF Symbols private-use codepoints: those render as tofu
 *  on Android since there is no SF font to map them into. */
const ICONS: Record<string, string> = {
  index: "⌂",
  library: "≡",
  settings: "⚙",
};

/**
 * The mini player lives inside the custom tab bar rather than being absolutely
 * positioned against a system bar — one floating element instead of two
 * competing for the same space. Native tabs cannot do this.
 */
export function TabBar({ state, navigation, descriptors }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, space(2)) }]}>
      <MiniPlayer />
      <View style={styles.pill}>
        {/* search is a pushed screen, not a tab — home's search bar routes to it. */}
        {state.routes
          .map((route, i) => ({ route, i }))
          .filter(({ route }) => route.name !== "search")
          .map(({ route, i }) => {
            // i is the index in state.routes, not the filtered list — state.index
            // refers to the unfiltered one.
            const focused = state.index === i;
            const onPress = () => {
              if (focused) return;
              Haptics.selectionAsync();
              navigation.navigate(route.name);
            };
            return (
              <TabItem
                key={route.key}
                // Screen title, not the filename: route.name is "index".
                label={descriptors[route.key]?.options.title ?? route.name}
                icon={ICONS[route.name] ?? "•"}
                focused={focused}
                onPress={onPress}
              />
            );
          })}
      </View>
    </View>
  );
}

function TabItem({
  label,
  icon,
  focused,
  onPress,
}: {
  label: string;
  icon: string;
  focused: boolean;
  onPress: () => void;
}) {
  const progress = useDerivedValue(
    () => withSpring(focused ? 1 : 0, { damping: 18, stiffness: 220 })
  );
  const iconStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [colors.textMuted, colors.accent]),
  }));

  return (
    <Pressable style={styles.item} onPress={onPress} accessibilityRole="tab">
      <Animated.Text style={[styles.icon, iconStyle]}>{icon}</Animated.Text>
      <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

function MiniPlayer() {
  const { track, playing, toggle, position, duration } = usePlayer();

  if (!track) {
    return <View style={styles.miniHidden} />;
  }

  const pct = duration > 0 ? Math.min(position / duration, 1) : 0;

  return (
    <Pressable style={styles.mini} onPress={toggle}>
      <Animated.View style={[styles.miniProgress, { width: `${pct * 100}%` }]} />
      <Image source={{ uri: track.artworkUrl }} style={styles.miniArt} contentFit="cover" />
      <View style={styles.miniText}>
        <Text style={styles.miniTitle} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={styles.miniArtist} numberOfLines={1}>
          {track.artist}
        </Text>
      </View>
      <Text style={styles.miniGlyph}>{playing ? "❚❚" : "▶"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space(4),
    gap: space(2),
    backgroundColor: colors.bg,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  item: { alignItems: "center", justifyContent: "center", flex: 1, gap: 2 },
  icon: { fontSize: 20 },
  label: { fontSize: 10, color: colors.textMuted },
  labelActive: { color: colors.accent },
  miniHidden: { height: 56 },
  mini: {
    height: 56,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: space(2),
    flexDirection: "row",
    alignItems: "center",
    gap: space(2),
    overflow: "hidden",
  },
  miniProgress: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.accentMuted,
  },
  miniArt: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.surface },
  miniText: { flex: 1, gap: 2 },
  miniTitle: { color: colors.text, fontSize: 14, fontWeight: "600" },
  miniArtist: { color: colors.textMuted, fontSize: 12 },
  miniGlyph: { color: colors.text, fontSize: 18, paddingHorizontal: space(2) },
});