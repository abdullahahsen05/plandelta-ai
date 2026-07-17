const enabledValues = new Set(["1", "true", "yes"]);

export function resolveLiveProcessingEnabled(
  configured: string | undefined,
  production: boolean,
): boolean {
  if (configured === undefined) {
    return !production;
  }

  return enabledValues.has(configured.trim().toLowerCase());
}

export function isLiveProcessingEnabled(): boolean {
  return resolveLiveProcessingEnabled(
    process.env.NEXT_PUBLIC_LIVE_PROCESSING_ENABLED,
    process.env.NODE_ENV === "production",
  );
}
