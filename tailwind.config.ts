import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#13201D",
        pine: "#18463F",
        moss: "#2C6B5E",
        clay: "#C45C26",
        sand: "#F3EDE3",
        paper: "#FAF7F2",
        mist: "#E4DDD1",
        line: "#D5CBBA",
      },
      fontFamily: {
        sans: ["var(--font-figtree)", "system-ui", "sans-serif"],
        serif: ["var(--font-source-serif)", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 18px 40px -28px rgba(19, 32, 29, 0.45)",
        panel: "0 1px 0 rgba(255,255,255,0.4) inset, 0 12px 32px -20px rgba(19,32,29,0.35)",
      },
      backgroundImage: {
        blueprint:
          "linear-gradient(rgba(19,32,29,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(19,32,29,0.035) 1px, transparent 1px)",
      },
      backgroundSize: {
        blueprint: "28px 28px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
