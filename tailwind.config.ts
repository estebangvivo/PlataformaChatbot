import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#2A1233",
        pine: "#542460",
        moss: "#703C78",
        clay: "#8A3F98",
        sand: "#F4ECF7",
        paper: "#FBF8FC",
        mist: "#E8DCEC",
        line: "#D7C8DE",
      },
      fontFamily: {
        sans: ["var(--font-figtree)", "system-ui", "sans-serif"],
        serif: ["var(--font-source-serif)", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 18px 40px -28px rgba(42, 18, 51, 0.45)",
        panel: "0 1px 0 rgba(255,255,255,0.4) inset, 0 12px 32px -20px rgba(42,18,51,0.35)",
      },
      backgroundImage: {
        blueprint:
          "linear-gradient(rgba(42,18,51,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(42,18,51,0.045) 1px, transparent 1px)",
        facet:
          "linear-gradient(122deg, #5C2868 0%, #703C78 34%, #542460 62%, #6C307C 82%, #743884 100%)",
      },
      backgroundSize: {
        blueprint: "28px 28px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
