import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { colors, radius, space } from "@/ui/theme";

/** Home is deliberately near-empty: logo + one input. Results live in /search. */
export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");

  const submit = () => {
    const query = q.trim();
    if (!query) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/(tabs)/search", params: { q: query } });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + space(8) }]}>
      <View style={styles.brand}>
        <View style={styles.mark} />
        <Text style={styles.logo}>Cashy</Text>
        <Text style={styles.logoDim}>Player</Text>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          value={q}
          onChangeText={setQ}
          onSubmitEditing={submit}
          placeholder="Search songs or paste a link"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        {q.length > 0 && (
          <Pressable style={styles.go} onPress={submit} hitSlop={8}>
            <Text style={styles.goText}>→</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: space(6),
  },
  brand: { flexDirection: "row", alignItems: "baseline", gap: space(2), marginBottom: space(12) },
  mark: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accent,
    alignSelf: "center",
  },
  logo: { color: colors.text, fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
  logoDim: { color: colors.textMuted, fontSize: 30, fontWeight: "300" },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: space(5),
  },
  input: { flex: 1, height: 56, color: colors.text, fontSize: 16 },
  go: { paddingLeft: space(2) },
  goText: { color: colors.accent, fontSize: 22 },
});