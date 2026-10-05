import { Tabs } from "expo-router";
import { TabBar } from "@/ui/TabBar";

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "home" }} />
      {/* Pushed from home's search bar. Kept out of the pill by TabBar's filter
          rather than href:null, which would also block router.push. */}
      <Tabs.Screen name="search" options={{ title: "search" }} />
      <Tabs.Screen name="library" options={{ title: "library" }} />
      <Tabs.Screen name="settings" options={{ title: "settings" }} />
    </Tabs>
  );
}