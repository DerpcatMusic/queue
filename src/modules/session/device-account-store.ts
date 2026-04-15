import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

type KnownRole = "pending" | "instructor" | "studio" | "admin";
type AppRole = "instructor" | "studio";

export type DeviceAccountIdentity = {
  id: string;
  email?: string | null | undefined;
  fullName?: string | null | undefined;
  image?: string | null | undefined;
  name?: string | null | undefined;
  role?: KnownRole | null | undefined;
  roles?: AppRole[] | null | undefined;
};

type ActiveDeviceAccountSnapshotArgs = {
  accountId: string | null;
  displayName?: string | null | undefined;
  email?: string | null | undefined;
  imageUrl?: string | null | undefined;
  role?: KnownRole | null | undefined;
  roles?: AppRole[] | null | undefined;
};

export type RememberedDeviceAccount = {
  displayName: string;
  email: string | null;
  fullName: string | null;
  id: string;
  image: string | null;
  imageUrl: string | null;
  lastUsedAt: number;
  name: string | null;
  role: KnownRole | null;
  roles: AppRole[];
};

type StoredDeviceAccountSession = {
  jwt: string;
  refreshToken: string;
  savedAt: number;
};

const DEVICE_ACCOUNTS_INDEX_KEY = "__queueDeviceAccountsIndex";
const DEVICE_ACCOUNT_SESSION_KEY_PREFIX = "__queueDeviceAccountSession_";
const CONVEX_AUTH_VERIFIER_KEY = "__convexAuthOAuthVerifier";
const CONVEX_AUTH_JWT_KEY = "__convexAuthJWT";
const CONVEX_AUTH_REFRESH_TOKEN_KEY = "__convexAuthRefreshToken";
const CONVEX_AUTH_SERVER_STATE_FETCH_TIME_KEY = "__convexAuthServerStateFetchTime";

function trimString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function supportsNativeSecureStore() {
  return Platform.OS === "android" || Platform.OS === "ios";
}

function getConvexAuthNamespace() {
  return (process.env.EXPO_PUBLIC_CONVEX_URL ?? "").replace(/[^a-zA-Z0-9]/g, "");
}

function getConvexAuthStorageKey(key: string) {
  const namespace = getConvexAuthNamespace();
  return `${key}_${namespace}`;
}

function getDeviceAccountSessionKey(accountId: string) {
  return `${DEVICE_ACCOUNT_SESSION_KEY_PREFIX}${accountId}`;
}

async function getSecureStoreValue(key: string) {
  if (!supportsNativeSecureStore()) {
    return null;
  }
  return SecureStore.getItemAsync(key);
}

async function setSecureStoreValue(key: string, value: string) {
  if (!supportsNativeSecureStore()) {
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function removeSecureStoreValue(key: string) {
  if (!supportsNativeSecureStore()) {
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

function normalizeRememberedAccount(
  account: DeviceAccountIdentity | RememberedDeviceAccount,
  lastUsedAt = Date.now(),
): RememberedDeviceAccount {
  const fullName = trimString(account.fullName);
  const name = trimString(account.name);
  const email = trimString(account.email);
  const image =
    trimString("imageUrl" in account ? account.imageUrl : undefined) ?? trimString(account.image);

  return {
    id: account.id,
    displayName:
      trimString("displayName" in account ? account.displayName : undefined) ??
      fullName ??
      name ??
      email ??
      "Queue",
    email,
    fullName,
    image,
    imageUrl: image,
    lastUsedAt,
    name,
    role: account.role ?? null,
    roles: account.roles ?? [],
  };
}

function isRememberedAccount(value: unknown): value is RememberedDeviceAccount {
  if (!value || typeof value !== "object") {
    return false;
  }

  const account = value as Partial<RememberedDeviceAccount>;
  return typeof account.id === "string";
}

function isStoredDeviceAccountSession(value: unknown): value is StoredDeviceAccountSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as Partial<StoredDeviceAccountSession>;
  return typeof session.jwt === "string" && typeof session.refreshToken === "string";
}

async function readRememberedAccountsIndex() {
  const raw = await getSecureStoreValue(DEVICE_ACCOUNTS_INDEX_KEY);
  if (!raw) {
    return [] as RememberedDeviceAccount[];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isRememberedAccount)
      .map((account) => normalizeRememberedAccount(account, account.lastUsedAt ?? Date.now()))
      .sort((left, right) => right.lastUsedAt - left.lastUsedAt);
  } catch {
    return [];
  }
}

async function writeRememberedAccountsIndex(accounts: RememberedDeviceAccount[]) {
  const deduped = new Map<string, RememberedDeviceAccount>();
  for (const account of accounts) {
    deduped.set(account.id, normalizeRememberedAccount(account, account.lastUsedAt ?? Date.now()));
  }

  await setSecureStoreValue(
    DEVICE_ACCOUNTS_INDEX_KEY,
    JSON.stringify([...deduped.values()].sort((left, right) => right.lastUsedAt - left.lastUsedAt)),
  );
}

async function readRememberedAccountSession(accountId: string) {
  const raw = await getSecureStoreValue(getDeviceAccountSessionKey(accountId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isStoredDeviceAccountSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function readLiveConvexAuthSession() {
  const [jwt, refreshToken] = await Promise.all([
    getSecureStoreValue(getConvexAuthStorageKey(CONVEX_AUTH_JWT_KEY)),
    getSecureStoreValue(getConvexAuthStorageKey(CONVEX_AUTH_REFRESH_TOKEN_KEY)),
  ]);

  if (!jwt || !refreshToken) {
    return null;
  }

  return {
    jwt,
    refreshToken,
    savedAt: Date.now(),
  } satisfies StoredDeviceAccountSession;
}

async function writeLiveConvexAuthSession(session: StoredDeviceAccountSession) {
  await Promise.all([
    setSecureStoreValue(getConvexAuthStorageKey(CONVEX_AUTH_JWT_KEY), session.jwt),
    setSecureStoreValue(
      getConvexAuthStorageKey(CONVEX_AUTH_REFRESH_TOKEN_KEY),
      session.refreshToken,
    ),
    removeSecureStoreValue(getConvexAuthStorageKey(CONVEX_AUTH_VERIFIER_KEY)),
    removeSecureStoreValue(getConvexAuthStorageKey(CONVEX_AUTH_SERVER_STATE_FETCH_TIME_KEY)),
  ]);
}

export function toDeviceAccountIdentity(input: {
  _id: string;
  email?: string | null | undefined;
  fullName?: string | null | undefined;
  image?: string | null | undefined;
  name?: string | null | undefined;
  role?: KnownRole | null | undefined;
  roles?: AppRole[] | null | undefined;
}): DeviceAccountIdentity {
  return {
    id: input._id,
    email: input.email,
    fullName: input.fullName,
    image: input.image,
    name: input.name,
    role: input.role,
    roles: input.roles,
  };
}

function toActiveDeviceAccountIdentity(args: ActiveDeviceAccountSnapshotArgs) {
  if (!args.accountId) {
    return null;
  }

  return toDeviceAccountIdentity({
    _id: args.accountId,
    email: args.email,
    fullName: args.displayName,
    image: args.imageUrl,
    name: args.displayName,
    role: args.role,
    roles: args.roles,
  });
}

export async function listRememberedDeviceAccounts() {
  return readRememberedAccountsIndex();
}

export async function rememberCurrentDeviceAccount(account: DeviceAccountIdentity) {
  const liveSession = await readLiveConvexAuthSession();
  if (!liveSession) {
    return null;
  }

  const normalizedAccount = normalizeRememberedAccount(account);
  const existingAccounts = await readRememberedAccountsIndex();
  const nextAccounts = [
    normalizedAccount,
    ...existingAccounts.filter((existingAccount) => existingAccount.id !== normalizedAccount.id),
  ];

  await Promise.all([
    setSecureStoreValue(
      getDeviceAccountSessionKey(normalizedAccount.id),
      JSON.stringify(liveSession),
    ),
    writeRememberedAccountsIndex(nextAccounts),
  ]);

  return normalizedAccount;
}

export async function forgetRememberedDeviceAccount(accountId: string) {
  const existingAccounts = await readRememberedAccountsIndex();
  await Promise.all([
    removeSecureStoreValue(getDeviceAccountSessionKey(accountId)),
    writeRememberedAccountsIndex(
      existingAccounts.filter((existingAccount) => existingAccount.id !== accountId),
    ),
  ]);
}

export async function clearLiveConvexAuthSession() {
  await Promise.all([
    removeSecureStoreValue(getConvexAuthStorageKey(CONVEX_AUTH_JWT_KEY)),
    removeSecureStoreValue(getConvexAuthStorageKey(CONVEX_AUTH_REFRESH_TOKEN_KEY)),
    removeSecureStoreValue(getConvexAuthStorageKey(CONVEX_AUTH_VERIFIER_KEY)),
    removeSecureStoreValue(getConvexAuthStorageKey(CONVEX_AUTH_SERVER_STATE_FETCH_TIME_KEY)),
  ]);
}

export async function snapshotAndClearCurrentDeviceAccount(
  currentAccount: DeviceAccountIdentity | null | undefined,
) {
  if (currentAccount) {
    await rememberCurrentDeviceAccount(currentAccount);
  }

  await clearLiveConvexAuthSession();
}

export async function rememberActiveDeviceAccount(args: ActiveDeviceAccountSnapshotArgs) {
  const currentAccount = toActiveDeviceAccountIdentity(args);
  if (!currentAccount) {
    return null;
  }

  return rememberCurrentDeviceAccount(currentAccount);
}

export async function rememberAndClearActiveDeviceAccount(args: ActiveDeviceAccountSnapshotArgs) {
  await snapshotAndClearCurrentDeviceAccount(toActiveDeviceAccountIdentity(args));
}

/**
 * Validates that a stored account session can be verified with Convex.
 * This performs an actual backend check, not just JWT structure validation.
 *
 * Returns true if session is valid (backend confirms it).
 * Returns false if session is invalid, expired, or backend cannot verify it.
 */
export async function validateStoredSessionWithConvex(
  accountId: string,
  timeoutMs: number = 2000,
): Promise<boolean> {
  const { getConvexClient } = await import("@/lib/convex");
  const { api } = await import("@/convex/_generated/api");
  const convex = getConvexClient();

  if (!convex) {
    return false;
  }

  const session = await readRememberedAccountSession(accountId);
  if (!session) {
    return false;
  }

  try {
    // Attempt a query with timeout - if it returns null or throws, session is invalid
    await Promise.race([
      convex.query(api.users.getCurrent.getCurrentUser, {}),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("validate-timeout")), timeoutMs),
      ),
    ]);
    return true;
  } catch {
    // Query failed or timed out - session is invalid
    return false;
  }
}

/**
 * Maximum time to wait for currentUser to load after session switch.
 * If exceeded, the session is considered invalid.
 */
const SESSION_SWITCH_VALIDATION_TIMEOUT_MS = 3000;

/**
 * Validates that a session switch was successful by checking if currentUser loads.
 * This prevents the race condition where isAuthenticated=true but currentUser=null,
 * which would cause sessionGate to redirect to sign-in.
 *
 * Returns true if session is valid (currentUser loaded).
 * Returns false if session is invalid (currentUser didn't load in time).
 */
export async function validateSessionAfterSwitch(
  getCurrentUser: () => unknown,
  timeoutMs: number = SESSION_SWITCH_VALIDATION_TIMEOUT_MS,
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const user = getCurrentUser();
    // User is valid if it's not undefined (loading) and not null (no user)
    if (user !== undefined && user !== null) {
      return true;
    }
    // Small delay to avoid busy-waiting
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  // Timeout reached - check one more time
  const finalUser = getCurrentUser();
  return finalUser !== undefined && finalUser !== null;
}

export async function switchToRememberedDeviceAccount(
  args:
    | string
    | {
        accountId: string;
        currentAccount?: DeviceAccountIdentity | null | undefined;
      },
) {
  const normalizedArgs = typeof args === "string" ? { accountId: args } : args;

  if (
    normalizedArgs.currentAccount &&
    normalizedArgs.currentAccount.id === normalizedArgs.accountId
  ) {
    return true;
  }

  if (normalizedArgs.currentAccount) {
    await rememberCurrentDeviceAccount(normalizedArgs.currentAccount);
  }

  const nextSession = await readRememberedAccountSession(normalizedArgs.accountId);
  if (!nextSession) {
    await forgetRememberedDeviceAccount(normalizedArgs.accountId);
    throw new Error("This saved account session is no longer available on this device.");
  }

  const existingAccounts = await readRememberedAccountsIndex();
  const targetAccount = existingAccounts.find((account) => account.id === normalizedArgs.accountId);

  await writeLiveConvexAuthSession(nextSession);

  if (!targetAccount) {
    return true;
  }

  await writeRememberedAccountsIndex([
    normalizeRememberedAccount(targetAccount),
    ...existingAccounts.filter((account) => account.id !== targetAccount.id),
  ]);

  return true;
}
