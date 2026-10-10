import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { ArrowLeft } from "lucide-react-native";

import { getPackage } from "../../../../../lib/api/packages";
import { ApiError } from "../../../../../lib/api/client";
import { PackageForm } from "../../../../../components/logistics/PackageForm";
import { ErrorState } from "../../../../../components/home/ui";

export default function EditPackageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["package", id],
    queryFn: ({ signal }) => getPackage(id, signal),
    enabled: !!id,
  });

  return (
    <SafeAreaView className="flex-1 bg-muted" edges={["top"]}>
      <View className="flex-row items-center gap-3 border-b border-border bg-white px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ArrowLeft size={22} color="#0E1A14" />
        </Pressable>
        <Text className="text-lg font-bold text-ink">Edit package</Text>
      </View>

      {query.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : query.isError ? (
        <ErrorState
          message={query.error instanceof ApiError ? query.error.message : "Could not load this package."}
          onRetry={() => query.refetch()}
        />
      ) : query.data ? (
        <PackageForm
          mode="edit"
          packageId={id}
          initial={query.data}
          onCancel={() => router.back()}
          onSaved={(pkg) => {
            queryClient.invalidateQueries({ queryKey: ["packages"] });
            queryClient.invalidateQueries({ queryKey: ["package", id] });
            queryClient.invalidateQueries({ queryKey: ["logistics-stats"] });
            router.replace(`/logistics/packages/${pkg.id}`);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}
