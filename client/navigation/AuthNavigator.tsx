import { useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";

import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { BrandColors } from "@/constants/theme";
import LoginScreen from "@/screens/LoginScreen";
import SignupScreen from "@/screens/SignupScreen";

type AuthScreen = "login" | "signup";

export default function AuthNavigator() {
  const { theme } = useTheme();
  const { isLoading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<AuthScreen>("login");

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={BrandColors.primaryLight} />
      </View>
    );
  }

  if (currentScreen === "login") {
    return <LoginScreen onSwitchToSignup={() => setCurrentScreen("signup")} />;
  }

  return <SignupScreen onSwitchToLogin={() => setCurrentScreen("login")} />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
