import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#101312",
        surface: "#171b19",
        lime: "#c8f135",
        cream: "#f5f3ea",
      },
      boxShadow: {
        glow: "0 20px 80px rgba(200, 241, 53, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
