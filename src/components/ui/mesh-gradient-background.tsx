import React, { useCallback } from "react";
import { Dimensions, StyleSheet, View, ViewStyle } from "react-native";
import { Canvas, Shader, Skia, Fill, vec } from "@shopify/react-native-skia";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

/**
 * Mesh gradient background using Skia runtime shader.
 *
 * Pure white canvas with a single blue accent that flows organically.
 * NO dark coloring ever — the colour space is clamped to [whiteFloor, 1.0].
 *
 * Reusable: pass custom colors, speed, noise via props.
 */

const SHADER = `
uniform float2 resolution;
uniform float time;
uniform float noise;
uniform float blur;
uniform float contrast;
uniform float4 color1;
uniform float4 color2;
uniform float4 color3;
uniform float4 color4;

// ── Noise utilities ────────────────────────────────────────────────────────
float hash(float2 p) {
  float3 p3 = fract(float3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float smoothNoise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + float2(1.0, 0.0));
  float c = hash(i + float2(0.0, 1.0));
  float d = hash(i + float2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(float2 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  float maxValue = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    value += amplitude * smoothNoise(p * frequency);
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  return value / maxValue;
}

float3 mod289(float3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
float2 mod289(float2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
float3 permute(float3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(float2 v) {
  const float4 C = float4(0.211324865405187, 0.366025403784439,
                          -0.577350269189626, 0.024390243902439);
  float2 i  = floor(v + dot(v, C.yy));
  float2 x0 = v - i + dot(i, C.xx);
  float2 i1 = (x0.x > x0.y) ? float2(1.0, 0.0) : float2(0.0, 1.0);
  float4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  float3 p = permute(permute(i.y + float3(0.0, i1.y, 1.0)) + i.x + float3(0.0, i1.x, 1.0));
  float3 m = max(0.5 - float3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m*m*m;
  float3 x = 2.0 * fract(p * C.www) - 1.0;
  float3 h = abs(x) - 0.5;
  float3 ox = floor(x + 0.5);
  float3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  float3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// ── Warp: domain warping for organic flow ──────────────────────────────
float2 warp(float2 p, float t) {
  float2 q = float2(
    fbm(p + 0.2 * t, 3),
    fbm(p + float2(5.2, 1.3) + 0.22 * t, 3)
  );
  float2 r = float2(
    fbm(p + 3.0 * q + float2(1.7, 9.2) + 0.25 * t, 3),
    fbm(p + 3.0 * q + float2(8.3, 2.8) + 0.2 * t, 3)
  );
  return p + 1.5 * r * blur;
}

// ── Soft metaball ──────────────────────────────────────────────────────
float metaball(float2 uv, float2 center, float radius) {
  float d = length(uv - center);
  return radius * radius / (d * d + radius * 0.5);
}

half4 main(float2 fragCoord) {
  float2 uv = fragCoord / resolution;
  float aspect = resolution.x / resolution.y;

  float2 st = uv;
  st.x *= aspect;

  // ── Time ──────────────────────────────────────────────────────────
  float t = time * 0.3;

  // ── Metaball centres: grand sinusoidal orbits, no noise ────────────
  // Each blob traces a wide smooth ellipse with unique phase & speed.
  // No jitter — just fluid, sweeping motion.
  float2 p1 = float2(
    0.3  * aspect + 0.45 * sin(t * 0.7 + 0.0) * aspect,
    0.4  + 0.40 * cos(t * 0.5 + 0.3)
  );
  float2 p2 = float2(
    0.6  * aspect + 0.40 * cos(t * 0.6 + 1.8) * aspect,
    0.5  + 0.42 * sin(t * 0.55 + 1.2)
  );
  float2 p3 = float2(
    0.8  * aspect + 0.42 * sin(t * 0.5 + 3.5) * aspect,
    0.65 + 0.38 * cos(t * 0.65 + 2.0)
  );
  float2 p4 = float2(
    0.45 * aspect + 0.44 * cos(t * 0.55 + 5.0) * aspect,
    0.25 + 0.40 * sin(t * 0.6 + 3.8)
  );

  // ── Metaball field ─────────────────────────────────────────────────
  float baseRadius = 0.6 + blur * 0.2;

  float w1 = metaball(st, p1, baseRadius * 1.0);
  float w2 = metaball(st, p2, baseRadius * 1.15);
  float w3 = metaball(st, p3, baseRadius * 1.1);
  float w4 = metaball(st, p4, baseRadius * 1.05);

  // Smooth weight breathing — gentle pulsing, no chaotic noise
  w1 *= 1.0 + 0.12 * sin(t * 0.8 + 0.0);
  w2 *= 1.0 + 0.10 * sin(t * 0.7 + 1.5);
  w3 *= 1.0 + 0.11 * sin(t * 0.9 + 3.0);
  w4 *= 1.0 + 0.09 * sin(t * 0.6 + 4.5);

  // Soft falloff
  float falloff = 1.8 - blur * 0.6;
  w1 = pow(max(w1, 0.0), falloff);
  w2 = pow(max(w2, 0.0), falloff);
  w3 = pow(max(w3, 0.0), falloff);
  w4 = pow(max(w4, 0.0), falloff);

  // Normalise
  float total = w1 + w2 + w3 + w4 + 0.08;
  w1 /= total;
  w2 /= total;
  w3 /= total;
  w4 /= total;

  // ── Blend colours ──────────────────────────────────────────────────
  float3 col = color1.rgb * w1 + color2.rgb * w2 + color3.rgb * w3 + color4.rgb * w4;

  // ── ABSOLUTE NO-DARK GUARANTEE ─────────────────────────────────────
  // Floor every channel to the lightest colour's minimum component.
  // Since color4 is pure white (1.0), this guarantees col >= 0.94.
  float3 whiteFloor = float3(
    min(min(color1.r, color2.r), min(color3.r, color4.r)),
    min(min(color1.g, color2.g), min(color3.g, color4.g)),
    min(min(color1.b, color2.b), min(color3.b, color4.b))
  );
  col = max(col, whiteFloor);

  // White pull: always blend toward white so the canvas stays bright
  float rawTotal = w1 + w2 + w3 + w4;
  float whiteBlend = 1.0 - smoothstep(0.2, 0.7, rawTotal);
  col = mix(col, color4.rgb, whiteBlend * 0.5);

  // NO vignette — vignette darkens edges
  // NO grain — grain adds dark noise
  // NO contrast desaturation — it can pull channels down

  col = clamp(col, 0.0, 1.0);
  return half4(col, 1.0);
}
`;

// ─── Public interface ──────────────────────────────────────────────────────

export interface IMeshGradientColor {
  r: number;
  g: number;
  b: number;
}

export interface MeshGradientBackgroundProps {
  /** Override the four colour stops. Provide exactly 4 entries. */
  colors?: IMeshGradientColor[];
  /** Animation speed multiplier. 1 = default. Higher = faster. */
  speed?: number;
  /** Noise / warp intensity 0–1. Default 0.5. */
  noise?: number;
  /** Blur / softness 0–1. Default 0.45. */
  blur?: number;
  /** Whether to animate. Default true. Set false for a static snapshot. */
  animated?: boolean;
  /** Extra view style applied to the outer wrapper. */
  style?: ViewStyle;
}

// ─── Defaults: white-dominant with a splash of blue ────────────────────────

const DEFAULT_COLORS: IMeshGradientColor[] = [
  { r: 0.55, g: 0.72, b: 1.0 }, // soft blue — visible but gentle
  { r: 0.94, g: 0.96, b: 1.0 }, // ghost blue
  { r: 1.0, g: 1.0, b: 1.0 }, // pure white
  { r: 1.0, g: 1.0, b: 1.0 }, // pure white
];

const shader = Skia.RuntimeEffect.Make(SHADER);

// ─── Frame-time hook ──────────────────────────────────────────────────────

const useFrameTime = (animated: boolean, speed: number): SharedValue<number> => {
  const time = useSharedValue(0);
  const accumulated = useSharedValue(0);

  useFrameCallback((frameInfo: { timeSincePreviousFrame: number | null }) => {
    if (animated && frameInfo.timeSincePreviousFrame !== null) {
      accumulated.value += frameInfo.timeSincePreviousFrame * speed;
      const frameInterval = 1000 / 60;
      if (accumulated.value >= frameInterval) {
        time.value += accumulated.value / 1000;
        accumulated.value = 0;
      }
    }
  }, animated);

  return time;
};

// ─── Component ─────────────────────────────────────────────────────────────

export function MeshGradientBackground({
  colors,
  speed = 1,
  noise = 0.65,
  blur = 0.45,
  animated = true,
  style,
}: MeshGradientBackgroundProps) {
  const width = useSharedValue(Dimensions.get("window").width);
  const height = useSharedValue(Dimensions.get("window").height);
  const time = useFrameTime(animated, speed);
  const scale = 0.3; // undersampling for performance

  const safeColors: IMeshGradientColor[] = (colors ?? DEFAULT_COLORS).slice(0, 4);
  // Pad to 4 if fewer provided
  while (safeColors.length < 4) {
    safeColors.push(DEFAULT_COLORS[safeColors.length] ?? { r: 1, g: 1, b: 1 });
  }

  const uniforms = useDerivedValue(
    () => ({
      resolution: vec(width.value * scale, height.value * scale),
      time: time.value,
      noise,
      blur,
      contrast: 0.0, // kept for uniform slot but unused in shader
      color1: [safeColors[0]!.r, safeColors[0]!.g, safeColors[0]!.b, 1],
      color2: [safeColors[1]!.r, safeColors[1]!.g, safeColors[1]!.b, 1],
      color3: [safeColors[2]!.r, safeColors[2]!.g, safeColors[2]!.b, 1],
      color4: [safeColors[3]!.r, safeColors[3]!.g, safeColors[3]!.b, 1],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, height, time, noise, blur, ...safeColors.flatMap((c) => [c.r, c.g, c.b])],
  );

  const canvasWrapperStyle = useAnimatedStyle(() => ({
    position: "absolute" as const,
    top: 0,
    left: 0,
    width: Math.round(width.value * scale),
    height: Math.round(height.value * scale),
    transform: [{ scale: 1 / scale }],
    transformOrigin: "left top" as const,
    zIndex: -9999,
  }));

  const onLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
      const w = e.nativeEvent.layout.width;
      const h = e.nativeEvent.layout.height;
      width.value = w < 1 ? 1 : w;
      height.value = h < 1 ? 1 : h;
    },
    [width, height],
  );

  if (!shader) return null;

  return (
    <View style={[StyleSheet.absoluteFill, style]} onLayout={onLayout}>
      <Animated.View style={canvasWrapperStyle}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Fill>
            <Shader source={shader} uniforms={uniforms} />
          </Fill>
        </Canvas>
      </Animated.View>
    </View>
  );
}
