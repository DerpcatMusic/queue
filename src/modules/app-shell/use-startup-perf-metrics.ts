import { useEffect } from "react";

import { recordPerfMetric } from "@/lib/perf-telemetry";

type PerformanceWithRnStartupTiming = Performance & {
  rnStartupTiming?: {
    startTime?: number | undefined;
    executeJavaScriptBundleEntryPointStart?: number | undefined;
    endTime?: number | undefined;
  };
};

export function useStartupPerfMetrics() {
  useEffect(() => {
    const startupTiming = (performance as PerformanceWithRnStartupTiming).rnStartupTiming;
    if (!startupTiming) return;

    if (typeof startupTiming.endTime === "number" && typeof startupTiming.startTime === "number") {
      recordPerfMetric(
        "app.native_startup_runtime",
        startupTiming.endTime - startupTiming.startTime,
      );
    }
    if (
      typeof startupTiming.endTime === "number" &&
      typeof startupTiming.executeJavaScriptBundleEntryPointStart === "number"
    ) {
      recordPerfMetric(
        "app.native_startup_js_bundle",
        startupTiming.endTime - startupTiming.executeJavaScriptBundleEntryPointStart,
      );
    }
  }, []);
}
