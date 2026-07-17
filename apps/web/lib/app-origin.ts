const wildcardHosts = new Set(["0.0.0.0", "[::]"]);

export function getPublicAppOrigin(): string {
  const configured = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  if (!wildcardHosts.has(configured.hostname)) {
    return configured.origin;
  }

  const port = configured.port ? `:${configured.port}` : "";
  return `${configured.protocol}//localhost${port}`;
}
