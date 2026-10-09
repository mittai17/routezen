import { View, Text } from "react-native";

export default function Splash() {
  return (
    <View className="flex-1 items-center justify-center bg-brand-green">
      <Text className="text-2xl font-bold text-white">RouteZen</Text>
      <Text className="mt-1 text-brand-yellow">Smarter Routes. Greener Tomorrow.</Text>
    </View>
  );
}
