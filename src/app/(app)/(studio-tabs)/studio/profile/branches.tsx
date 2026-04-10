import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { NoticeBanner } from "@/components/jobs/notice-banner";
import { LoadingScreen } from "@/components/loading-screen";
import {
  ProfileSectionCard,
  ProfileSectionHeader,
  ProfileSettingRow,
} from "@/components/profile/profile-settings-sections";
import {
  ProfileSubpageScrollView,
  useProfileSubpageSheet,
} from "@/components/profile/profile-subpage-sheet";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { ChoicePill } from "@/components/ui/choice-pill";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { KitSwitch, KitTextField } from "@/components/ui/kit";
import { BrandRadius, BrandSpacing } from "@/constants/brand";
import { getZoneLabel, ZONE_OPTIONS } from "@/constants/zones";
import { useUser } from "@/contexts/user-context";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Box } from "@/primitives";
import { useTheme } from "@/hooks/use-theme";
import { EXPIRY_OVERRIDE_PRESETS } from "@/lib/jobs-utils";
import { omitUndefined } from "@/lib/omit-undefined";

type CalendarProvider = "none" | "google" | "apple";

type StudioBranchRecord = {
  branchId: Id<"studioBranches">;
  studioId: Id<"studioProfiles">;
  name: string;
  slug: string;
  address: string;
  zone: string;
  isPrimary: boolean;
  status: "active" | "archived";
  latitude?: number;
  longitude?: number;
  contactPhone?: string;
  notificationsEnabled?: boolean;
  autoExpireMinutesBefore?: number;
  autoAcceptDefault?: boolean;
  calendarProvider?: CalendarProvider;
  calendarSyncEnabled?: boolean;
  calendarConnectedAt?: number;
  createdAt: number;
  updatedAt: number;
};

type BranchEntitlementStatus = {
  planKey: "free" | "growth" | "custom";
  maxBranches: number;
  branchesFeatureEnabled: boolean;
  subscriptionStatus: "active" | "trialing" | "past_due" | "canceled";
  activeBranchCount: number;
};

type BranchFormState = {
  name: string;
  address: string;
  zone: string;
  contactPhone: string;
  autoExpireMinutesBefore: number | undefined;
  autoAcceptDefault: boolean;
  calendarProvider: CalendarProvider;
  calendarSyncEnabled: boolean;
};

function buildBranchFormState(
  branch?: Partial<StudioBranchRecord> | null,
  fallback?: Partial<StudioBranchRecord> | null,
): BranchFormState {
  return {
    name: branch?.name ?? "",
    address: branch?.address ?? "",
    zone: branch?.zone ?? fallback?.zone ?? "",
    contactPhone: branch?.contactPhone ?? fallback?.contactPhone ?? "",
    autoExpireMinutesBefore:
      branch?.autoExpireMinutesBefore ?? fallback?.autoExpireMinutesBefore ?? 30,
    autoAcceptDefault: branch?.autoAcceptDefault ?? fallback?.autoAcceptDefault ?? false,
    calendarProvider: branch?.calendarProvider ?? fallback?.calendarProvider ?? "none",
    calendarSyncEnabled: branch?.calendarSyncEnabled ?? fallback?.calendarSyncEnabled ?? false,
  };
}

export default function StudioBranchesScreen() {
  const { t, i18n } = useTranslation();
  const { currentUser } = useUser();
  const { color: palette } = useTheme();
  const locale = i18n.resolvedLanguage ?? "en";
  const zoneLanguage = locale.toLowerCase().startsWith("he") ? "he" : "en";

  useProfileSubpageSheet({
    title: t("profile.navigation.branches"),
    routeMatchPath: "/profile/branches",
  });

  const branches = useQuery(
    api.studioBranches.getMyStudioBranches,
    currentUser?.role === "studio" ? { includeArchived: true } : "skip",
  ) as StudioBranchRecord[] | undefined;
  const entitlement = useQuery(
    api.studioBranches.getStudioBranchEntitlementStatus,
    currentUser?.role === "studio" ? {} : "skip",
  ) as BranchEntitlementStatus | undefined;
  const createBranch = useMutation(api.studioBranches.createStudioBranch);
  const updateBranch = useMutation(api.studioBranches.updateStudioBranch);
  const updateBranchCalendarSettings = useMutation(
    api.studioBranches.updateStudioBranchCalendarSettings,
  );
  const archiveBranch = useMutation(api.studioBranches.archiveStudioBranch);
  const setPrimaryBranch = useMutation(api.studioBranches.setPrimaryStudioBranch);

  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [editingBranchId, setEditingBranchId] = useState<Id<"studioBranches"> | null>(null);
  const [form, setForm] = useState<BranchFormState>(() => buildBranchFormState());
  const [zoneQuery, setZoneQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingPrimaryBranchId, setPendingPrimaryBranchId] = useState<Id<"studioBranches"> | null>(
    null,
  );
  const [pendingArchiveBranchId, setPendingArchiveBranchId] = useState<Id<"studioBranches"> | null>(
    null,
  );

  const sortedBranches = useMemo(() => {
    return [...(branches ?? [])].sort((left, right) => {
      if (left.isPrimary && !right.isPrimary) return -1;
      if (!left.isPrimary && right.isPrimary) return 1;
      if (left.status === "active" && right.status === "archived") return -1;
      if (left.status === "archived" && right.status === "active") return 1;
      return left.name.localeCompare(right.name);
    });
  }, [branches]);

  const primaryBranch = useMemo(
    () => sortedBranches.find((branch) => branch.isPrimary) ?? null,
    [sortedBranches],
  );

  const matchingZones = useMemo(() => {
    const normalizedQuery = zoneQuery.trim().toLowerCase();
    const sorted = [...ZONE_OPTIONS].sort((left, right) =>
      left.label[zoneLanguage].localeCompare(right.label[zoneLanguage]),
    );
    if (!normalizedQuery) {
      return sorted.slice(0, 10);
    }
    return sorted
      .filter((zone) => {
        const values = [zone.id, zone.label.en, zone.label.he];
        return values.some((value) => value.toLowerCase().includes(normalizedQuery));
      })
      .slice(0, 10);
  }, [zoneLanguage, zoneQuery]);

  const canCreateBranch = useMemo(() => {
    if (!entitlement) return false;
    if (!entitlement.branchesFeatureEnabled) return false;
    return entitlement.activeBranchCount < entitlement.maxBranches;
  }, [entitlement]);

  const resetEditor = () => {
    setMode(null);
    setEditingBranchId(null);
    setForm(buildBranchFormState(null, primaryBranch));
    setZoneQuery("");
  };

  const startCreate = () => {
    setErrorMessage(null);
    setStatusMessage(null);
    setMode("create");
    setEditingBranchId(null);
    setForm(buildBranchFormState(null, primaryBranch));
    setZoneQuery("");
  };

  const startEdit = (branch: StudioBranchRecord) => {
    setErrorMessage(null);
    setStatusMessage(null);
    setMode("edit");
    setEditingBranchId(branch.branchId);
    setForm(buildBranchFormState(branch, primaryBranch));
    setZoneQuery("");
  };

  const handleSave = async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    setIsSaving(true);

    try {
      if (mode === "create") {
        const created = await createBranch({
          name: form.name,
          address: form.address,
          zone: form.zone,
          ...omitUndefined({
            contactPhone: form.contactPhone.trim() || undefined,
            autoExpireMinutesBefore: form.autoExpireMinutesBefore,
            autoAcceptDefault: form.autoAcceptDefault,
          }),
        });

        await updateBranchCalendarSettings({
          branchId: created.branchId,
          calendarProvider: form.calendarProvider,
          calendarSyncEnabled: form.calendarSyncEnabled,
        });

        setStatusMessage(t("profile.settings.branches.created"));
        resetEditor();
        return;
      }

      if (mode === "edit" && editingBranchId) {
        await updateBranch({
          branchId: editingBranchId,
          name: form.name,
          address: form.address,
          zone: form.zone,
          ...omitUndefined({
            contactPhone: form.contactPhone.trim() || undefined,
            autoExpireMinutesBefore: form.autoExpireMinutesBefore,
            autoAcceptDefault: form.autoAcceptDefault,
          }),
        });

        await updateBranchCalendarSettings({
          branchId: editingBranchId,
          calendarProvider: form.calendarProvider,
          calendarSyncEnabled: form.calendarSyncEnabled,
        });

        setStatusMessage(t("profile.settings.branches.updated"));
        resetEditor();
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("profile.settings.errors.saveFailed"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const confirmSetPrimary = (branch: StudioBranchRecord) => {
    Alert.alert(
      t("profile.settings.branches.makePrimaryTitle"),
      t("profile.settings.branches.makePrimaryBody", { name: branch.name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("profile.settings.branches.makePrimaryAction"),
          onPress: () => {
            setPendingPrimaryBranchId(branch.branchId);
            setErrorMessage(null);
            setStatusMessage(null);
            void setPrimaryBranch({ branchId: branch.branchId })
              .then(() => {
                setStatusMessage(t("profile.settings.branches.primaryUpdated"));
              })
              .catch((error) => {
                setErrorMessage(
                  error instanceof Error ? error.message : t("profile.settings.errors.saveFailed"),
                );
              })
              .finally(() => {
                setPendingPrimaryBranchId(null);
              });
          },
        },
      ],
    );
  };

  const confirmArchive = (branch: StudioBranchRecord) => {
    Alert.alert(
      t("profile.settings.branches.archiveTitle"),
      t("profile.settings.branches.archiveBody", { name: branch.name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("profile.settings.branches.archiveAction"),
          style: "destructive",
          onPress: () => {
            setPendingArchiveBranchId(branch.branchId);
            setErrorMessage(null);
            setStatusMessage(null);
            void archiveBranch({ branchId: branch.branchId })
              .then(() => {
                setStatusMessage(t("profile.settings.branches.archived"));
                if (editingBranchId === branch.branchId) {
                  resetEditor();
                }
              })
              .catch((error) => {
                setErrorMessage(
                  error instanceof Error ? error.message : t("profile.settings.errors.saveFailed"),
                );
              })
              .finally(() => {
                setPendingArchiveBranchId(null);
              });
          },
        },
      ],
    );
  };

  if (currentUser === undefined || (currentUser?.role === "studio" && branches === undefined)) {
    return <LoadingScreen label={t("profile.settings.loading")} />;
  }

  if (currentUser?.role !== "studio") {
    return <LoadingScreen label={t("profile.settings.unavailable")} />;
  }

  if (entitlement === undefined) {
    return <LoadingScreen label={t("profile.settings.loading")} />;
  }

  return (
    <ProfileSubpageScrollView
      routeKey="studio/profile/branches"
      style={{ flex: 1, backgroundColor: palette.appBg }}
      contentContainerStyle={{ gap: BrandSpacing.lg }}
      topSpacing={BrandSpacing.lg}
      bottomSpacing={BrandSpacing.xxl}
    >
      <Box style={styles.content}>
        {errorMessage ? (
          <NoticeBanner
            tone="error"
            message={errorMessage}
            onDismiss={() => setErrorMessage(null)}
            borderColor={palette.danger}
            backgroundColor={palette.dangerSubtle}
            textColor={palette.danger}
            iconColor={palette.danger}
          />
        ) : null}
        {statusMessage ? (
          <NoticeBanner
            tone="success"
            message={statusMessage}
            onDismiss={() => setStatusMessage(null)}
            borderColor={palette.success}
            backgroundColor={palette.successSubtle}
            textColor={palette.text}
            iconColor={palette.success}
          />
        ) : null}

        <ProfileSectionHeader
          label={t("profile.sections.branches")}
          description={t("profile.sections.branchesDesc")}
          icon="building.2.fill"
        />
        <ProfileSectionCard>
          <ProfileSettingRow
            title={t("profile.settings.branches.primaryTitle")}
            subtitle={primaryBranch?.name ?? t("profile.settings.branches.none")}
            icon="building.2.fill"
            showDivider
          />
          <ProfileSettingRow
            title={t("profile.settings.branches.capacityTitle")}
            subtitle={t("profile.settings.branches.capacityBody", {
              active: entitlement.activeBranchCount,
              max: entitlement.maxBranches,
            })}
            icon="square.stack.3d.up.fill"
            showDivider
          />
          <ProfileSettingRow
            title={t("profile.settings.branches.planTitle")}
            subtitle={t(`profile.settings.branches.plan.${entitlement.planKey}`)}
            icon="sparkles"
          />
        </ProfileSectionCard>

        <Box style={styles.actionRow}>
          <ActionButton
            label={t("profile.settings.branches.addAction")}
            onPress={startCreate}
            icon={<IconSymbol name="plus" size={16} color={palette.onPrimary} />}
            disabled={!canCreateBranch}
          />
          {!canCreateBranch ? (
            <ThemedText type="micro" style={{ color: palette.textMuted, flex: 1 }}>
              {entitlement.branchesFeatureEnabled
                ? t("profile.settings.branches.limitReached")
                : t("profile.settings.branches.upgradeRequired")}
            </ThemedText>
          ) : null}
        </Box>

        {mode ? (
          <ProfileSectionCard style={styles.editorCard}>
            <Box style={styles.sectionCardContent}>
              <Box style={styles.editorHeader}>
                <Box style={styles.labelContainer}>
                  <ThemedText type="title">
                    {mode === "create"
                      ? t("profile.settings.branches.createTitle")
                      : t("profile.settings.branches.editTitle")}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: palette.textMuted }}>
                    {t("profile.settings.branches.editorHint")}
                  </ThemedText>
                </Box>
                <ActionButton label={t("common.cancel")} onPress={resetEditor} tone="secondary" />
              </Box>

              <KitTextField
                label={t("profile.settings.branches.fields.name")}
                value={form.name}
                onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
                placeholder={t("profile.settings.branches.placeholders.name")}
              />
              <KitTextField
                label={t("common.address")}
                value={form.address}
                onChangeText={(value) => setForm((current) => ({ ...current, address: value }))}
                placeholder={t("profile.settings.branches.placeholders.address")}
              />
              <KitTextField
                label={t("profile.editor.contactPhoneLabel")}
                value={form.contactPhone}
                onChangeText={(value) =>
                  setForm((current) => ({ ...current, contactPhone: value }))
                }
                placeholder={t("profile.editor.contactPhonePlaceholder")}
                keyboardType="phone-pad"
              />

              <Box style={styles.gapSm}>
                <ThemedText type="bodyStrong">
                  {t("profile.settings.branches.fields.zone")}
                </ThemedText>
                <KitTextField
                  value={zoneQuery}
                  onChangeText={setZoneQuery}
                  placeholder={t("profile.settings.branches.zoneSearchPlaceholder")}
                  helperText={
                    form.zone
                      ? t("profile.settings.branches.zoneSelected", {
                          zone: getZoneLabel(form.zone, zoneLanguage),
                        })
                      : t("profile.settings.branches.zoneHint")
                  }
                />
                <Box style={styles.zoneList}>
                  {matchingZones.map((zone) => {
                    const selected = form.zone === zone.id;
                    return (
                      <ChoicePill
                        key={zone.id}
                        label={zone.label[zoneLanguage]}
                        selected={selected}
                        compact
                        onPress={() => setForm((current) => ({ ...current, zone: zone.id }))}
                        backgroundColor={palette.surfaceElevated}
                        labelColor={palette.text}
                      />
                    );
                  })}
                </Box>
              </Box>

              <Box style={styles.gapSm}>
                <ThemedText type="bodyStrong">{t("profile.settings.autoExpireJobs")}</ThemedText>
                <Box style={styles.pillWrap}>
                  {EXPIRY_OVERRIDE_PRESETS.map((minutes) => (
                    <ChoicePill
                      key={minutes}
                      label={t("jobsTab.form.minutes", { value: minutes })}
                      selected={form.autoExpireMinutesBefore === minutes}
                      compact
                      onPress={() =>
                        setForm((current) => ({
                          ...current,
                          autoExpireMinutesBefore: minutes,
                        }))
                      }
                      backgroundColor={palette.surfaceElevated}
                      labelColor={palette.text}
                    />
                  ))}
                </Box>
              </Box>

              <Box style={styles.switchRow}>
                <Box style={styles.flex1GapXs}>
                  <ThemedText type="bodyStrong" style={{ color: palette.text }}>
                    {t("profile.settings.autoAcceptJobs")}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: palette.textMuted }}>
                    {t("profile.settings.branches.autoAcceptHint")}
                  </ThemedText>
                </Box>
                <KitSwitch
                  value={form.autoAcceptDefault}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, autoAcceptDefault: value }))
                  }
                />
              </Box>

              <Box style={styles.gapSm}>
                <ThemedText type="bodyStrong">
                  {t("profile.settings.branches.calendarTitle")}
                </ThemedText>
                <Box style={styles.pillWrap}>
                  {(["none", "google", "apple"] as const).map((provider) => (
                    <ChoicePill
                      key={provider}
                      label={t(`profile.settings.calendar.provider.${provider}`)}
                      selected={form.calendarProvider === provider}
                      compact
                      onPress={() =>
                        setForm((current) => ({
                          ...current,
                          calendarProvider: provider,
                          calendarSyncEnabled:
                            provider === "none" ? false : current.calendarSyncEnabled,
                        }))
                      }
                      backgroundColor={palette.surfaceElevated}
                      labelColor={palette.text}
                    />
                  ))}
                </Box>
                <Box style={styles.switchRow}>
                  <Box style={styles.flex1GapXs}>
                    <ThemedText type="bodyStrong" style={{ color: palette.text }}>
                      {t("profile.settings.calendar.autoSync")}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: palette.textMuted }}>
                      {t("profile.settings.branches.calendarHint")}
                    </ThemedText>
                  </Box>
                  <KitSwitch
                    disabled={form.calendarProvider === "none"}
                    value={form.calendarSyncEnabled}
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, calendarSyncEnabled: value }))
                    }
                  />
                </Box>
              </Box>

              <ActionButton
                label={
                  isSaving
                    ? t("profile.settings.actions.saving")
                    : mode === "create"
                      ? t("profile.settings.branches.createAction")
                      : t("profile.settings.branches.saveAction")
                }
                onPress={() => {
                  void handleSave();
                }}
                disabled={isSaving || !form.name.trim() || !form.address.trim() || !form.zone}
                loading={isSaving}
                fullWidth
              />
            </Box>
          </ProfileSectionCard>
        ) : null}

        <ProfileSectionHeader
          label={t("profile.settings.branches.listTitle")}
          description={t("profile.settings.branches.listBody")}
          icon="list.bullet.rectangle.portrait.fill"
        />

        <Box style={styles.branchStack}>
          {sortedBranches.map((branch) => {
            const canArchive = !branch.isPrimary && branch.status === "active";
            const canPromote = !branch.isPrimary && branch.status === "active";
            return (
              <ProfileSectionCard key={String(branch.branchId)} style={styles.branchCard}>
                <Box style={styles.sectionCardContent}>
                  <Box style={styles.branchHeader}>
                    <Box style={styles.flex1GapXs}>
                      <Box style={styles.badgeRow}>
                        <ThemedText type="title">{branch.name}</ThemedText>
                        {branch.isPrimary ? (
                          <Box style={[styles.badge, { backgroundColor: palette.primarySubtle }]}>
                            <ThemedText type="micro" style={{ color: palette.primary }}>
                              {t("profile.settings.branches.primaryBadge")}
                            </ThemedText>
                          </Box>
                        ) : null}
                        <Box
                          style={[
                            styles.badge,
                            {
                              backgroundColor:
                                branch.status === "active"
                                  ? palette.successSubtle
                                  : palette.surfaceAlt,
                            },
                          ]}
                        >
                          <ThemedText
                            type="micro"
                            style={{
                              color:
                                branch.status === "active" ? palette.success : palette.textMuted,
                            }}
                          >
                            {branch.status === "active"
                              ? t("profile.settings.branches.activeBadge")
                              : t("profile.settings.branches.archivedBadge")}
                          </ThemedText>
                        </Box>
                      </Box>
                      <ThemedText type="caption" style={{ color: palette.textMuted }}>
                        {branch.address}
                      </ThemedText>
                    </Box>
                  </Box>

                  <Box style={styles.metaGrid}>
                    <Box style={styles.metaItem}>
                      <ThemedText type="micro" style={{ color: palette.textMuted }}>
                        {t("profile.settings.coverageZone")}
                      </ThemedText>
                      <ThemedText type="bodyMedium" style={{ color: palette.text }}>
                        {getZoneLabel(branch.zone, zoneLanguage)}
                      </ThemedText>
                    </Box>
                    <Box style={styles.metaItem}>
                      <ThemedText type="micro" style={{ color: palette.textMuted }}>
                        {t("profile.settings.autoExpireJobs")}
                      </ThemedText>
                      <ThemedText type="bodyMedium" style={{ color: palette.text }}>
                        {t("jobsTab.form.minutes", { value: branch.autoExpireMinutesBefore ?? 30 })}
                      </ThemedText>
                    </Box>
                    <Box style={styles.metaItem}>
                      <ThemedText type="micro" style={{ color: palette.textMuted }}>
                        {t("profile.settings.autoAcceptJobs")}
                      </ThemedText>
                      <ThemedText type="bodyMedium" style={{ color: palette.text }}>
                        {branch.autoAcceptDefault
                          ? t("profile.settings.branches.enabled")
                          : t("profile.settings.branches.disabled")}
                      </ThemedText>
                    </Box>
                    <Box style={styles.metaItem}>
                      <ThemedText type="micro" style={{ color: palette.textMuted }}>
                        {t("profile.settings.calendar.title")}
                      </ThemedText>
                      <ThemedText type="bodyMedium" style={{ color: palette.text }}>
                        {t(
                          `profile.settings.calendar.provider.${branch.calendarProvider ?? "none"}`,
                        )}
                      </ThemedText>
                    </Box>
                  </Box>

                  <Box style={styles.buttonRow}>
                    <ActionButton
                      label={t("common.edit")}
                      onPress={() => startEdit(branch)}
                      tone="secondary"
                    />
                    {canPromote ? (
                      <ActionButton
                        label={
                          pendingPrimaryBranchId === branch.branchId
                            ? t("profile.settings.actions.saving")
                            : t("profile.settings.branches.makePrimaryAction")
                        }
                        onPress={() => confirmSetPrimary(branch)}
                        tone="secondary"
                        disabled={pendingPrimaryBranchId !== null}
                      />
                    ) : null}
                    {canArchive ? (
                      <ActionButton
                        label={
                          pendingArchiveBranchId === branch.branchId
                            ? t("profile.settings.actions.saving")
                            : t("profile.settings.branches.archiveAction")
                        }
                        onPress={() => confirmArchive(branch)}
                        tone="secondary"
                        disabled={pendingArchiveBranchId !== null}
                      />
                    ) : null}
                  </Box>
                </Box>
              </ProfileSectionCard>
            );
          })}
        </Box>
      </Box>
    </ProfileSubpageScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: BrandSpacing.lg,
    paddingHorizontal: BrandSpacing.inset,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.md,
  },
  sectionCardContent: {
    gap: BrandSpacing.md,
  },
  editorCard: {
    marginHorizontal: 0,
    padding: BrandSpacing.lg,
  },
  editorHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: BrandSpacing.md,
  },
  zoneList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandSpacing.sm,
  },
  pillWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandSpacing.sm,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: BrandSpacing.md,
  },
  branchStack: {
    gap: BrandSpacing.md,
  },
  branchCard: {
    marginHorizontal: 0,
    padding: BrandSpacing.lg,
  },
  branchHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: BrandSpacing.md,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: BrandSpacing.sm,
  },
  badge: {
    borderRadius: BrandRadius.pill,
    borderCurve: "continuous",
    paddingHorizontal: BrandSpacing.stackDense,
    paddingVertical: BrandSpacing.xs,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandSpacing.md,
  },
  metaItem: {
    minWidth: 140,
    flexGrow: 1,
    gap: BrandSpacing.xs,
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BrandSpacing.sm,
  },
  // Extracted reusable inline styles
  flex1GapXs: {
    flex: 1,
    gap: BrandSpacing.xs,
  },
  labelContainer: {
    flex: 1,
    gap: BrandSpacing.xs,
  },
  gapSm: {
    gap: BrandSpacing.sm,
  },
});
