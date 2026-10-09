import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Leaf, Route, Truck } from "lucide-react-native";
import { useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "../components/ui";

/** See `src/app/index.tsx` for why this key is duplicated rather than shared. */
const ONBOARDING_COMPLETE_KEY = "routezen.onboarding.completed";

type Slide = {
  key: string;
  icon: React.ReactNode;
  title: string;
  description: string;
};

const SLIDES: Slide[] = [
  {
    key: "travel-logistics",
    icon: <Route size={40} color="#0E4429" />,
    title: "Plan Smarter Travel & Logistics",
    description:
      "Build multi-stop road trips and delivery routes side by side — real routing, not guesswork.",
  },
  {
    key: "optimization",
    icon: <Truck size={40} color="#0E4429" />,
    title: "Optimize Every Route",
    description:
      "Compare cheapest, fastest and lowest-emission options for deliveries and journeys, powered by classical and quantum-inspired optimization.",
  },
  {
    key: "sustainability",
    icon: <Leaf size={40} color="#0E4429" />,
    title: "Travel & Deliver Sustainably",
    description:
      "Track distance, cost and CO2 saved on every trip, and make the greener choice without slowing down.",
  },
];

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Slide>>(null);
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const isLastSlide = activeIndex === SLIDES.length - 1;

  const finishOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
    } catch {
      // Non-fatal: worst case the user sees onboarding again next launch.
    }
    router.replace("/home");
  };

  const goToSlide = (index: number) => {
    listRef.current?.scrollToOffset({ offset: index * width, animated: true });
    setActiveIndex(index);
  };

  const handleNext = () => {
    if (isLastSlide) {
      finishOnboarding();
      return;
    }
    goToSlide(activeIndex + 1);
  };

  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveIndex(Math.max(0, Math.min(SLIDES.length - 1, index)));
  };

  return (
    <View className="flex-1 bg-surface" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="flex-row justify-end px-4 pt-2">
        {!isLastSlide ? (
          <Pressable
            onPress={finishOnboarding}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
            hitSlop={12}
            className="min-h-[44px] min-w-[44px] items-center justify-center px-2"
          >
            <Text className="text-sm font-semibold text-ink-muted">Skip</Text>
          </Pressable>
        ) : (
          <View className="min-h-[44px]" />
        )}
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.key}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={{ width }} className="flex-1 items-center justify-center px-8">
            <View className="mb-8 h-24 w-24 items-center justify-center rounded-full bg-brand-yellow/30">
              {item.icon}
            </View>
            <Text className="text-center text-2xl font-bold text-ink" accessibilityRole="header">
              {item.title}
            </Text>
            <Text className="mt-3 text-center text-base text-ink-muted">{item.description}</Text>
          </View>
        )}
      />

      <View className="items-center gap-6 px-8 pb-2">
        <View
          className="flex-row gap-2"
          accessibilityRole="adjustable"
          accessibilityLabel={`Step ${activeIndex + 1} of ${SLIDES.length}`}
        >
          {SLIDES.map((slide, index) => (
            <View
              key={slide.key}
              className={`h-2 rounded-pill ${index === activeIndex ? "w-6 bg-brand-green" : "w-2 bg-border"}`}
            />
          ))}
        </View>

        <Button
          label={isLastSlide ? "Get Started" : "Next"}
          variant="secondary"
          size="lg"
          onPress={handleNext}
          className="w-full"
        />
      </View>
    </View>
  );
}
