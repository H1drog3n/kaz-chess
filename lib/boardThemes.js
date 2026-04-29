export const BOARD_THEMES = {
  classic: { name: "Classic", light: "#f0d9b5", dark: "#b58863" },
  blue: { name: "Blue", light: "#e7f0ff", dark: "#4a76a8" },
  green: { name: "Green", light: "#eeffe7", dark: "#3e7c59" },
  walnut: { name: "Walnut", light: "#f2e6d8", dark: "#7a4e2d" },
};

export function coerceBoardTheme(key) {
  return BOARD_THEMES[key] ? key : "classic";
}

