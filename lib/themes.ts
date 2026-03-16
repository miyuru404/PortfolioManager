import type { Theme } from "@/types";

export const themes: Record<Theme, Record<string, string>> = {
  light: {
    "--surface":        "248 248 246",
    "--surface-raised": "255 255 255",
    "--surface-border": "220 218 212",
    "--ink":            "30 28 26",
    "--ink-muted":      "100 97 92",
    "--ink-faint":      "165 162 156",
    "--brand-50":       "236 252 244",
    "--brand-100":      "158 225 203",
    "--brand-400":      "29 158 117",
    "--brand-500":      "15 110 86",
    "--brand-600":      "8 80 65",
  },
  dark: {
    "--surface":        "18 18 20",
    "--surface-raised": "28 28 32",
    "--surface-border": "50 48 55",
    "--ink":            "235 233 228",
    "--ink-muted":      "155 152 148",
    "--ink-faint":      "80 78 75",
    "--brand-50":       "15 50 38",
    "--brand-100":      "20 80 60",
    "--brand-400":      "29 158 117",
    "--brand-500":      "77 195 155",
    "--brand-600":      "130 220 185",
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
