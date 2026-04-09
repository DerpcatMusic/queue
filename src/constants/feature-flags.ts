function readBooleanFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }
  return defaultValue;
}

export const FEATURE_FLAGS = {
  mapPerfTelemetry: readBooleanFlag(process.env.EXPO_PUBLIC_ENABLE_MAP_PERF_TELEMETRY, false),
  jobsPerfTelemetry: readBooleanFlag(process.env.EXPO_PUBLIC_ENABLE_JOBS_PERF_TELEMETRY, false),
  stripeTestMode: readBooleanFlag(process.env.EXPO_PUBLIC_STRIPE_TEST_MODE, true),
  stripeConnectEmbeddedPreviewEnabled: readBooleanFlag(
    process.env.EXPO_PUBLIC_STRIPE_CONNECT_EMBEDDED_PREVIEW,
    false,
  ),
  generatedThemeEnabled: readBooleanFlag(process.env.EXPO_PUBLIC_THEME_GENERATED_ENABLED, true),
  generatedThemeAliasStrictMode: readBooleanFlag(
    process.env.EXPO_PUBLIC_THEME_ALIAS_STRICT_MODE,
    false,
  ),
} as const;
