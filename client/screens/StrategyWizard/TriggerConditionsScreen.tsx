import React from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useWizard } from "./index";
import type { StrategyWizardParamList } from "@/navigation/StrategyWizardNavigator";

type NavigationProp = NativeStackNavigationProp<StrategyWizardParamList, "TriggerConditions">;

const triggerOptions = [
  {
    id: "price-touch-support",
    name: "Price Touches Support",
    description: "Enter when price reaches support level",
    icon: "arrow-down-circle" as const,
    category: "entry",
  },
  {
    id: "price-touch-resistance",
    name: "Price Touches Resistance",
    description: "Exit when price reaches resistance level",
    icon: "arrow-up-circle" as const,
    category: "exit",
  },
  {
    id: "rsi-oversold",
    name: "RSI Oversold",
    description: "Enter when RSI falls below 30",
    icon: "activity" as const,
    category: "entry",
  },
  {
    id: "rsi-overbought",
    name: "RSI Overbought",
    description: "Exit when RSI rises above 70",
    icon: "activity" as const,
    category: "exit",
  },
  {
    id: "volume-spike",
    name: "Volume Spike",
    description: "Confirm signals with unusual volume",
    icon: "bar-chart" as const,
    category: "confirmation",
  },
  {
    id: "news-sentiment",
    name: "News Sentiment",
    description: "Factor in recent news analysis",
    icon: "file-text" as const,
    category: "confirmation",
  },
];

export default function TriggerConditionsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { data, updateData } = useWizard();

  const toggleTrigger = (triggerId: string) => {
    const current = data.triggerConditions;
    if (current.includes(triggerId)) {
      updateData({ triggerConditions: current.filter((t) => t !== triggerId) });
    } else {
      updateData({ triggerConditions: [...current, triggerId] });
    }
  };

  const handleContinue = () => {
    if (data.strategyType === "moving-average-crossover") {
      navigation.navigate("MAConfiguration");
    } else {
      navigation.navigate("Configuration");
    }
  };

  const entryTriggers = triggerOptions.filter((t) => t.category === "entry");
  const exitTriggers = triggerOptions.filter((t) => t.category === "exit");
  const confirmationTriggers = triggerOptions.filter((t) => t.category === "confirmation");

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: Spacing.xl,
            paddingBottom: Spacing.xl,
          },
        ]}
      >
        <View style={styles.header}>
          <ThemedText style={styles.title}>Trigger Conditions</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Select the conditions that will trigger trades
          </ThemedText>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="log-in" size={18} color={BrandColors.success} />
            <ThemedText style={styles.sectionTitle}>Entry Triggers</ThemedText>
          </View>
          {entryTriggers.map((trigger) => (
            <TriggerCard
              key={trigger.id}
              trigger={trigger}
              selected={data.triggerConditions.includes(trigger.id)}
              onPress={() => toggleTrigger(trigger.id)}
            />
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="log-out" size={18} color={BrandColors.error} />
            <ThemedText style={styles.sectionTitle}>Exit Triggers</ThemedText>
          </View>
          {exitTriggers.map((trigger) => (
            <TriggerCard
              key={trigger.id}
              trigger={trigger}
              selected={data.triggerConditions.includes(trigger.id)}
              onPress={() => toggleTrigger(trigger.id)}
            />
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="check-square" size={18} color={BrandColors.primaryLight} />
            <ThemedText style={styles.sectionTitle}>Confirmation Signals</ThemedText>
          </View>
          {confirmationTriggers.map((trigger) => (
            <TriggerCard
              key={trigger.id}
              trigger={trigger}
              selected={data.triggerConditions.includes(trigger.id)}
              onPress={() => toggleTrigger(trigger.id)}
            />
          ))}
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.backgroundRoot,
            paddingBottom: insets.bottom + Spacing.lg,
          },
        ]}
      >
        <ThemedText style={[styles.selectedCount, { color: theme.textSecondary }]}>
          {data.triggerConditions.length} trigger{data.triggerConditions.length !== 1 ? "s" : ""} selected
        </ThemedText>
        <Button
          onPress={handleContinue}
          disabled={data.triggerConditions.length === 0}
          style={styles.continueButton}
        >
          Continue
        </Button>
      </View>
    </View>
  );
}

function TriggerCard({
  trigger,
  selected,
  onPress,
}: {
  trigger: { id: string; name: string; description: string; icon: keyof typeof Feather.glyphMap };
  selected: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.triggerCard,
        {
          backgroundColor: theme.backgroundDefault,
          borderColor: selected ? BrandColors.primaryLight : BrandColors.cardBorder,
          borderWidth: selected ? 2 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.triggerIcon,
          { backgroundColor: selected ? BrandColors.primaryLight + "20" : theme.backgroundSecondary },
        ]}
      >
        <Feather
          name={trigger.icon}
          size={20}
          color={selected ? BrandColors.primaryLight : theme.textSecondary}
        />
      </View>
      <View style={styles.triggerInfo}>
        <ThemedText style={styles.triggerName}>{trigger.name}</ThemedText>
        <ThemedText style={[styles.triggerDesc, { color: theme.textSecondary }]}>
          {trigger.description}
        </ThemedText>
      </View>
      <View
        style={[
          styles.checkbox,
          {
            backgroundColor: selected ? BrandColors.primaryLight : "transparent",
            borderColor: selected ? BrandColors.primaryLight : theme.textSecondary,
          },
        ]}
      >
        {selected ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h4,
  },
  triggerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  triggerIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  triggerInfo: {
    flex: 1,
  },
  triggerName: {
    ...Typography.body,
    fontWeight: "600",
    marginBottom: 2,
  },
  triggerDesc: {
    ...Typography.caption,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: BrandColors.cardBorder,
  },
  selectedCount: {
    ...Typography.caption,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  continueButton: {
    width: "100%",
  },
});
