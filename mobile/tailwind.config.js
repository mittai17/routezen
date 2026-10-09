/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: { green: "#0E4429", "green-light": "#1B6B3F", yellow: "#F4C430", "yellow-dark": "#D9A61E" },
        surface: "#FFFFFF", muted: "#F4F6F3", border: "#E4E8E1",
        ink: "#0E1A14", "ink-muted": "#5B6B60",
        success: "#1B6B3F", warning: "#B3791A", danger: "#B3261E", info: "#1D5FB3",
      },
      borderRadius: { card: "18px", pill: "999px" },
    },
  },
  plugins: [],
};
