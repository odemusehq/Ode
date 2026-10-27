let counter = 0;

/** A new id for things the UI creates, such as lyric lines and sections. */
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}`;
}
