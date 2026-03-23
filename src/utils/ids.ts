export function newSessionId(): string {
  return `sess-${crypto.randomUUID()}`;
}
