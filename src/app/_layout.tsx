import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { SQLiteProvider, useSQLiteContext } from "expo-sqlite";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { PlayerProvider } from "@/features/player/PlayerProvider";
import { migrate } from "@/db";
import { sweepExpired } from "@/features/downloads/downloads";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName="cashyplayer.db" onInit={migrate}>
        <PlayerProvider>
          <ExpirySweep />
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0B0B0F" } }}>
            <Stack.Screen name="(tabs)" />
          </Stack>
        </PlayerProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}

/**
 * Foreground sweep only. No expo-background-task: a 7-day expiry makes missed
 * sweeps harmless, and this runs before the first screen paints.
 */
function ExpirySweep() {
  const db = useSQLiteContext();
  const [done, setDone] = useState(false);

  useEffect(() => {
    sweepExpired(db).catch(() => {}).finally(() => setDone(true));
  }, [db]);

  if (!done) return null;
  return null;
}