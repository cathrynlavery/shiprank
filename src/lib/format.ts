export function formatLines(value: number) {
  return value.toLocaleString("en-US");
}

export function signedLines(value: number) {
  return value > 0 ? `+${formatLines(value)}` : "0";
}
