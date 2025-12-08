import { Platform } from "react-native";

const tintColorLight = "#3E92CC";
const tintColorDark = "#3E92CC";

export const BrandColors = {
  primary: "#0A2463",
  primaryLight: "#3E92CC",
  primaryDark: "#001E3C",
  success: "#10B981",
  error: "#EF4444",
  warning: "#F59E0B",
  neutral: "#6B7280",
  cryptoLayer: "#F7931A",
  stockLayer: "#0A2463",
  aiLayer: "#8B5CF6",
  profitBackground: "#D1FAE5",
  lossBackground: "#FEE2E2",
  cardBorder: "#E5E7EB",
  gridLine: "#E5E7EB",
};

export const Colors = {
  light: {
    text: "#11181C",
    textSecondary: "#6B7280",
    buttonText: "#FFFFFF",
    tabIconDefault: "#6B7280",
    tabIconSelected: tintColorLight,
    link: "#3E92CC",
    backgroundRoot: "#F9FAFB",
    backgroundDefault: "#FFFFFF",
    backgroundSecondary: "#F2F2F2",
    backgroundTertiary: "#E6E6E6",
    ...BrandColors,
  },
  dark: {
    text: "#ECEDEE",
    textSecondary: "#9BA1A6",
    buttonText: "#FFFFFF",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: tintColorDark,
    link: "#3E92CC",
    backgroundRoot: "#0A1929",
    backgroundDefault: "#132F4C",
    backgroundSecondary: "#1E3A5F",
    backgroundTertiary: "#294A6E",
    ...BrandColors,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  inputHeight: 48,
  buttonHeight: 52,
  fabSize: 64,
  minTouchTarget: 44,
  listItemHeight: 56,
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
  "2xl": 40,
  "3xl": 50,
  full: 9999,
  card: 12,
};

export const Typography = {
  h1: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "600" as const,
  },
  h3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400" as const,
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  monospace: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500" as const,
  },
  largeNumber: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700" as const,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const Shadows = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  fab: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 4,
  },
};

export function getDataQualityColor(score: number): string {
  if (score < 0.3) return BrandColors.error;
  if (score < 0.7) return BrandColors.warning;
  return BrandColors.success;
}
