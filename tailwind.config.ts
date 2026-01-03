import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        // Robinhood-style gradients
        "gradient-gain":
          "linear-gradient(135deg, hsl(var(--gain)) 0%, hsl(142 100% 30%) 100%)",
        "gradient-loss":
          "linear-gradient(135deg, hsl(var(--loss)) 0%, hsl(4 90% 40%) 100%)",
        "gradient-primary":
          "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(142 100% 30%) 100%)",
        "gradient-dark":
          "linear-gradient(180deg, hsl(0 0% 8%) 0%, hsl(0 0% 5%) 100%)",
        "gradient-glass":
          "linear-gradient(135deg, hsl(var(--card) / 0.8) 0%, hsl(var(--card) / 0.4) 100%)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        pill: "var(--radius-pill)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        // Trading semantic colors
        gain: "hsl(var(--gain))",
        loss: "hsl(var(--loss))",
        market: {
          open: "hsl(var(--market-open))",
          closed: "hsl(var(--market-closed))",
          extended: "hsl(var(--market-extended))",
        },
        // Robinhood brand colors
        robinhood: {
          green: "#00C805",
          red: "#FF5252",
          black: "#0D0D0D",
          dark: "#1A1A1A",
          gray: "#262626",
        },
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        // Robinhood-style animations
        "pulse-gain": {
          "0%, 100%": { color: "hsl(var(--gain))" },
          "50%": {
            color: "hsl(142 100% 60%)",
            textShadow: "0 0 12px hsl(142 100% 50% / 0.5)",
          },
        },
        "pulse-loss": {
          "0%, 100%": { color: "hsl(var(--loss))" },
          "50%": {
            color: "hsl(4 100% 70%)",
            textShadow: "0 0 12px hsl(4 100% 60% / 0.5)",
          },
        },
        glow: {
          "0%, 100%": { boxShadow: "0 0 5px hsl(var(--primary) / 0.3)" },
          "50%": {
            boxShadow:
              "0 0 20px hsl(var(--primary) / 0.5), 0 0 40px hsl(var(--primary) / 0.2)",
          },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-down": {
          from: { opacity: "0", transform: "translateY(-10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-in-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-in-bottom": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "bounce-in": {
          "0%": { opacity: "0", transform: "scale(0.3)" },
          "50%": { opacity: "1", transform: "scale(1.05)" },
          "70%": { transform: "scale(0.9)" },
          "100%": { transform: "scale(1)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "count-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        confetti: {
          "0%": { transform: "translateY(0) rotate(0deg)", opacity: "1" },
          "100%": {
            transform: "translateY(-500px) rotate(720deg)",
            opacity: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        // Robinhood-style animations
        "pulse-gain": "pulse-gain 2s ease-in-out infinite",
        "pulse-loss": "pulse-loss 2s ease-in-out infinite",
        glow: "glow 2s ease-in-out infinite",
        "fade-in-up": "fade-in-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-in-down":
          "fade-in-down 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "scale-in": "scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-in-right":
          "slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-in-left":
          "slide-in-left 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-in-bottom":
          "slide-in-bottom 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "bounce-in":
          "bounce-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        shimmer: "shimmer 2s infinite",
        "count-up": "count-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        confetti: "confetti 1s ease-out forwards",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        "in-out-expo": "cubic-bezier(0.87, 0, 0.13, 1)",
        bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      transitionDuration: {
        instant: "50ms",
        fast: "150ms",
        normal: "250ms",
        slow: "400ms",
        slower: "600ms",
      },
      boxShadow: {
        "glow-sm": "0 0 10px hsl(var(--primary) / 0.2)",
        "glow-md": "0 0 20px hsl(var(--primary) / 0.3)",
        "glow-lg": "0 0 40px hsl(var(--primary) / 0.4)",
        "glow-gain": "0 0 20px hsl(var(--gain) / 0.3)",
        "glow-loss": "0 0 20px hsl(var(--loss) / 0.3)",
        "card-hover": "0 8px 30px hsl(0 0% 0% / 0.12)",
        glass: "0 8px 32px hsl(0 0% 0% / 0.1)",
      },
      backdropBlur: {
        xs: "2px",
        glass: "16px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
