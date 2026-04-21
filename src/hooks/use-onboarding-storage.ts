import { useCallback, useState } from "react";
import { createMMKV } from "react-native-mmkv";

const storage = createMMKV({ id: "onboarding-storage" });

const KEYS = {
  INSTRUCTOR_PROFILE: "onboarding_instructor_profile",
  STUDIO_PROFILE: "onboarding_studio_profile",
  LOCATION: "onboarding_location",
} as const;

export type InstructorProfileData = {
  displayName: string;
  bio: string;
  sports: string[];
};

export type StudioProfileData = {
  studioName: string;
  sports: string[];
  legalBusinessName?: string;
  registrationNumber?: string;
  taxId?: string;
  legalEntityType?: "individual" | "company";
};

export type LocationData = {
  address: string;
  latitude: number | null;
  longitude: number | null;
  country: string | null;
  countryCode: string | null;
};

function loadJson<T>(key: string): T | null {
  try {
    const raw = storage.getString(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function saveJson<T>(key: string, data: T): void {
  try {
    storage.set(key, JSON.stringify(data));
  } catch {
    // Ignore write failures
  }
}

function clearKey(key: string): void {
  try {
    storage.delete(key);
  } catch {
    // Ignore delete failures
  }
}

// ─── Instructor Profile ───────────────────────────────────────────────────────

export function useInstructorProfileStorage() {
  const [data, setData] = useState<InstructorProfileData>(
    () =>
      loadJson<InstructorProfileData>(KEYS.INSTRUCTOR_PROFILE) ?? {
        displayName: "",
        bio: "",
        sports: [],
      },
  );

  const save = useCallback((updates: Partial<InstructorProfileData>) => {
    setData((prev) => {
      const next = { ...prev, ...updates };
      saveJson(KEYS.INSTRUCTOR_PROFILE, next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setData({ displayName: "", bio: "", sports: [] });
    clearKey(KEYS.INSTRUCTOR_PROFILE);
  }, []);

  return { data, save, clear, isEmpty: !data.displayName.trim() };
}

// ─── Studio Profile ──────────────────────────────────────────────────────────

export function useStudioProfileStorage() {
  const [data, setData] = useState<StudioProfileData>(
    () => loadJson<StudioProfileData>(KEYS.STUDIO_PROFILE) ?? { studioName: "", sports: [] },
  );

  const save = useCallback((updates: Partial<StudioProfileData>) => {
    setData((prev) => {
      const next = { ...prev, ...updates };
      saveJson(KEYS.STUDIO_PROFILE, next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setData({ studioName: "", sports: [] });
    clearKey(KEYS.STUDIO_PROFILE);
  }, []);

  return { data, save, clear, isEmpty: !data.studioName.trim() };
}

// ─── Location ────────────────────────────────────────────────────────────────

export function useLocationStorage() {
  const [data, setData] = useState<LocationData>(
    () =>
      loadJson<LocationData>(KEYS.LOCATION) ?? {
        address: "",
        latitude: null,
        longitude: null,
        country: null,
        countryCode: null,
      },
  );

  const save = useCallback((updates: Partial<LocationData>) => {
    setData((prev) => {
      const next = { ...prev, ...updates };
      saveJson(KEYS.LOCATION, next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setData({ address: "", latitude: null, longitude: null, country: null, countryCode: null });
    clearKey(KEYS.LOCATION);
  }, []);

  return { data, save, clear, isEmpty: !data.address.trim() };
}

// ─── Clear all onboarding data ───────────────────────────────────────────────

export function clearAllOnboardingData() {
  clearKey(KEYS.INSTRUCTOR_PROFILE);
  clearKey(KEYS.STUDIO_PROFILE);
  clearKey(KEYS.LOCATION);
}
