import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, StyleSheet, Text, View } from "react-native";
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
import { BrandRadius, BrandSpacing, BrandType } from "@/constants/brand";
import { ZONE_OPTIONS, getZoneLabel } from "@/constants/zones";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useUser } from "@/contexts/user-context";
import { useBrand } from "@/hooks/use-brand";
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
    calendarSyncEnabled:
      branch?.calendarSyncEnabled ?? fallback?.calendarSyncEnabled ?? false,
  };
}

export default function StudioBranchesScreen() {
  const { t, i18n } = useTranslation();
  const palette = useBrand();
  const { currentUser } = useUser();
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
  const [pendingPrimaryBranchId, setPendingPrimaryBranchId] =
    useState<Id<"studioBranches"> | null>(null);
  const [pendingArchiveBranchId, setPendingArchiveBranchId] =
    useState<Id<"studioBranches"> | null>(null);

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
      setErrorMessage(error instanceof Error ? error.message : t("profile.settings.errors.saveFailed"));
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
      style={{ flex: 1, backgroundColor: palette.appBg as string }}
      contentContainerStyle={{ gap: BrandSpacing.lg }}
      topSpacing={BrandSpacing.lg}
      bottomSpacing={BrandSpacing.xxl}
    >
      <View style={styles.content}>
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
          palette={palette}
        />
        <ProfileSectionCard palette={palette}>
          <ProfileSettingRow
            title={t("profile.settings.branches.primaryTitle")}
            subtitle={primaryBranch?.name ?? t("profile.settings.branches.none")}
            icon="building.2.fill"
            palette={palette}
            showDivider
          />
          <ProfileSettingRow
            title={t("profile.settings.branches.capacityTitle")}
            subtitle={t("profile.settings.branches.capacityBody", {
              active: entitlement.activeBranchCount,
              max: entitlement.maxBranches,
            })}
            icon="square.stack.3d.up.fill"
            palette={palette}
            showDivider
          />
          <ProfileSettingRow
            title={t("profile.settings.branches.planTitle")}
            subtitle={t(`profile.settings.branches.plan.${entitlement.planKey}`)}
            icon="sparkles"
            palette={palette}
          />
        </ProfileSectionCard>

        <View style={styles.actionRow}>
          <ActionButton
            label={t("profile.settings.branches.addAction")}
            onPress={startCreate}
            palette={palette}
            icon={<IconSymbol name="plus" size={16} color={palette.onPrimary as string} />}
            disabled={!canCreateBranch}
          />
          {!canCreateBranch ? (
            <ThemedText type="micro" style={{ color: palette.textMuted as string, flex: 1 }}>
              {entitlement.branchesFeatureEnabled
                ? t("profile.settings.branches.limitReached")
                : t("profile.settings.branches.upgradeRequired")}
            </ThemedText>
          ) : null}
        </View>

        {mode ? (
          <ProfileSectionCard palette={palette} style={styles.editorCard}>
            <View style={styles.sectionCardContent}>
              <View style={styles.editorHeader}>
                <View style={{ flex: 1, gap: BrandSpacing.xs }}>
                  <ThemedText type="title">
                    {mode === "create"
                      ? t("profile.settings.branches.createTitle")
                      : t("profile.settings.branches.editTitle")}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: palette.textMuted as string }}>
                    {t("profile.settings.branches.editorHint")}
                  </ThemedText>
                </View>
                <ActionButton
                  label={t("common.cancel")}
                  onPress={resetEditor}
                  palette={palette}
                  tone="secondary"
                />
              </View>

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

              <View style={{ gap: BrandSpacing.sm }}>
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
                <View style={styles.zoneList}>
                  {matchingZones.map((zone) => {
                    const selected = form.zone === zone.id;
                    return (
                      <ChoicePill
                        key={zone.id}
                        label={zone.label[zoneLanguage]}
                        selected={selected}
                        compact
                        onPress={() => setForm((current) => ({ ...current, zone: zone.id }))}
                        backgroundColor={palette.surfaceAlt as string}
                        selectedBackgroundColor={palette.primary as string}
                        labelColor={palette.text as string}
                        selectedLabelColor={palette.onPrimary as string}
                      />
                    );
                  })}
                </View>
              </View>

              <View style={{ gap: BrandSpacing.sm }}>
                <ThemedText type="bodyStrong">{t("profile.settings.autoExpireJobs")}</ThemedText>
                <View style={styles.pillWrap}>
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
                      backgroundColor={palette.surfaceAlt as string}
                      selectedBackgroundColor={palette.primary as string}
                      labelColor={palette.text as string}
                      selectedLabelColor={palette.onPrimary as string}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.switchRow}>
                <View style={{ flex: 1, gap: BrandSpacing.xs }}>
                  <Text style={[BrandType.bodyStrong, { color: palette.text as string }]}>
                    {t("profile.settings.autoAcceptJobs")}
                  </Text>
                  <ThemedText type="caption" style={{ color: palette.textMuted as string }}>
                    {t("profile.settings.branches.autoAcceptHint")}
                  </ThemedText>
                </View>
                <KitSwitch
                  value={form.autoAcceptDefault}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, autoAcceptDefault: value }))
                  }
                />
              </View>

              <View style={{ gap: BrandSpacing.sm }}>
                <ThemedText type="bodyStrong">
                  {t("profile.settings.branches.calendarTitle")}
                </ThemedText>
                <View style={styles.pillWrap}>
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
                      backgroundColor={palette.surfaceAlt as string}
                      selectedBackgroundColor={palette.primary as string}
                      labelColor={palette.text as string}
                      selectedLabelColor={palette.onPrimary as string}
                    />
                  ))}
                </View>
                <View style={styles.switchRow}>
                  <View style={{ flex: 1, gap: BrandSpacing.xs }}>
                    <Text style={[BrandType.bodyStrong, { color: palette.text as string }]}>
                      {t("profile.settings.calendar.autoSync")}
                    </Text>
                    <ThemedText type="caption" style={{ color: palette.textMuted as string }}>
                      {t("profile.settings.branches.calendarHint")}
                    </ThemedText>
                  </View>
                  <KitSwitch
                    disabled={form.calendarProvider === "none"}
                    value={form.calendarSyncEnabled}
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, calendarSyncEnabled: value }))
                    }
                  />
                </View>
              </View>

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
                palette={palette}
                disabled={isSaving || !form.name.trim() || !form.address.trim() || !form.zone}
                loading={isSaving}
                fullWidth
              />
            </View>
          </ProfileSectionCard>
        ) : null}

        <ProfileSectionHeader
          label={t("profile.settings.branches.listTitle")}
          description={t("profile.settings.branches.listBody")}
          icon="list.bullet.rectangle.portrait.fill"
          palette={palette}
        />

        <View style={styles.branchStack}>
          {sortedBranches.map((branch) => {
            const canArchive = !branch.isPrimary && branch.status === "active";
            const canPromote = !branch.isPrimary && branch.status === "active";
            return (
              <ProfileSectionCard
                key={String(branch.branchId)}
                palette={palette}
                style={styles.branchCard}
              >
                <View style={styles.sectionCardContent}>
                  <View style={styles.branchHeader}>
                    <View style={{ flex: 1, gap: BrandSpacing.xs }}>
                      <View style={styles.badgeRow}>
                        <ThemedText type="title">{branch.name}</ThemedText>
                        {branch.isPrimary ? (
                          <View
                            style={[
                              styles.badge,
                              { backgroundColor: palette.primarySubtle as string },
                            ]}
                          >
                            <Text style={[BrandType.micro, { color: palette.primary as string }]}>
                              {t("profile.settings.branches.primaryBadge")}
                            </Text>
                          </View>
                        ) : null}
                        <View
                          style={[
                            styles.badge,
                            {
                              backgroundColor:
                                branch.status === "active"
                                  ? (palette.successSubtle as string)
                                  : (palette.surfaceAlt as string),
                            },
                          ]}
                        >
                          <Text
                            style={[
                              BrandType.micro,
                              {
                                color:
                                  branch.status === "active"
                                    ? (palette.success as string)
                                    : (palette.textMuted as string),
                              },
                            ]}
                          >
                            {branch.status === "active"
                              ? t("profile.settings.branches.activeBadge")
                              : t("profile.settings.branches.archivedBadge")}
                          </Text>
                        </View>
                      </View>
                      <ThemedText type="caption" style={{ color: palette.textMuted as string }}>
                        {branch.address}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.metaGrid}>
                    <View style={styles.metaItem}>
                      <Text style={[BrandType.micro, { color: palette.textMuted as string }]}>
                        {t("profile.settings.coverageZone")}
                      </Text>
                      <Text style={[BrandType.bodyMedium, { color: palette.text as string }]}>
                        {getZoneLabel(branch.zone, zoneLanguage)}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={[BrandType.micro, { color: palette.textMuted as string }]}>
                        {t("profile.settings.autoExpireJobs")}
                      </Text>
                      <Text style={[BrandType.bodyMedium, { color: palette.text as string }]}>
                        {t("jobsTab.form.minutes", { value: branch.autoExpireMinutesBefore ?? 30 })}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={[BrandType.micro, { color: palette.textMuted as string }]}>
                        {t("profile.settings.autoAcceptJobs")}
                      </Text>
                      <Text style={[BrandType.bodyMedium, { color: palette.text as string }]}>
                        {branch.autoAcceptDefault
                          ? t("profile.settings.branches.enabled")
                          : t("profile.settings.branches.disabled")}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={[BrandType.micro, { color: palette.textMuted as string }]}>
                        {t("profile.settings.calendar.title")}
                      </Text>
                      <Text style={[BrandType.bodyMedium, { color: palette.text as string }]}>
                        {t(`profile.settings.calendar.provider.${branch.calendarProvider ?? "none"}`)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.buttonRow}>
                    <ActionButton
                      label={t("common.edit")}
                      onPress={() => startEdit(branch)}
                      palette={palette}
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
                        palette={palette}
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
                        palette={palette}
                        tone="secondary"
                        disabled={pendingArchiveBranchId !== null}
                      />
                    ) : null}
                  </View>
                </View>
              </ProfileSectionCard>
            );
          })}
        </View>
      </View>
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
    paddingHorizontal: BrandSpacing.sm + 2,
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
});
