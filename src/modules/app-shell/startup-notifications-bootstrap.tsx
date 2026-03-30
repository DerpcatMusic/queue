import { useMutation, useQuery } from "convex/react";
import Constants from "expo-constants";
import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import {
  clearLocalLessonReminders,
  getLocalReminderHorizonMs,
  syncLocalLessonReminders,
} from "@/lib/local-lesson-reminders";
import {
  isPushRegistrationError,
  registerForPushNotificationsAsync,
} from "@/lib/push-notifications";
import { useStartupNotificationsSetup } from "@/modules/app-shell/use-startup-notifications-setup";
import { waitForInteractions } from "@/modules/app-shell/wait-for-interactions";

const LOCAL_SYNC_WINDOW_MS = getLocalReminderHorizonMs();

export function StartupNotificationsBootstrap() {
  useStartupNotificationsSetup();

  const { currentUser } = useUser();
  const [windowAnchor, setWindowAnchor] = useState(() => Date.now());
  const pushSyncKeyRef = useRef<string | null>(null);
  const localReminderSyncKeyRef = useRef<string | null>(null);

  const notificationSettings = useQuery(
    api.users.getMyNotificationSettings,
    currentUser?.role === "instructor" || currentUser?.role === "studio" ? {} : "skip",
  );
  const timeline = useQuery(
    api.jobs.getMyCalendarTimeline,
    currentUser?.role === "instructor" || currentUser?.role === "studio"
      ? {
          startTime: windowAnchor,
          endTime: windowAnchor + LOCAL_SYNC_WINDOW_MS,
          now: windowAnchor,
          limit: 200,
        }
      : "skip",
  );

  const updateNotificationSettings = useMutation(api.users.updateMyNotificationSettings);
  const touchNotificationClientState = useMutation(api.users.touchMyNotificationClientState);

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    let notificationResponseSubscription:
      | { remove: () => void }
      | null = null;

    void (async () => {
      try {
        const Notifications = await import("expo-notifications");
        notificationResponseSubscription =
          Notifications.addNotificationResponseReceivedListener(() => {
            setWindowAnchor(Date.now());
          });
      } catch {
        // Optional runtime support.
      }
    })();

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        return;
      }
      setWindowAnchor(Date.now());
    });

    return () => {
      subscription.remove();
      notificationResponseSubscription?.remove();
    };
  }, []);

  useEffect(() => {
    if (
      Platform.OS === "web" ||
      Constants.appOwnership === "expo" ||
      !currentUser ||
      !notificationSettings?.notificationsEnabled
    ) {
      pushSyncKeyRef.current = null;
      return;
    }

    const syncKey = `${currentUser._id}:${notificationSettings.notificationsEnabled}:${notificationSettings.hasExpoPushToken}`;
    if (pushSyncKeyRef.current === syncKey) {
      return;
    }
    pushSyncKeyRef.current = syncKey;

    let cancelled = false;
    const syncPushToken = async () => {
      await waitForInteractions();
      if (cancelled) {
        return;
      }

      try {
        const token = await registerForPushNotificationsAsync({
          requestPermission: false,
        });
        if (cancelled) {
          return;
        }

        await updateNotificationSettings({
          notificationsEnabled: true,
          expoPushToken: token,
        });
        await touchNotificationClientState({});
      } catch (error) {
        if (isPushRegistrationError(error) && error.code === "permission_denied") {
          return;
        }
        console.warn("Failed to refresh push token", error);
      }
    };

    void syncPushToken();

    return () => {
      cancelled = true;
    };
  }, [
    currentUser,
    notificationSettings?.hasExpoPushToken,
    notificationSettings?.notificationsEnabled,
    touchNotificationClientState,
    updateNotificationSettings,
  ]);

  useEffect(() => {
    if (
      Platform.OS === "web" ||
      Constants.appOwnership === "expo" ||
      !currentUser ||
      !notificationSettings
    ) {
      localReminderSyncKeyRef.current = null;
      void clearLocalLessonReminders();
      return;
    }

    if (
      !notificationSettings.notificationsEnabled ||
      !notificationSettings.preferences.lesson_reminder
    ) {
      localReminderSyncKeyRef.current = null;
      void clearLocalLessonReminders();
      return;
    }

    if (!timeline) {
      return;
    }

    const localLessons = timeline
      .filter((lesson) => lesson.status === "filled" && lesson.lifecycle === "upcoming")
      .map((lesson) => `${lesson.lessonId}:${lesson.startTime}:${lesson.status}:${lesson.lifecycle}`)
      .join("|");
    const syncKey = `${currentUser._id}:${notificationSettings.lessonReminderMinutesBefore}:${localLessons}`;

    if (localReminderSyncKeyRef.current === syncKey) {
      return;
    }
    localReminderSyncKeyRef.current = syncKey;

    let cancelled = false;
    const run = async () => {
      await waitForInteractions();
      if (cancelled) {
        return;
      }

      try {
        const token = await registerForPushNotificationsAsync({
          requestPermission: false,
        });
        if (!token || cancelled) {
          return;
        }

        await syncLocalLessonReminders({
          lessons: timeline.map((lesson) => ({
            lessonId: String(lesson.lessonId),
            roleView: lesson.roleView,
            studioName: lesson.studioName,
            ...(lesson.instructorName ? { instructorName: lesson.instructorName } : {}),
            sport: lesson.sport,
            startTime: lesson.startTime,
            status: lesson.status,
            lifecycle: lesson.lifecycle,
          })),
          leadMinutes: notificationSettings.lessonReminderMinutesBefore,
        });
        await touchNotificationClientState({
          localReminderCoverageUntil: windowAnchor + LOCAL_SYNC_WINDOW_MS,
        });
      } catch (error) {
        if (isPushRegistrationError(error) && error.code === "permission_denied") {
          await clearLocalLessonReminders();
          return;
        }
        console.warn("Failed to sync local lesson reminders", error);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    currentUser,
    notificationSettings,
    touchNotificationClientState,
    timeline,
    windowAnchor,
  ]);

  return null;
}
