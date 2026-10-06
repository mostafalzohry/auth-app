export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const ends =
    words.length > 1 ? [words[0], words[words.length - 1]] : [words[0]];
  return ends
    .map((word) => Array.from(word)[0])
    .join("")
    .toUpperCase();
}

export function formatMemberSince(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  });
}
