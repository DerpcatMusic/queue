import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";

export const RAIL_LEFT = 24;
export const RAIL_DOT_DAY = 10;
export const RAIL_DOT_LESSON = 6;

export function toDayKey(timestamp: number) {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dayKeyToTimestamp(dayKey: string) {
  const [y, m, d] = dayKey.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d).getTime();
}

export function formatDayHeading(dayKey: string, locale: string) {
  return new Date(dayKeyToTimestamp(dayKey)).toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
  });
}

export function formatDaySubtitle(dayKey: string, locale: string) {
  return new Date(dayKeyToTimestamp(dayKey)).toLocaleDateString(locale, {
    weekday: "long",
  });
}

export function formatMonthYear(dayKey: string, locale: string) {
  return new Date(dayKeyToTimestamp(dayKey)).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

export function formatSelectedDayLabel(dayKey: string, locale: string) {
  return new Date(dayKeyToTimestamp(dayKey)).toLocaleDateString(locale, {
    weekday: "long",
  });
}

export function formatSelectedDayDate(dayKey: string, locale: string) {
  return new Date(dayKeyToTimestamp(dayKey)).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function hashSport(sport: string) {
  let h = 0;
  for (let i = 0; i < sport.length; i++) {
    h = sport.charCodeAt(i) + ((h << 5) - h);
  }
  return Math.abs(h);
}

export const calendarTimelineStyles = {
  timelineViewport: {
    flex: 1,
    position: "relative",
  },
  timelineContent: {
    paddingTop: BrandSpacing.xs,
  },
  timelineBottomMask: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 1,
  },
  visibilitySection: {
    gap: BrandSpacing.sm,
  },
  visibilityChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandSpacing.sm,
  },
  headerControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.sm + BrandSpacing.xxs,
  },
  timelineRow: {},
  dayHeaderContent: {
    gap: BrandSpacing.xxs,
    paddingTop: BrandSpacing.sm + BrandSpacing.xxs,
    paddingBottom: BrandSpacing.xs,
  },
  dayHeading: {
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 22,
  },
  daySubtitle: {
    fontSize: 12,
    fontWeight: "400",
  },
  lessonCard: {
    flex: 1,
    marginRight: BrandSpacing.lg,
    marginBottom: BrandSpacing.sm,
    paddingHorizontal: BrandSpacing.md,
    paddingVertical: BrandSpacing.sm + BrandSpacing.xxs,
    borderRadius: BrandRadius.cardSubtle - BrandSpacing.xxs,
    borderCurve: "continuous",
  },
  lessonRowCompact: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: BrandSpacing.sm + BrandSpacing.xxs,
  },
  lessonTimeColumn: {
    width: 64,
    alignItems: "flex-start",
    justifyContent: "center",
    gap: BrandSpacing.xxs / 2,
  },
  lessonTimePrimary: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 16,
  },
  lessonTimeSecondary: {
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 14,
  },
  lessonAccent: {
    width: 3,
    borderRadius: BrandRadius.pill,
    borderCurve: "continuous",
  },
  lessonContent: {
    flex: 1,
    minWidth: 0,
    gap: BrandSpacing.xxs,
  },
  lessonTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: BrandSpacing.sm,
  },
  lifecycleBadge: {
    paddingHorizontal: BrandSpacing.sm,
    paddingVertical: BrandSpacing.xxs,
    borderRadius: BrandRadius.pill,
    borderCurve: "continuous",
  },
  lifecycleBadgeText: {
    ...BrandType.micro,
    fontWeight: "600",
  },
  lessonTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 19,
  },
  lessonMeta: {
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 16,
  },
  lessonSource: {
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 14,
  },
  emptyStateCard: {
    flex: 1,
    marginRight: BrandSpacing.lg,
    marginBottom: BrandSpacing.sm,
    paddingHorizontal: BrandSpacing.controlX,
    paddingVertical: BrandSpacing.md,
    borderRadius: BrandRadius.card - BrandSpacing.sm,
    borderCurve: "continuous",
    justifyContent: "center",
  },
  emptyStateTitle: {
    fontSize: 13,
    fontWeight: "500",
  },
} as const;

export const calendarSheetStyles = {
  root: {
    gap: BrandSpacing.xs,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: BrandSpacing.md,
  },
  titleColumn: {
    flex: 1,
    gap: BrandSpacing.xs,
  },
  title: {
    ...BrandType.heading,
    fontSize: 30,
    lineHeight: 34,
  },
  subtitle: {
    ...BrandType.caption,
    opacity: 0.72,
  },
  actionsColumn: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.xs,
  },
  googleBadge: {
    ...BrandType.micro,
    marginTop: -1,
    fontSize: 9,
    lineHeight: 10,
    letterSpacing: 0.3,
  },
  summaryCountPill: {
    borderRadius: BrandRadius.pill,
    borderCurve: "continuous",
    paddingHorizontal: BrandSpacing.md,
    paddingVertical: BrandSpacing.sm - BrandSpacing.xxs,
  },
  agendaHeader: {
    gap: BrandSpacing.xs,
    paddingTop: BrandSpacing.xs,
    paddingBottom: BrandSpacing.xs,
  },
  agendaHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: BrandSpacing.md,
  },
  datePickerBlock: {
    gap: BrandSpacing.sm,
    paddingTop: BrandSpacing.xs,
  },
  datePickerActions: {
    paddingBottom: BrandSpacing.xs,
  },
} as const;
