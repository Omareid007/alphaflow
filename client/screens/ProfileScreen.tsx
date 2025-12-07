import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useState } from "react";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch {
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
        gap: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <Card elevation={1} style={styles.profileCard}>
        <View style={[styles.avatar, { backgroundColor: BrandColors.primaryLight + "20" }]}>
          <Feather name="user" size={40} color={BrandColors.primaryLight} />
        </View>
        <ThemedText style={styles.username}>{user?.username ?? "User"}</ThemedText>
        <ThemedText style={[styles.userId, { color: theme.textSecondary }]}>
          Paper Trading Account
        </ThemedText>
      </Card>

      <Card elevation={1} style={styles.settingsCard}>
        <View style={styles.settingsHeader}>
          <Feather name="settings" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.settingsTitle}>Account Settings</ThemedText>
        </View>
        
        <View style={[styles.settingItem, { borderBottomColor: theme.textSecondary + "20" }]}>
          <Feather name="bell" size={20} color={theme.textSecondary} />
          <ThemedText style={styles.settingText}>Notifications</ThemedText>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </View>

        <View style={[styles.settingItem, { borderBottomColor: theme.textSecondary + "20" }]}>
          <Feather name="shield" size={20} color={theme.textSecondary} />
          <ThemedText style={styles.settingText}>Security</ThemedText>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </View>

        <View style={styles.settingItem}>
          <Feather name="help-circle" size={20} color={theme.textSecondary} />
          <ThemedText style={styles.settingText}>Help & Support</ThemedText>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </View>
      </Card>

      <Pressable
        style={[styles.logoutButton, { backgroundColor: BrandColors.error + "15" }]}
        onPress={handleLogout}
        disabled={isLoggingOut}
      >
        {isLoggingOut ? (
          <ActivityIndicator size="small" color={BrandColors.error} />
        ) : (
          <>
            <Feather name="log-out" size={20} color={BrandColors.error} />
            <ThemedText style={[styles.logoutText, { color: BrandColors.error }]}>Sign Out</ThemedText>
          </>
        )}
      </Pressable>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  username: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
  },
  userId: {
    ...Typography.caption,
  },
  settingsCard: {
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  settingsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  settingsTitle: {
    ...Typography.h4,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.md,
  },
  settingText: {
    ...Typography.body,
    flex: 1,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
  },
  logoutText: {
    ...Typography.body,
    fontWeight: "600",
  },
});
