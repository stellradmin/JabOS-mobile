// filepath: tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("nativewind/preset")],
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist-Regular', 'system-ui', 'sans-serif'], // Primary font
        'geist-thin': ['Geist-Thin'],
        'geist-extralight': ['Geist-ExtraLight'], // Corrected from ultralight
        'geist-light': ['Geist-Light'],
        'geist-regular': ['Geist-Regular'],
        'geist-medium': ['Geist-Medium'],
        'geist-semibold': ['Geist-SemiBold'],
        'geist-bold': ['Geist-Bold'],
        'geist-black': ['Geist-Black'],
        'geist-extrabold': ['Geist-ExtraBold'], // Corrected from ultrablack
        mono: ['SpaceMono', 'monospace'],
      },
    },
  },
  plugins: [],
};
