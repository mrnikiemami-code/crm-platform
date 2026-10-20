/**
 * External support chat is intentionally not bootstrapped.
 *
 * BI-01 replaces Front chat as a Help path with the same-origin `/help` centre.
 * Loading `chat-assets.frontapp.com` (or any other third-party chat SDK) from
 * here would re-introduce outbound Help traffic and intercept support clicks.
 *
 * The hook keeps its previous return shape so `SupportChatEffect` and any
 * callers continue to compile, but it never inserts a script and never calls
 * `window.FrontChat`.
 */
export const useInstantiateSupportChat = () => {
  return { isFrontChatLoaded: false };
};
