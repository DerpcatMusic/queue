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

// Blob of light at top - creates bright spot that fades downward
float topBlob(float2 uv, float time) {
  // Multiple drifting bright spots
  float blob1 = snoise(float2(uv.x * 3.0 + sin(time * 0.3) * 0.5, time * 0.2)) * 0.5 + 0.5;
  float blob2 = snoise(float2(uv.x * 2.0 + cos(time * 0.25) * 0.3, time * 0.15 + 1.5)) * 0.5 + 0.5;
  float blob3 = snoise(float2(uv.x * 4.0 + sin(time * 0.4) * 0.2, time * 0.1 + 3.0)) * 0.5 + 0.5;
  
  // Combine blobs
  float combined = blob1 * 0.4 + blob2 * 0.35 + blob3 * 0.25;
  
  // Vertical falloff - bright at top, fades going down
  float verticalFall = pow(max(1.0 - uv.y * 1.1, 0.0), 1.5);
  
  // Horizontal spread
  float horizontal = exp(-pow((uv.x - 0.5) * 2.5, 2.0));
  
  return combined * verticalFall * horizontal * 1.8;
}

float auroraBand(float2 uv, float seed, float amplitude, float thickness, float drift, float phase, float speed) {
  float x = uv.x * 1.6;
  float y = uv.y;
  float driftTime = time * speed;
  float base = 0.12 + seed * 0.04;
  float wave =
    base +
    sin(x * waveDirection.x * 0.08 + driftTime + phase) * amplitude +
    sin(x * waveDirection.y * 0.05 - driftTime * 0.6 + phase * 1.4) * amplitude * 0.55 +
    snoise(float2(x * 1.1 + seed * 3.2, y * 1.8 - driftTime * drift * 0.5)) * 0.035 +
    snoise(float2(x * 2.5 + seed * 5.0, y * 0.8 + driftTime * 0.3)) * 0.02;
  float band = smoothstep(thickness, 0.0, abs(uv.y - wave));
  return pow(band, 1.1);
}

// Extra noise layer for color variation
float colorNoise(float2 uv, float time) {
  float n1 = snoise(float2(uv.x * 3.0 + time * 0.1, uv.y * 4.0)) * 0.5 + 0.5;
  float n2 = snoise(float2(uv.x * 5.0 - time * 0.15, uv.y * 3.0 + time * 0.05)) * 0.5 + 0.5;
  return n1 * n2;
}

half4 main(float2 fragCoord) {
  float2 uv = fragCoord / resolution;
  float3 base = mix(skyTop.rgb, skyBottom.rgb, smoothstep(0.0, 1.0, pow(uv.y, 0.9)));

  // Horizontal fade at edges
  float horizontalFade = smoothstep(0.0, 0.08, uv.x) * smoothstep(0.0, 0.1, 1.0 - uv.x);
  
  // Vertical fade - extends further down, more present at top
  float verticalFade = pow(max(1.0 - uv.y * 0.85, 0.0), 0.7);
  
  // Top blob - bright light source at top
  float blob = topBlob(uv, time);
  
  // Radial glow from top center
  float radial = 1.0 - smoothstep(0.0, 1.2, distance(uv, float2(0.5, -0.15)));
  radial = pow(radial, 2.0);
  
  // Multiple aurora bands with different speeds and phases
  float band1 = auroraBand(uv, 0.0, 0.13, 0.22, 0.7, 0.0, 0.38);
  float band2 = auroraBand(uv, 1.0, 0.11, 0.26, 0.85, 1.9, 0.32);
  float band3 = auroraBand(uv, 2.0, 0.10, 0.30, 0.65, 3.8, 0.28);
  float band4 = auroraBand(uv, 3.0, 0.08, 0.35, 0.9, 5.2, 0.25);
  
  // Color variation noise
  float colorVar = colorNoise(uv, time);
  
  // Create glowing envelope
  float envelope = horizontalFade * verticalFade;
  float blobEnvelope = envelope * radial;
  
  // Haze for atmosphere
  float haze = 0.5 + 0.5 * snoise(float2(uv.x * 1.8 + time * 0.12, uv.y * 2.5 - time * 0.08));
  float haze2 = 0.5 + 0.5 * snoise(float2(uv.x * 3.5 - time * 0.08, uv.y * 1.8 + time * 0.06));
  
  // Combine bands with varied weights
  float glow = (band1 * 1.0 + band2 * 0.85 + band3 * 0.7 + band4 * 0.5) * envelope;
  glow *= haze * 1.2;
  
  // Bright blob contribution
  glow += blob * blobEnvelope * 0.8;
  
  // Aurora colors with more variation
  float3 aurora =
    color1.rgb * band1 * 0.8 +
    color2.rgb * band2 * 1.0 +
    color3.rgb * band3 * 0.7;
  
  // Add color variation to aurora
  aurora = mix(aurora, aurora * color1.rgb, colorVar * 0.3);
  aurora = mix(aurora, aurora * color2.rgb, haze2 * 0.2);
  
  aurora *= glow * intensity;
  
  // Top glow - the bright blobs at top
  float3 topGlow = mix(color2.rgb, color1.rgb, 0.5) * radial * blob * 0.6;
  topGlow += color1.rgb * blob * blobEnvelope * 0.5;
  
  // Combine everything
  float3 finalColor = base + aurora + topGlow;
  
  // Fade at bottom - aurora extends far down but eventually fades
  finalColor = mix(finalColor, base, smoothstep(0.7, 1.0, uv.y));
  
  // Extra bright at very top
  finalColor += color2.rgb * blob * radial * 0.3 * intensity;

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

type AuroraRgb = [number, number, number];
type SharedAuroraRgb = { value: AuroraRgb };
type SharedNumber = { value: number };

type AuroraRgbInput = AuroraRgb | SharedAuroraRgb | undefined;

// Animated version that accepts shared value RGB arrays for smooth color transitions
interface AnimatedAuroraBackgroundProps {
  style?: StyleProp<ViewStyle>;
  width: number;
  height: number;
  skyTopShared: AuroraRgbInput;
  aur1Shared: AuroraRgbInput;
  aur2Shared: AuroraRgbInput;
  aur3Shared: AuroraRgbInput;
  skyBottom?: AuroraRgb;
  intensity?: number;
  baseSpeed?: number;
  speedBoost?: SharedNumber;
}

export const AnimatedAuroraBackground = memo(function AnimatedAuroraBackground({
  style,
  width,
  height,
  skyTopShared,
  aur1Shared,
  aur2Shared,
  aur3Shared,
  skyBottom = [0.016, 0.027, 0.051],
  intensity = 0.78,
  baseSpeed = 0.74,
  speedBoost,
}: AnimatedAuroraBackgroundProps) {
  const time = useSharedValue(0);

  useFrameCallback((frameInfo: FrameInfo) => {
    if (frameInfo.timeSincePreviousFrame != null) {
      const boost = speedBoost?.value ?? 1;
      time.value += (frameInfo.timeSincePreviousFrame / 1000) * baseSpeed * boost;
    }
  });

  const uniforms = useDerivedValue(
    () => {
      const aur1 = Array.isArray(aur1Shared) ? aur1Shared : aur1Shared?.value ?? [0.188, 0.478, 0.784];
      const aur2 = Array.isArray(aur2Shared) ? aur2Shared : aur2Shared?.value ?? [0.122, 0.553, 1];
      const aur3 = Array.isArray(aur3Shared) ? aur3Shared : aur3Shared?.value ?? [0.31, 0.471, 0.847];
      const skyTopResolved = Array.isArray(skyTopShared) ? skyTopShared : skyTopShared?.value ?? [0.071, 0.173, 0.337];

      return {
        resolution: [width, height],
        time: time.value,
        intensity,
        waveDirection: [8, -6] as [number, number],
        color1: [...aur1, 1],
        color2: [...aur2, 1],
        color3: [...aur3, 1],
        skyTop: [...skyTopResolved, 1],
        skyBottom: [...skyBottom, 1],
      };
    },
    [aur1Shared, aur2Shared, aur3Shared, skyTopShared, width, height, time, speedBoost, skyBottom, intensity],
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
