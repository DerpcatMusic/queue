export type PostSignOutAuthIntent = "sign-in" | "sign-up";

let pendingPostSignOutAuthIntent: PostSignOutAuthIntent | null = null;

export function setPendingPostSignOutAuthIntent(intent: PostSignOutAuthIntent) {
  pendingPostSignOutAuthIntent = intent;
}

export function clearPendingPostSignOutAuthIntent() {
  pendingPostSignOutAuthIntent = null;
}

export function consumePendingPostSignOutAuthIntent() {
  const intent = pendingPostSignOutAuthIntent;
  pendingPostSignOutAuthIntent = null;
  return intent;
}
