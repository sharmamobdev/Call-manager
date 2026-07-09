/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#e6f4f8",
          100: "#cce9f2",
          200: "#99d3e5",
          300: "#66bdd8",
          400: "#33a7cb",
          500: "#1985A1",
          600: "#146a81",
          700: "#0f5061",
          800: "#0a3540",
          900: "#051b20",
        },
      },
    },
  },
  plugins: [],
};
