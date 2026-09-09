import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9eaff",
          200: "#b9d6ff",
          300: "#8ab9f5",
          400: "#4a8ee6",
          500: "#1e6fdc",
          600: "#1759b8",
          700: "#114690",
          800: "#0d3873",
          900: "#0a2c5e",
        },
        accent: { 500: "#ff6a3d" },
      },
      fontFamily: {
        sans: ["Pretendard", "system-ui", "sans-serif"],
      },
      maxWidth: { container: "1200px" },
    },
  },
  plugins: [],
};
export default config;
