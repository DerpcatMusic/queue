import { memo, useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Canvas, Fill, Shader, Skia } from "@shopify/react-native-skia";
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type FrameInfo,
} from "react-native-reanimated";

const AURORA_SHADER = Skia.RuntimeEffect.Make(`
uniform float2 resolution;
uniform float time;
uniform float intensity;
uniform float2 waveDirection;
uniform float4 color1;
uniform float4 color2;
uniform float4 color3;
uniform float4 skyTop;
uniform float4 skyBottom;

float3 mod289(float3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
float2 mod289(float2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
float3 permute(float3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(float2 v) {
  const float4 C = float4(
    0.211324865405187,
    0.366025403784439,
    -0.577350269189626,
    0.024390243902439
  );
  float2 i = floor(v + dot(v, C.yy));
  float2 x0 = v - i + dot(i, C.xx);
  float2 i1 = x0.x > x0.y ? float2(1.0, 0.0) : float2(0.0, 1.0);
  float4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  float3 p = permute(permute(i.y + float3(0.0, i1.y, 1.0)) + i.x + float3(0.0, i1.x, 1.0));
  float3 m = max(0.5 - float3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  float3 x = 2.0 * fract(p * C.www) - 1.0;
  float3 h = abs(x) - 0.5;
  float3 ox = floor(x + 0.5);
  float3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  float3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float auroraBand(float2 uv, float seed, float amplitude, float thickness, float drift, float phase) {
  float x = uv.x * 1.45;
  float y = uv.y * 1.2;
  float driftTime = time * (0.34 + seed * 0.05);
  float base = 0.15 + seed * 0.055;
  float wave =
    base +
    sin(x * waveDirection.x * 0.072 + driftTime + phase) * amplitude +
    sin(x * waveDirection.y * 0.045 - driftTime * 0.8 + phase * 1.6) * amplitude * 0.48 +
    snoise(float2(x * 0.95 + seed * 4.6, y * 2.2 - driftTime * drift)) * 0.028;
  float band = smoothstep(thickness, 0.0, abs(uv.y - wave));
  return pow(band, 1.15);
}

half4 main(float2 fragCoord) {
  float2 uv = fragCoord / resolution;
  float3 base = mix(skyTop.rgb, skyBottom.rgb, smoothstep(0.0, 1.0, pow(uv.y, 1.16)));

  float horizontalFade = smoothstep(0.0, 0.05, uv.x) * smoothstep(0.0, 0.08, 1.0 - uv.x);
  float verticalFade = 1.0 - smoothstep(0.1, 0.76, uv.y);
  float radial = 1.0 - smoothstep(0.18, 0.94, distance(uv, float2(0.5, -0.02)));
  float envelope = horizontalFade * max(verticalFade, radial * 0.88);

  float band1 = auroraBand(uv, 0.0, 0.11, 0.28, 0.75, 0.0);
  float band2 = auroraBand(uv, 1.0, 0.095, 0.31, 0.88, 1.9);
  float band3 = auroraBand(uv, 2.0, 0.085, 0.34, 0.68, 3.8);

  float haze = 0.58 + 0.42 * snoise(float2(uv.x * 2.0 + time * 0.18, uv.y * 2.8 - time * 0.09));
  float glow = (band1 * 0.95 + band2 * 0.75 + band3 * 0.56) * envelope * haze;

  float3 aurora =
    color1.rgb * band1 * 0.62 +
    color2.rgb * band2 * 0.92 +
    color3.rgb * band3 * 0.54;
  aurora *= glow * intensity;

  float3 topGlow = mix(color2.rgb, color1.rgb, 0.4) * radial * 0.15;
  float3 finalColor = base + aurora + topGlow;
  finalColor = mix(finalColor, base, smoothstep(0.58, 1.0, uv.y));

  return half4(clamp(finalColor, 0.0, 1.0), 1.0);
}
`);

type AuroraBackgroundProps = {
  style?: StyleProp<ViewStyle>;
  width: number;
  height: number;
  auroraColors?: string[];
  skyColors?: [string, string];
  intensity?: number;
  speed?: number;
  waveDirection?: [number, number];
};

function hexToRgb(color: string): [number, number, number] {
  const normalized = color.trim().replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : normalized;

  const safe = value.padEnd(6, "0").slice(0, 6);
  return [
    Number.parseInt(safe.slice(0, 2), 16) / 255,
    Number.parseInt(safe.slice(2, 4), 16) / 255,
    Number.parseInt(safe.slice(4, 6), 16) / 255,
  ];
}

export const AuroraBackground = memo(function AuroraBackground({
  style,
  width,
  height,
  auroraColors = ["#315aa8", "#1f8fff", "#4f78d8"],
  skyColors = ["#122c56", "#04070d"],
  intensity = 0.78,
  speed = 0.72,
  waveDirection = [9, -9],
}: AuroraBackgroundProps) {
  const time = useSharedValue(0);

  useFrameCallback((frameInfo: FrameInfo) => {
    if (frameInfo.timeSincePreviousFrame != null) {
      time.value += (frameInfo.timeSincePreviousFrame / 1000) * speed;
    }
  });

  const color1 = useMemo(() => hexToRgb(auroraColors[0] ?? "#3fb6ff"), [auroraColors]);
  const color2 = useMemo(() => hexToRgb(auroraColors[1] ?? "#4c84ff"), [auroraColors]);
  const color3 = useMemo(() => hexToRgb(auroraColors[2] ?? "#7cf4d8"), [auroraColors]);
  const skyTop = useMemo(() => hexToRgb(skyColors[0]), [skyColors]);
  const skyBottom = useMemo(() => hexToRgb(skyColors[1]), [skyColors]);

  const uniforms = useDerivedValue(
    () => ({
      resolution: [width, height],
      time: time.value,
      intensity,
      waveDirection,
      color1: [...color1, 1],
      color2: [...color2, 1],
      color3: [...color3, 1],
      skyTop: [...skyTop, 1],
      skyBottom: [...skyBottom, 1],
    }),
    [color1, color2, color3, height, intensity, skyBottom, skyTop, waveDirection, width],
  );

  if (!AURORA_SHADER) {
    return null;
  }

  return (
    <View pointerEvents="none" style={[styles.container, style]}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Fill>
          <Shader source={AURORA_SHADER} uniforms={uniforms} />
        </Fill>
      </Canvas>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
});
