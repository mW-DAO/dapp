/**
 * Generates a deterministic HSL color string based on the input tag name.
 * Uses a string hashing algorithm to select a hue from 0-360.
 * Saturation is fixed at 70% and Lightness at 55% for consistency and readability.
 */
export const getColorFromTag = (tag: string): string => {
  const lowerTag = tag.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < lowerTag.length; i++) {
    hash = lowerTag.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Hue: 0-360, Saturation: 70%, Lightness: 55%
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 55%)`;
};
