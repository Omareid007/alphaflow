import { useState } from "react";
import { View, StyleSheet, TextInput, ActivityIndicator, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";

interface SignupScreenProps {
  onSwitchToLogin: () => void;
}

export default function SignupScreen({ onSwitchToLogin }: SignupScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { signup, signupError, isSigningUp } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSignup = async () => {
    if (!username.trim() || !password || password !== confirmPassword) return;
    try {
      await signup(username.trim(), password);
    } catch {
    }
  };

  const isValid = username.trim().length >= 3 && password.length >= 6 && password === confirmPassword;
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + Spacing["3xl"],
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: BrandColors.primaryLight + "20" }]}>
          <Feather name="trending-up" size={40} color={BrandColors.primaryLight} />
        </View>
        <ThemedText style={styles.title}>Create Account</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          Start trading with AI-powered strategies
        </ThemedText>
      </View>

      <Card elevation={1} style={styles.formCard}>
        <View style={styles.inputGroup}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Username</ThemedText>
          <View style={[styles.inputWrapper, { borderColor: theme.textSecondary + "40" }]}>
            <Feather name="user" size={20} color={theme.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Choose a username"
              placeholderTextColor={theme.textSecondary}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {username.length > 0 && username.trim().length < 3 ? (
            <ThemedText style={[styles.hint, { color: BrandColors.warning }]}>
              Username must be at least 3 characters
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Password</ThemedText>
          <View style={[styles.inputWrapper, { borderColor: theme.textSecondary + "40" }]}>
            <Feather name="lock" size={20} color={theme.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Create a password"
              placeholderTextColor={theme.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
              <Feather name={showPassword ? "eye-off" : "eye"} size={20} color={theme.textSecondary} />
            </Pressable>
          </View>
          {password.length > 0 && password.length < 6 ? (
            <ThemedText style={[styles.hint, { color: BrandColors.warning }]}>
              Password must be at least 6 characters
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Confirm Password</ThemedText>
          <View style={[
            styles.inputWrapper, 
            { borderColor: passwordMismatch ? BrandColors.error : theme.textSecondary + "40" }
          ]}>
            <Feather name="lock" size={20} color={theme.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Confirm your password"
              placeholderTextColor={theme.textSecondary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {passwordMismatch ? (
            <ThemedText style={[styles.hint, { color: BrandColors.error }]}>
              Passwords do not match
            </ThemedText>
          ) : null}
        </View>

        {signupError ? (
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={16} color={BrandColors.error} />
            <ThemedText style={[styles.errorText, { color: BrandColors.error }]}>{signupError}</ThemedText>
          </View>
        ) : null}

        <Pressable
          style={[
            styles.button,
            { backgroundColor: isValid ? BrandColors.primaryLight : theme.textSecondary + "40" },
          ]}
          onPress={handleSignup}
          disabled={!isValid || isSigningUp}
        >
          {isSigningUp ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <ThemedText style={styles.buttonText}>Create Account</ThemedText>
          )}
        </Pressable>
      </Card>

      <View style={styles.footer}>
        <ThemedText style={[styles.footerText, { color: theme.textSecondary }]}>
          Already have an account?
        </ThemedText>
        <Pressable onPress={onSwitchToLogin}>
          <ThemedText style={[styles.linkText, { color: BrandColors.primaryLight }]}>Sign In</ThemedText>
        </Pressable>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h1,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    textAlign: "center",
  },
  formCard: {
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
    gap: Spacing.lg,
  },
  inputGroup: {
    gap: Spacing.sm,
  },
  label: {
    ...Typography.small,
    fontWeight: "500",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    height: Spacing.inputHeight,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    ...Typography.body,
    height: "100%",
  },
  eyeButton: {
    padding: Spacing.xs,
  },
  hint: {
    ...Typography.small,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: BrandColors.lossBackground,
    borderRadius: BorderRadius.sm,
  },
  errorText: {
    ...Typography.small,
    flex: 1,
  },
  button: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.sm,
  },
  buttonText: {
    ...Typography.body,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  footerText: {
    ...Typography.body,
  },
  linkText: {
    ...Typography.body,
    fontWeight: "600",
  },
});
