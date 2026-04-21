import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet as RNStyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  FadeInDown,
  FadeInUp,
  interpolate,
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";
import { SPORT_GENRES, type SportGenre } from "@/convex/constants";
import { triggerSelectionHaptic } from "@/components/ui/kit/native-interaction";
import { useStudioProfileStorage } from "@/hooks/use-onboarding-storage";
import { useTheme } from "@/hooks/use-theme";

function lerp(a: number, b: number, t: number) {
  "worklet";
  return a + (b - a) * t;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedImage = Animated.createAnimatedComponent(Image);
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.74, 310);
const CARD_HEIGHT = 452;
const CARD_RADIUS = 20;
const CARD_GAP = 18;
const SNAP = CARD_WIDTH + CARD_GAP;
const SIDE_INSET = (SCREEN_WIDTH - CARD_WIDTH) / 2;
const DISMISS_DURATION = 480;

const GENRE_VISUALS: Record<SportGenre, { imageUrl: string; accent: string }> = {
  pilates: {
    imageUrl:
      "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=80",
    accent: "#8B5CF6",
  },
  yoga: {
    imageUrl:
      "https://images.unsplash.com/photo-1510894347713-fc3ed6fdf539?auto=format&fit=crop&w=1200&q=80",
    accent: "#3B82F6",
  },
  barre_flexibility: {
    imageUrl:
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80",
    accent: "#EC4899",
  },
  functional_strength: {
    imageUrl:
      "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1200&q=80",
    accent: "#F97316",
  },
  crossfit: {
    imageUrl:
      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80",
    accent: "#EF4444",
  },
  performance: {
    imageUrl:
      "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?auto=format&fit=crop&w=1200&q=80",
    accent: "#EAB308",
  },
  cycling: {
    imageUrl:
      "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=80",
    accent: "#06B6D4",
  },
  dance_fitness: {
    imageUrl:
      "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=1200&q=80",
    accent: "#F43F5E",
  },
  combat_fitness: {
    imageUrl:
      "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=1200&q=80",
    accent: "#22C55E",
  },
  court_club: {
    imageUrl:
      "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=80",
    accent: "#14B8A6",
  },
};

type GenreCard = {
  key: SportGenre;
  title: string;
  imageUrl: string;
  accent: string;
  sportKeys: string[];
};

function AppStyleButton({
  title,
  onPress,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled: boolean;
  style?: any;
}) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const isPressed = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: disabled ? theme.color.surfaceMuted : theme.color.primary,
    opacity: isPressed.value === 1 ? 0.85 : 1,
  }));

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={() => {
        scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
        isPressed.value = 1;
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 300 });
        isPressed.value = 0;
      }}
      onPress={() => {
        triggerSelectionHaptic();
        onPress();
      }}
      style={[styles.appButton, style, animatedStyle]}
    >
      <Text
        style={[
          styles.appButtonText,
          { color: disabled ? theme.color.textMuted : theme.color.onPrimary },
        ]}
      >
        {title}
      </Text>
    </AnimatedPressable>
  );
}

function IndicatorPill({
  index,
  scrollX,
  accent,
  onPress,
}: {
  index: number;
  scrollX: SharedValue<number>;
  accent: string;
  onPress: () => void;
}) {
  const inputRange = [(index - 1) * SNAP, index * SNAP, (index + 1) * SNAP];
  const animatedStyle = useAnimatedStyle(() => ({
    width: interpolate(scrollX.value, inputRange, [8, 28, 8], Extrapolation.CLAMP),
    backgroundColor: interpolateColor(
      scrollX.value,
      inputRange,
      ["rgba(255,255,255,0.18)", accent, "rgba(255,255,255,0.18)"],
    ),
    opacity: interpolate(scrollX.value, inputRange, [0.5, 1, 0.5], Extrapolation.CLAMP),
  }));

  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Animated.View style={[styles.indicatorPill, animatedStyle]} />
    </Pressable>
  );
}

/** Card that animates itself out when `dismissing`, then calls `onDismissed` when done. */
function GenreCardView({
  item,
  index,
  scrollX,
  dismissing,
  onDismissed,
  onToggle,
}: {
  item: GenreCard;
  index: number;
  scrollX: SharedValue<number>;
  dismissing: boolean;
  onDismissed: () => void;
  onToggle: () => void;
}) {
  const dismissProgress = useSharedValue(0);

  useEffect(() => {
    if (dismissing) {
      dismissProgress.value = withTiming(1, {
        duration: DISMISS_DURATION,
        easing: Easing.out(Easing.cubic),
      });
      const t = setTimeout(onDismissed, DISMISS_DURATION + 30);
      return () => clearTimeout(t);
    }
  }, [dismissing]);

  const inputRange = [(index - 1) * SNAP, index * SNAP, (index + 1) * SNAP];

  const cardStyle = useAnimatedStyle(() => {
    const parallaxScale = interpolate(scrollX.value, inputRange, [0.93, 1, 0.93], Extrapolation.CLAMP);
    const parallaxY     = interpolate(scrollX.value, inputRange, [18, 0, 18], Extrapolation.CLAMP);
    const parallaxOp    = interpolate(scrollX.value, inputRange, [0.72, 1, 0.72], Extrapolation.CLAMP);
    const d             = dismissProgress.value;
    return {
      transform: [
        { translateY: lerp(parallaxY, 24, d) },
        { scale:      lerp(parallaxScale, 0.82, d) },
      ],
      opacity: lerp(parallaxOp, 0, d),
    };
  });

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(scrollX.value, inputRange, [-28, 0, 28], Extrapolation.CLAMP) },
      { scale:      interpolate(scrollX.value, inputRange, [1.14, 1.04, 1.14], Extrapolation.CLAMP) },
    ],
  }));

  const blurVeilStyle = useAnimatedStyle(() => ({
    opacity: dismissProgress.value,
  }));

  return (
    <Animated.View style={[styles.cardOuter, cardStyle]}>
      <View style={styles.card}>
        <AnimatedImage source={{ uri: item.imageUrl }} style={[styles.cardImage, imageStyle]} />
        <Animated.View style={[styles.cardImageBlur, blurVeilStyle]}>
          <Image source={{ uri: item.imageUrl }} style={styles.cardImage} blurRadius={22} />
        </Animated.View>
        <View style={styles.cardShade} />
        <Animated.View style={[styles.cardDismissVeil, blurVeilStyle]} />
        <View style={[styles.cardAccent, { backgroundColor: item.accent }]} />

        <View style={styles.cardBody}>
          <View style={styles.cardSpacer} />
          <View style={styles.cardFooterRow}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Pressable
              onPress={() => {
                triggerSelectionHaptic();
                onToggle();
              }}
              style={[styles.addPill, { backgroundColor: dismissing ? item.accent : "rgba(12,18,28,0.58)" }]}
            >
              <Text style={styles.addPillText}>{dismissing ? "Added" : "Add"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

export default function StudioSportsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<GenreCard>>(null);
  const { data, save } = useStudioProfileStorage();
  const scrollX = useSharedValue(0);

  const cards = useMemo<GenreCard[]>(
    () =>
      SPORT_GENRES.map((genre) => ({
        key: genre.key,
        title: genre.label,
        imageUrl: GENRE_VISUALS[genre.key].imageUrl,
        accent: GENRE_VISUALS[genre.key].accent,
        sportKeys: genre.sports.map((sport) => sport.key),
      })),
    [],
  );

  const initialGenres = useMemo(
    () =>
      cards
        .filter((card) => card.sportKeys.some((sport) => (data.sports ?? []).includes(sport)))
        .map((card) => card.key),
    [cards, data.sports],
  );

  const [selectedGenres, setSelectedGenres] = useState<SportGenre[]>(initialGenres);
  // Keys currently mid-animation (dismissing from carousel)
  const [dismissingKeys, setDismissingKeys] = useState<Set<SportGenre>>(new Set());
  // Keys fully removed from carousel
  const [removedKeys, setRemovedKeys] = useState<Set<SportGenre>>(new Set(initialGenres));
  const [activeIndex, setActiveIndex] = useState(0);

  // Visible in carousel = not yet removed (may be mid-dismiss animation)
  const visibleCards = cards.filter((card) => !removedKeys.has(card.key));
  const selectedCards = cards.filter((card) => selectedGenres.includes(card.key));
  const selectedSports = useMemo(
    () => Array.from(new Set(selectedCards.flatMap((card) => card.sportKeys))),
    [selectedCards],
  );

  useEffect(() => {
    if (activeIndex >= visibleCards.length && visibleCards.length > 0) {
      const next = visibleCards.length - 1;
      setActiveIndex(next);
      listRef.current?.scrollToOffset({ offset: next * SNAP, animated: true });
    }
  }, [visibleCards.length, activeIndex]);

  useEffect(() => {
    const active = visibleCards[activeIndex];
    if (active) router.setParams({ sportTheme: active.key });
  }, [activeIndex, visibleCards]);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => { scrollX.value = event.contentOffset.x; },
  });

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / SNAP);
    setActiveIndex(Math.max(0, Math.min(visibleCards.length - 1, nextIndex)));
  };

  const jumpToIndex = (index: number) => {
    triggerSelectionHaptic();
    listRef.current?.scrollToOffset({ offset: index * SNAP, animated: true });
    setActiveIndex(index);
  };

  const handleAdd = (genreKey: SportGenre) => {
    // 1. Mark as selected immediately
    setSelectedGenres((prev) => (prev.includes(genreKey) ? prev : [...prev, genreKey]));
    // 2. Start the dismiss animation
    setDismissingKeys((prev) => new Set([...prev, genreKey]));
  };

  const handleDismissed = (genreKey: SportGenre) => {
    // Animation done — remove from carousel entirely
    setRemovedKeys((prev) => new Set([...prev, genreKey]));
    setDismissingKeys((prev) => { const s = new Set(prev); s.delete(genreKey); return s; });
  };

  const handleDeselect = (genreKey: SportGenre) => {
    // Chip tapped — put card back in carousel and deselect
    setSelectedGenres((prev) => prev.filter((k) => k !== genreKey));
    setRemovedKeys((prev) => { const s = new Set(prev); s.delete(genreKey); return s; });
  };

  const handleContinue = () => {
    save({ sports: selectedSports });
    router.push("/onboarding/location?role=studio");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom }]}
    >
      <View style={styles.header}>
        <Animated.Text entering={FadeInDown.delay(100)} style={[styles.title, { color: theme.color.text }]}>
          Pick your sports
        </Animated.Text>
      </View>

      <Animated.View entering={FadeInDown.delay(180)} style={styles.carouselSection}>
        <Animated.FlatList
          ref={listRef}
          horizontal
          data={visibleCards}
          keyExtractor={(item) => item.key}
          renderItem={({ item, index }) => (
            <View style={{ width: CARD_WIDTH, marginRight: CARD_GAP }}>
              <GenreCardView
                item={item}
                index={index}
                scrollX={scrollX}
                dismissing={dismissingKeys.has(item.key)}
                onDismissed={() => handleDismissed(item.key)}
                onToggle={() => handleAdd(item.key)}
              />
            </View>
          )}
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={SNAP}
          snapToAlignment="start"
          bounces
          onScroll={onScroll}
          onMomentumScrollEnd={handleMomentumEnd}
          scrollEventThrottle={16}
          initialScrollIndex={0}
          getItemLayout={(_, index) => ({ length: SNAP, offset: index * SNAP, index })}
          contentContainerStyle={{ paddingHorizontal: SIDE_INSET }}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(240)} style={styles.indicatorSection}>
        <View style={styles.indicatorRow}>
          {visibleCards.map((card, index) => (
            <IndicatorPill
              key={card.key}
              index={index}
              scrollX={scrollX}
              accent={card.accent}
              onPress={() => jumpToIndex(index)}
            />
          ))}
        </View>
      </Animated.View>

      {selectedCards.length > 0 ? (
        <Animated.View entering={FadeInUp.springify().damping(18)} style={styles.selectedSection}>
          <Text style={[styles.selectedLabel, { color: theme.color.textMuted }]}>Selected</Text>
          <View style={styles.tagWrap}>
            {selectedCards.map((card) => (
              <Pressable
                key={card.key}
                onPress={() => handleDeselect(card.key)}
                style={[
                  styles.genreChip,
                  { backgroundColor: `${card.accent}22`, borderColor: `${card.accent}55` },
                ]}
              >
                <Text style={[styles.genreChipText, { color: theme.color.text }]}>{card.title}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(360)} style={styles.footer}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}
        >
          <MaterialIcons name="arrow-back" size={24} color={theme.color.danger} />
        </Pressable>
        <AppStyleButton
          title={t("common.continue", { defaultValue: "Continue" })}
          onPress={handleContinue}
          disabled={selectedGenres.length === 0}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: { flex: 1 },
  header: { paddingHorizontal: theme.spacing.lg, marginBottom: theme.spacing.md },
  title: {
    fontFamily: theme.fontFamily.kanitExtraBold,
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: -1,
  },
  carouselSection: {
    minHeight: CARD_HEIGHT + 8,
    justifyContent: "center",
  },
  cardOuter: { height: CARD_HEIGHT },
  card: {
    flex: 1,
    borderRadius: CARD_RADIUS,
    overflow: "hidden",
    backgroundColor: "rgba(10,14,24,0.85)",
  },
  cardImage: {
    ...RNStyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  cardImageBlur: { ...RNStyleSheet.absoluteFillObject },
  cardShade: {
    ...RNStyleSheet.absoluteFillObject,
    backgroundColor: "rgba(4,10,18,0.28)",
  },
  cardDismissVeil: {
    ...RNStyleSheet.absoluteFillObject,
    backgroundColor: "rgba(4,10,18,0.55)",
    opacity: 0,
  },
  cardAccent: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    height: 4,
    borderRadius: 999,
  },
  cardBody: { flex: 1, padding: 20 },
  cardSpacer: { flex: 1 },
  cardFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    color: "white",
    fontFamily: theme.fontFamily.kanitExtraBold,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.7,
  },
  addPill: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addPillText: {
    color: "white",
    fontFamily: theme.fontFamily.bodyStrong,
    fontSize: 14,
  },
  indicatorSection: {
    alignItems: "center",
    marginTop: theme.spacing.md,
  },
  indicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  indicatorPill: {
    height: 8,
    borderRadius: 999,
  },
  // No flex:1 here — let it size to content, footer stays pinned via marginTop:auto
  selectedSection: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  selectedLabel: {
    fontFamily: theme.fontFamily.bodyStrong,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  genreChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  genreChipText: { fontFamily: theme.fontFamily.bodyStrong, fontSize: 14 },
  footer: {
    marginTop: "auto",
    flexDirection: "row",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  backButton: {
    width: 64,
    height: 60,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.color.dangerSubtle,
    borderWidth: 1,
    borderColor: "rgba(255,0,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  appButton: {
    minHeight: 60,
    borderRadius: theme.radius.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  appButtonText: { fontFamily: theme.fontFamily.bodyStrong, fontSize: 18, lineHeight: 26 },
}));
