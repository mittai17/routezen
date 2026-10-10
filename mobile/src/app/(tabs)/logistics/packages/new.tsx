import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable, Text, View } from "react-native";
import { ArrowLeft } from "lucide-react-native";

import { PackageForm } from "../../../../components/logistics/PackageForm";

export default function NewPackageScreen() {
  const queryClient = useQueryClient();

  return (
    <SafeAreaView className="flex-1 bg-muted" edges={["top"]}>
      <View className="flex-row items-center gap-3 border-b border-border bg-white px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ArrowLeft size={22} color="#0E1A14" />
        </Pressable>
        <Text className="text-lg font-bold text-ink">Add package</Text>
      </View>
      <PackageForm
        mode="create"
        onCancel={() => router.back()}
        onSaved={(pkg) => {
          queryClient.invalidateQueries({ queryKey: ["packages"] });
          queryClient.invalidateQueries({ queryKey: ["logistics-stats"] });
          router.replace(`/logistics/packages/${pkg.id}`);
        }}
      />
    </SafeAreaView>
  );
}
