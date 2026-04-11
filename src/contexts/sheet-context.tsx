/**
 * Global sheet state context for profile sub-pages and calendar lesson details.
 *
 * This allows opening profile sheets (payments, sports, compliance, etc.)
 * from anywhere in the app - including from other tabs like Home.
 * Also handles calendar lesson detail sheets for both roles.
 *
 * Role gating is enforced by checking currentUser.role before opening.
 */

import { createContext, useCallback, useContext, useState } from "react";
import { useUser } from "@/contexts/user-context";

// ─── Types ───────────────────────────────────────────────────────────────────

export type InstructorSubpage =
  | "payments"
  | "sports"
  | "location"
  | "compliance"
  | "calendar-settings"
  | "edit"
  | "notifications"
  | "add-account"
  | "identity-verification";

export type StudioSubpage =
  | "payments"
  | "compliance"
  | "branches"
  | "calendar-settings"
  | "edit"
  | "notifications"
  | "add-account";

export type CalendarLessonSheetRole = "instructor" | "studio";

interface SheetContextValue {
  // Instructor sheets
  instructorActiveSheet: InstructorSubpage | null;
  openInstructorSheet: (sheet: InstructorSubpage) => boolean; // returns false if wrong role
  closeInstructorSheet: () => void;

  // Studio sheets
  studioActiveSheet: StudioSubpage | null;
  openStudioSheet: (sheet: StudioSubpage) => boolean; // returns false if wrong role
  closeStudioSheet: () => void;

  // Calendar lesson detail sheet (shared by both roles)
  calendarLessonJobId: string | null;
  calendarLessonRole: CalendarLessonSheetRole | null;
  openCalendarLesson: (jobId: string, role: CalendarLessonSheetRole) => void;
  closeCalendarLesson: () => void;

  // Studio public profile sheet (opened from calendar lesson detail)
  studioPublicProfileSlug: string | null;
  openStudioPublicProfile: (slug: string) => void;
  closeStudioPublicProfile: () => void;
}

const SheetContext = createContext<SheetContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SheetProvider({ children }: { children: React.ReactNode }) {
  const [instructorActiveSheet, setInstructorActiveSheet] = useState<InstructorSubpage | null>(
    null,
  );
  const [studioActiveSheet, setStudioActiveSheet] = useState<StudioSubpage | null>(null);
  const [calendarLessonJobId, setCalendarLessonJobId] = useState<string | null>(null);
  const [calendarLessonRole, setCalendarLessonRole] = useState<CalendarLessonSheetRole | null>(
    null,
  );
  const [studioPublicProfileSlug, setStudioPublicProfileSlug] = useState<string | null>(null);

  const openInstructorSheet = useCallback((sheet: InstructorSubpage): boolean => {
    setInstructorActiveSheet(sheet === "identity-verification" ? "compliance" : sheet);
    return true;
  }, []);

  const closeInstructorSheet = useCallback(() => {
    setInstructorActiveSheet(null);
  }, []);

  const openStudioSheet = useCallback((sheet: StudioSubpage): boolean => {
    setStudioActiveSheet(sheet);
    return true;
  }, []);

  const closeStudioSheet = useCallback(() => {
    setStudioActiveSheet(null);
  }, []);

  const openCalendarLesson = useCallback((jobId: string, role: CalendarLessonSheetRole) => {
    setCalendarLessonJobId(jobId);
    setCalendarLessonRole(role);
  }, []);

  const closeCalendarLesson = useCallback(() => {
    setCalendarLessonJobId(null);
    setCalendarLessonRole(null);
  }, []);

  const openStudioPublicProfile = useCallback((slug: string) => {
    setStudioPublicProfileSlug(slug);
  }, []);

  const closeStudioPublicProfile = useCallback(() => {
    setStudioPublicProfileSlug(null);
  }, []);

  return (
    <SheetContext.Provider
      value={{
        instructorActiveSheet,
        openInstructorSheet,
        closeInstructorSheet,
        studioActiveSheet,
        openStudioSheet,
        closeStudioSheet,
        calendarLessonJobId,
        calendarLessonRole,
        openCalendarLesson,
        closeCalendarLesson,
        studioPublicProfileSlug,
        openStudioPublicProfile,
        closeStudioPublicProfile,
      }}
    >
      {children}
    </SheetContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSheetContext(): SheetContextValue {
  const ctx = useContext(SheetContext);
  if (!ctx) {
    throw new Error("useSheetContext must be used within SheetProvider");
  }
  return ctx;
}

// ─── Convenience Hooks ────────────────────────────────────────────────────────

/**
 * Hook to open instructor profile sheets from anywhere.
 * Only works when current user is an instructor.
 */
export function useOpenInstructorSheet() {
  const { currentUser } = useUser();
  const { openInstructorSheet } = useSheetContext();

  return {
    openPayments: () => {
      if (currentUser?.role !== "instructor") return false;
      return openInstructorSheet("payments");
    },
    openSports: () => {
      if (currentUser?.role !== "instructor") return false;
      return openInstructorSheet("sports");
    },
    openLocation: () => {
      if (currentUser?.role !== "instructor") return false;
      return openInstructorSheet("location");
    },
    openCompliance: () => {
      if (currentUser?.role !== "instructor") return false;
      return openInstructorSheet("compliance");
    },
    openCalendarSettings: () => {
      if (currentUser?.role !== "instructor") return false;
      return openInstructorSheet("calendar-settings");
    },
    openEdit: () => {
      if (currentUser?.role !== "instructor") return false;
      return openInstructorSheet("edit");
    },
    openNotifications: () => {
      if (currentUser?.role !== "instructor") return false;
      return openInstructorSheet("notifications");
    },
    openAddAccount: () => {
      if (currentUser?.role !== "instructor") return false;
      return openInstructorSheet("add-account");
    },
    openIdentityVerification: () => {
      if (currentUser?.role !== "instructor") return false;
      return openInstructorSheet("identity-verification");
    },
  };
}

/**
 * Hook to open studio profile sheets from anywhere.
 * Only works when current user is a studio.
 */
export function useOpenStudioSheet() {
  const { currentUser } = useUser();
  const { openStudioSheet } = useSheetContext();

  return {
    openPayments: () => {
      if (currentUser?.role !== "studio") return false;
      return openStudioSheet("payments");
    },
    openCompliance: () => {
      if (currentUser?.role !== "studio") return false;
      return openStudioSheet("compliance");
    },
    openBranches: () => {
      if (currentUser?.role !== "studio") return false;
      return openStudioSheet("branches");
    },
    openCalendarSettings: () => {
      if (currentUser?.role !== "studio") return false;
      return openStudioSheet("calendar-settings");
    },
    openEdit: () => {
      if (currentUser?.role !== "studio") return false;
      return openStudioSheet("edit");
    },
    openNotifications: () => {
      if (currentUser?.role !== "studio") return false;
      return openStudioSheet("notifications");
    },
    openAddAccount: () => {
      if (currentUser?.role !== "studio") return false;
      return openStudioSheet("add-account");
    },
  };
}
