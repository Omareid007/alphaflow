import React from "react";
import { StyleSheet, Pressable, View, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { BrandColors, Spacing, Shadows } from "@/constants/theme";

interface FloatingActionButtonProps {
  isRunning: boolean;
  hasError: boolean;
  onPress: () => void;
  tabBarHeight?: number;
}

const DEFAULT_TAB_BAR_HEIGHT = Platform.select({ ios: 83, android: 60, default: 60 });

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function FloatingActionButton({ isRunning, hasError, onPress, tabBarHeight }: FloatingActionButtonProps) {
  const insets = useSafeAreaInsets();
  const effectiveTabBarHeight = tabBarHeight ?? DEFAULT_TAB_BAR_HEIGHT;
  const scale = useSharedValue(1);
  const pulseScale = useSharedValue(1);

  React.useEffect(() => {
    if (isRunning && !hasError) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 300 });
    }
  }, [isRunning, hasError]);

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedGlowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: interpolate(pulseScale.value, [1, 1.15], [0.3, 0]),
  }));

  const getBackgroundColor = () => {
    if (hasError) return BrandColors.error;
    if (isRunning) return BrandColors.success;
    return BrandColors.primaryLight;
  };

  const getIcon = (): keyof typeof Feather.glyphMap => {
    if (hasError) return "alert-triangle";
    if (isRunning) return "pause";
    return "play";
  };

  return (
    <View
      style={[
        styles.container,
        {
          bottom: effectiveTabBarHeight + Spacing.lg,
          right: insets.right + Spacing.lg,
        },
      ]}
    >
      {isRunning && !hasError ? (
        <Animated.View
          style={[
            styles.glow,
            { backgroundColor: BrandColors.success },
            animatedGlowStyle,
          ]}
        />
      ) : null}
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.button,
          { backgroundColor: getBackgroundColor() },
          Shadows.fab,
          animatedButtonStyle,
        ]}
      >
        <Feather name={getIcon()} size={28} color="#FFFFFF" />
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    width: Spacing.fabSize,
    height: Spacing.fabSize,
    borderRadius: Spacing.fabSize / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: Spacing.fabSize,
    height: Spacing.fabSize,
    borderRadius: Spacing.fabSize / 2,
  },
});
