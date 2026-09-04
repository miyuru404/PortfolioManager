import type { Theme } from "@/types";

export const themes: Record<Theme, Record<string, string>> = {
  // "Revamp" palette: warm paper gray, flat hairline-divided surfaces, one
  // confident green accent. Ported from the Ceylon Capital Revamp design.
  light: {
    "--surface":        "243 242 242",
    "--surface-raised": "243 242 242",
    "--surface-border": "210 207 207",
    "--ink":            "32 30 29",
    "--ink-muted":      "110 107 107",
    "--ink-faint":      "160 156 156",
    "--brand-50":       "234 250 241",
    "--brand-100":      "201 240 220",
    "--brand-400":      "18 165 111",
    "--brand-500":      "13 138 92",
    "--brand-600":      "7 107 71",
  },
  dark: {
    "--surface":        "20 20 20",
    "--surface-raised": "20 20 20",
    "--surface-border": "55 55 55",
    "--ink":            "240 240 238",
    "--ink-muted":      "165 163 163",
    "--ink-faint":      "110 108 108",
    "--brand-50":       "15 46 34",
    "--brand-100":      "20 70 50",
    "--brand-400":      "40 195 135",
    "--brand-500":      "75 218 160",
    "--brand-600":      "125 235 190",
  },
  midnight: {
    "--surface":        "8 10 22",
    "--surface-raised": "14 16 35",
    "--surface-border": "35 38 68",
    "--ink":            "220 225 255",
    "--ink-muted":      "130 138 190",
    "--ink-faint":      "60 65 100",
    "--brand-50":       "20 22 60",
    "--brand-100":      "40 45 110",
    "--brand-400":      "100 120 240",
    "--brand-500":      "140 158 255",
    "--brand-600":      "185 195 255",
  },
  darkgreen: {
    "--surface":        "6 14 10",
    "--surface-raised": "10 22 15",
    "--surface-border": "25 50 35",
    "--ink":            "200 240 215",
    "--ink-muted":      "100 165 125",
    "--ink-faint":      "45 75 55",
    "--brand-50":       "12 35 20",
    "--brand-100":      "20 65 38",
    "--brand-400":      "34 180 90",
    "--brand-500":      "60 210 115",
    "--brand-600":      "100 235 150",
  },
};

export function applyTheme(theme: Theme) {
  const vars = themes[theme];
  const root = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  if (theme === "light") {
    root.classList.remove("dark");
  } else {
    root.classList.add("dark");
  }
}
