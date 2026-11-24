export function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) return null;
  const match = /^Bearer\\s+(\\S+)$/i.exec(authorizationHeader.trim());
  return match?.[1] ?? null;
}
