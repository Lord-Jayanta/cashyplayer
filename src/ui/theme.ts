/**
 * Design tokens. Dark-first: an audio player is used in low light.
 * Colors are plain hex rather than PlatformColor so the pill bar can be
 * styled identically on both platforms.
 */
export const colors = {
  bg: "#0B0B0F",
  surface: "#16161C",
  surfaceRaised: "#1E1E26",
  accent: "#7C5CFF",
  accentMuted: "#2A2440",
  text: "#F5F5F7",
  textMuted: "#8E8E98",
  border: "#26262F",
  danger: "#FF5A5A",
} as const;

export const radius = {
  pill: 999,
  card: 18,
  art: 12,
} as const;

export const space = (n: number) => n * 4;