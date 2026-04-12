import Constants from "expo-constants";
import Mapbox from "@rnmapbox/maps";
import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { View } from "react-native";

const mapboxPublicToken =
  (process.env.EXPO_PUBLIC_MAPBOX_TOKEN as string | undefined) ??
  (process.env.MAPBOX_PUBLIC_TOKEN as string | undefined) ??
  (process.env.MAPBOX_TOKEN as string | undefined) ??
  (Constants.expoConfig?.extra?.mapboxPublicToken as string | undefined) ??
  (Constants.manifest2?.extra?.expoClient?.extra?.mapboxPublicToken as string | undefined) ??
  (Constants.expoConfig?.extra?.EXPO_PUBLIC_MAPBOX_TOKEN as string | undefined) ??
  null;

if (mapboxPublicToken) {
  void Mapbox.setAccessToken(mapboxPublicToken);
}

type GenericLayerProps = {
  id: string;
  filter?: unknown;
  minzoom?: number;
  maxzoom?: number;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  sourceLayer?: string;
  sourceID?: string;
  sourceLayerID?: string;
  aboveLayerID?: string;
  belowLayerID?: string;
  layerIndex?: number;
  children?: React.ReactNode;
};

type MapViewProps = Omit<
  React.ComponentProps<typeof Mapbox.MapView>,
  | "contentInset"
  | "styleURL"
  | "styleJSON"
  | "zoomEnabled"
  | "scrollEnabled"
  | "rotateEnabled"
  | "pitchEnabled"
  | "compassEnabled"
  | "logoEnabled"
  | "attributionEnabled"
  | "onMapLoadingError"
> & {
  children?: React.ReactNode;
  mapStyle?: object | string;
  contentInset?: number | number[] | Record<string, number>;
  dragPan?: boolean;
  touchAndDoubleTapZoom?: boolean;
  touchRotate?: boolean;
  touchPitch?: boolean;
  compass?: boolean;
  logo?: boolean;
  attribution?: boolean;
  onDidFailLoadingMap?: () => void;
  onMapLoadingError?: () => void;
};

export type MapRef = {
  getBounds: () => Promise<[number, number, number, number]>;
  getZoom: () => Promise<number>;
  showAttribution: () => void;
};

type CameraProps = {
  minZoom?: number;
  maxZoom?: number;
  maxBounds?: [number, number, number, number];
  initialViewState?: {
    center: [number, number];
    zoom: number;
  };
};

export type CameraRef = {
  fitBounds: (
    bounds: [number, number, number, number],
    options?: {
      padding?: { top: number; right: number; bottom: number; left: number };
      duration?: number;
      easing?: string;
    },
  ) => void;
  flyTo: (coordinates: [number, number], animationDuration?: number) => void;
  zoomTo: (zoomLevel: number, animationDuration?: number) => void;
};

type GeoJSONSourceProps = {
  id: string;
  data: GeoJSON.FeatureCollection | GeoJSON.Feature | GeoJSON.Geometry;
  onPress?: (event: unknown) => void;
  children?: React.ReactNode;
};

type VectorSourceProps = {
  id: string;
  url?: string;
  tiles?: string[];
  tileUrlTemplates?: string[];
  onPress?: (event: unknown) => void;
  children?: React.ReactNode;
};

type MarkerProps = {
  id: string;
  lngLat: [number, number];
  anchor?: "top-left" | "center" | "bottom";
  offset?: [number, number];
  children: React.ReactElement;
};

function toCamelCase(input: string) {
  return input.replace(/-([a-z])/g, (_, character: string) => character.toUpperCase());
}

function normalizeStyleObject(
  style: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!style) return undefined;
  return Object.fromEntries(Object.entries(style).map(([key, value]) => [toCamelCase(key), value]));
}

function toLayerStyle(
  paint: Record<string, unknown> | undefined,
  layout: Record<string, unknown> | undefined,
) {
  return {
    ...(normalizeStyleObject(layout) ?? {}),
    ...(normalizeStyleObject(paint) ?? {}),
  };
}

function toAnchor(anchor: MarkerProps["anchor"]) {
  switch (anchor) {
    case "top-left":
      return { x: 0, y: 0 };
    case "bottom":
      return { x: 0.5, y: 1 };
    default:
      return { x: 0.5, y: 0.5 };
  }
}

const MarkerOffsetWrapper = ({
  offset,
  children,
}: {
  offset?: [number, number];
  children: React.ReactElement;
}) => {
  if (!offset) return <>{children}</>;

  return (
    <View
      pointerEvents="box-none"
      style={{
        transform: [{ translateX: offset[0] }, { translateY: offset[1] }],
      }}
    >
      {children}
    </View>
  );
};

function createTypedLayer<TProps extends GenericLayerProps>(
  Component: React.ComponentType<TProps>,
) {
  return function TypedLayer({
    paint,
    layout,
    minzoom,
    maxzoom,
    sourceLayer,
    children,
    ...rest
  }: GenericLayerProps) {
    const style = useMemo(() => toLayerStyle(paint, layout), [layout, paint]);
    return (
      <Component
        {...(rest as unknown as TProps)}
        {...(sourceLayer ? ({ sourceLayerID: sourceLayer } as unknown as Partial<TProps>) : {})}
        {...(typeof minzoom === "number"
          ? ({ minZoomLevel: minzoom } as unknown as Partial<TProps>)
          : {})}
        {...(typeof maxzoom === "number"
          ? ({ maxZoomLevel: maxzoom } as unknown as Partial<TProps>)
          : {})}
        {...({ style } as unknown as Partial<TProps>)}
      >
        {children}
      </Component>
    );
  };
}

export const MapView = forwardRef<MapRef, MapViewProps>(function NativeMapView(
  {
    mapStyle,
    contentInset,
    dragPan,
    touchAndDoubleTapZoom,
    touchRotate,
    touchPitch,
    compass,
    logo,
    attribution,
    onDidFailLoadingMap,
    onMapLoadingError,
    ...rest
  },
  ref,
) {
  const innerRef = useRef<Mapbox.MapView>(null);
  useImperativeHandle(ref, () => ({
    async getBounds() {
      const visibleBounds = await innerRef.current?.getVisibleBounds();
      if (!visibleBounds) return [0, 0, 0, 0];
      const [ne, sw] = visibleBounds;
      return [sw[0], sw[1], ne[0], ne[1]];
    },
    async getZoom() {
      return (await innerRef.current?.getZoom()) ?? 0;
    },
    showAttribution() {},
  }));

  const styleProps =
    typeof mapStyle === "string"
      ? mapStyle.startsWith("{")
        ? { styleJSON: mapStyle }
        : { styleURL: mapStyle }
      : mapStyle instanceof URL
        ? { styleURL: mapStyle.toString() }
        : mapStyle
          ? { styleJSON: JSON.stringify(mapStyle) }
          : undefined;

  return (
    <Mapbox.MapView
      ref={innerRef}
      {...rest}
      {...styleProps}
      {...(typeof contentInset === "number" || Array.isArray(contentInset) ? { contentInset } : {})}
      scrollEnabled={dragPan}
      zoomEnabled={touchAndDoubleTapZoom}
      rotateEnabled={touchRotate}
      pitchEnabled={touchPitch}
      compassEnabled={compass}
      scaleBarEnabled={false}
      logoEnabled={logo}
      attributionEnabled={attribution}
      gestureSettings={
        touchAndDoubleTapZoom === undefined
          ? undefined
          : {
              doubleTapToZoomInEnabled: touchAndDoubleTapZoom,
            }
      }
      onMapLoadingError={() => {
        onMapLoadingError?.();
        onDidFailLoadingMap?.();
      }}
    />
  );
});

export const Camera = forwardRef<CameraRef, CameraProps>(function NativeCamera(
  { minZoom, maxZoom, maxBounds, initialViewState },
  ref,
) {
  const innerRef = useRef<Mapbox.Camera>(null);
  useImperativeHandle(ref, () => ({
    fitBounds(bounds, options) {
      const padding = options?.padding;
      innerRef.current?.fitBounds(
        [bounds[2], bounds[3]],
        [bounds[0], bounds[1]],
        padding ? [padding.top, padding.right, padding.bottom, padding.left] : undefined,
        options?.duration,
      );
    },
    flyTo(coordinates, animationDuration) {
      innerRef.current?.flyTo(coordinates, animationDuration);
    },
    zoomTo(zoomLevel, animationDuration) {
      innerRef.current?.zoomTo(zoomLevel, animationDuration);
    },
  }));

  return (
    <Mapbox.Camera
      ref={innerRef}
      {...(typeof minZoom === "number" ? { minZoomLevel: minZoom } : {})}
      {...(typeof maxZoom === "number" ? { maxZoomLevel: maxZoom } : {})}
      {...(maxBounds
        ? {
            maxBounds: {
              sw: [maxBounds[0], maxBounds[1]],
              ne: [maxBounds[2], maxBounds[3]],
            },
          }
        : {})}
      {...(initialViewState
        ? {
            defaultSettings: {
              centerCoordinate: initialViewState.center,
              zoomLevel: initialViewState.zoom,
            },
          }
        : {})}
    />
  );
});

export function GeoJSONSource({ id, data, onPress, children }: GeoJSONSourceProps) {
  return (
    <Mapbox.ShapeSource
      id={id}
      shape={data}
      onPress={onPress as any}
      hitbox={{ width: 28, height: 28 }}
    >
      {children as any}
    </Mapbox.ShapeSource>
  );
}

export const Images = Mapbox.Images;
export const Image = Mapbox.Image;
export const PointAnnotation = Mapbox.PointAnnotation;
export function VectorSource({
  id,
  url,
  tiles,
  tileUrlTemplates,
  onPress,
  children,
}: VectorSourceProps) {
  return (
    <Mapbox.VectorSource
      id={id}
      {...(url ? { url } : {})}
      {...(tiles || tileUrlTemplates ? { tileUrlTemplates: tileUrlTemplates ?? tiles } : {})}
      onPress={onPress as any}
      hitbox={{ width: 28, height: 28 }}
    >
      {children as any}
    </Mapbox.VectorSource>
  );
}

export function Marker({ lngLat, anchor, offset, children }: MarkerProps) {
  return (
    <Mapbox.MarkerView coordinate={lngLat} anchor={toAnchor(anchor)} allowOverlap>
      <MarkerOffsetWrapper {...(offset ? { offset } : {})}>{children}</MarkerOffsetWrapper>
    </Mapbox.MarkerView>
  );
}

export const OfflineManager = Mapbox.offlineManager;
export const StyleURL = Mapbox.StyleURL;
export const StyleImport = Mapbox.StyleImport;
export const FillLayer = createTypedLayer(Mapbox.FillLayer);
export const LineLayer = createTypedLayer(Mapbox.LineLayer);
export const SymbolLayer = createTypedLayer(
  Mapbox.SymbolLayer as unknown as React.ComponentType<GenericLayerProps>,
);
export const CircleLayer = createTypedLayer(Mapbox.CircleLayer);

export function LayerGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
