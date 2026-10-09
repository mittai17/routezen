import { User } from "lucide-react-native";
import { View } from "react-native";

import { EmptyState, ScreenHeader } from "../../../components/ui";

/**
 * Placeholder for the Profile tab. Owned by the "Profile/Settings +
 * offline/storage + QA" agent (see `docs/MOBILE.md` file ownership #5) —
 * replace this file with the real profile/settings screen.
 */
export default function ProfilePlaceholder() {
  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader title="Profile" />
      <EmptyState
        icon={<User size={28} color="#5B6B60" />}
        title="Profile coming soon"
        description="Account details and app settings will live here."
      />
    </View>
  );
}
