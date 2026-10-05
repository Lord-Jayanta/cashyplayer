import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, space } from "@/ui/theme";
import { downloadedBytes, sweepExpired } from "@/features/downloads/downloads";

export default function Settings() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [bytes, setBytes] = useState<number | null>(null);
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    const row = await downloadedBytes(db);
    setBytes(row?.total ?? 0);
    const n = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM downloads");
    setCount(n?.n ?? 0);
  }, [db]);

  useFocusEffect(() => {
    load();
  });

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space(4) }]}
    >
      <Text style={styles.heading}>Settings</Text>

      <View style={styles.card}>
        <Row label="Downloads" value={`${count}`} />
        <Row label="On disk" value={fmtBytes(bytes)} />
        <Text style={styles.note}>Downloads expire 7 days after the last play.</Text>
      </View>

      <Pressable style={styles.button} onPress={async () => {
        await sweepExpired(db);
        await load();
      }}>
        <Text style={styles.buttonText}>Clear expired downloads</Text>
      </Pressable>
    </ScrollView>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
  </View>
);

const fmtBytes = (b: number | null) => {
  if (!b) return "0 MB";
  const mb = b / 1024 / 1024;
  return mb < 1024 ? `${mb.toFixed(1)} MB` : `${(mb / 1024).toFixed(2)} GB`;
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space(5), paddingBottom: space(30) },
  heading: { color: colors.text, fontSize: 28, fontWeight: "800", marginBottom: space(6) },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: space(4),
    gap: space(3),
    marginBottom: space(4),
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  label: { color: colors.textMuted, fontSize: 14 },
  value: { color: colors.text, fontSize: 14, fontWeight: "600" },
  note: { color: colors.textMuted, fontSize: 12 },
  button: {
    height: 48,
    borderRadius: radius.card,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});