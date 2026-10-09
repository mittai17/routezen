import { Tabs } from "expo-router";
import { Compass, Home, Map, Truck, User } from "lucide-react-native";

const ACTIVE_COLOR = "#0E4429"; // brand.green
const INACTIVE_COLOR = "#5B6B60"; // ink-muted
const BORDER_COLOR = "#E4E8E1"; // border

/**
 * Bottom tab shell. Each tab's `index.tsx` placeholder below will be
 * replaced by the agent that owns that route group — see
 * `docs/MOBILE.md` "File ownership". This layout only needs those files
 * to exist so the navigator can resolve a screen per tab.
 *
 * Expo Router's `<Tabs>` auto-registers EVERY route folder under
 * `(tabs)/` as a tab, not just the ones listed below (confirmed in
 * `expo-router`'s `useSortedScreens`, which only filters to declared
 * screens when `useOnlyUserDefinedScreens` is set — the `Tabs` export
 * doesn't set it). The product spec calls for exactly 5 visible tabs
 * (Home, Travel, Logistics, Map, Profile); `lab` and `analytics` are
 * real routes owned by the Map/Quantum Lab/Analytics agent, reachable
 * via `router.push("/lab")` / `router.push("/analytics")` (already used
 * that way from Home and Map), so they're declared here with
 * `href: null` to keep them out of the tab bar without removing the
 * routes themselves. If a future agent adds another top-level folder
 * under `(tabs)/` and wants it off the tab bar, it needs the same
 * treatment here.
 */
export default function TabLayout() {
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: BORDER_COLOR,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="travel"
        options={{
          title: "Travel",
          tabBarIcon: ({ color, size }) => <Compass color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="logistics"
        options={{
          title: "Logistics",
          tabBarIcon: ({ color, size }) => <Truck color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ color, size }) => <Map color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
      {/* Real routes, intentionally not in the 5-tab bar — see note above. */}
      <Tabs.Screen name="lab" options={{ href: null }} />
      <Tabs.Screen name="analytics" options={{ href: null }} />
    </Tabs>
  );
}
