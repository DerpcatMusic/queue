/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./convex/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        display: ["Sekuya-Regular"],
        heading: ["BarlowCondensed_700Bold"],
        body: ["Rubik_400Regular"],
        bodyMedium: ["Rubik_500Medium"],
        bodyStrong: ["Rubik_600SemiBold"],
      },
    },
  },
  plugins: [],
};
