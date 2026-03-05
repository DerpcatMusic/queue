export function alphaColor(color: unknown, alpha: number, fallback: string) {
  if (typeof color !== "string") return fallback;
  if (!color.startsWith("#")) return fallback;
  const hex = color.slice(1);
  if (hex.length !== 6) return fallback;

  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);

  if ([red, green, blue].some((value) => Number.isNaN(value))) {
    return fallback;
  }
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
