/** @type {import('tailwindcss').Config} */
// Design system (from UI/UX Pro Max, "Minimalism & Swiss Style"):
// - Primary teal #0D9488, secondary #14B8A6, accent/CTA orange #EA580C
// - Background #F0FDFA, card white, foreground deep teal #134E4A,
//   muted foreground slate #475569, destructive #DC2626, ring = primary
// - Typography: Fira Sans (UI) + Fira Code (codes, numbers, data)
// - Dense dashboard spacing, subtle 200ms hover transitions, visible focus
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#0D9488", dark: "#0F766E", light: "#14B8A6" },
        accent: { DEFAULT: "#EA580C", dark: "#C2410C" },
        ink: "#134E4A",
        muted: "#475569",
        appbg: "#F0FDFA",
        line: "#CCFBF1",
      },
      fontFamily: {
        sans: ["'Fira Sans'", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'Fira Code'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(19, 78, 74, 0.06)",
      },
    },
  },
  plugins: [],
};
