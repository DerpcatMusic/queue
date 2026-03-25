export type PostSignOutAuthIntent = "sign-in" | "sign-up";
export type PostSignOutAuthMethod = "apple" | "code" | "magic-link" | "google";

export type PostSignOutAuthHandoff = {
  email?: string | null;
  intent?: PostSignOutAuthIntent | null;
  method?: PostSignOutAuthMethod | null;
  allowPath?: string | null;
  restoreAccountId?: string | null;
};

let pendingPostSignOutAuthHandoff: PostSignOutAuthHandoff | null = null;

export function setPendingPostSignOutAuthHandoff(handoff: PostSignOutAuthHandoff) {
  pendingPostSignOutAuthHandoff = handoff;
}

export function clearPendingPostSignOutAuthIntent() {
  pendingPostSignOutAuthHandoff = null;
}

export function consumePendingPostSignOutAuthHandoff() {
  const handoff = pendingPostSignOutAuthHandoff;
  pendingPostSignOutAuthHandoff = null;
  return handoff;
}

export function peekPendingPostSignOutAuthHandoff() {
  return pendingPostSignOutAuthHandoff;
}
