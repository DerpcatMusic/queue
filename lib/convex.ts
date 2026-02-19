import { ConvexReactClient } from "convex/react";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
let convexClient: ConvexReactClient | null = null;

export function getConvexClient(): ConvexReactClient | null {
  if (!convexUrl) {
    return null;
  }

  if (!convexClient) {
    convexClient = new ConvexReactClient(convexUrl);
  }

  return convexClient;
}

export const isConvexUrlConfigured = Boolean(convexUrl);
