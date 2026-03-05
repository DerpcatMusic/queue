import Constants from "expo-constants";
import { type ComponentType, createElement, memo } from "react";
import { Platform } from "react-native";

import type { QueueMapProps } from "./queue-map.types";

let resolvedImpl: ComponentType<QueueMapProps> | null | undefined;

function resolveImpl(): ComponentType<QueueMapProps> | null {
  if (resolvedImpl !== undefined) {
    return resolvedImpl;
  }

  if (Platform.OS === "web") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const web = require("./queue-map.web") as {
      QueueMap: ComponentType<QueueMapProps>;
    };
    resolvedImpl = web.QueueMap;
    return resolvedImpl;
  }

  if (Constants.appOwnership === "expo") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const web = require("./queue-map.web") as {
      QueueMap: ComponentType<QueueMapProps>;
    };
    resolvedImpl = web.QueueMap;
    return resolvedImpl;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const native = require("./queue-map.native") as {
      QueueMap: ComponentType<QueueMapProps>;
    };
    resolvedImpl = native.QueueMap;
    return resolvedImpl;
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const web = require("./queue-map.web") as {
      QueueMap: ComponentType<QueueMapProps>;
    };
    resolvedImpl = web.QueueMap;
    return resolvedImpl;
  }
}

function QueueMapImpl(props: QueueMapProps) {
  const Impl = resolveImpl();
  if (!Impl) return null;
  return createElement(Impl, props);
}

export const QueueMap = memo(QueueMapImpl);
