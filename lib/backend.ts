export type { AuthSession, AuthUser, OAuthProvider, ProfileSyncEvent, SignUpResult } from "@/lib/auth/types"

export {
  clearLocalSession,
  completeOAuth,
  ensureOAuthProvider,
  getCurrentAccessToken,
  getCurrentUser,
  getOAuthNext,
  getOAuthProviders,
  getValidAccessToken,
  isTwoFactorChallenge,
  refreshSession,
  resendVerificationEmail,
  retryUserProfileSync,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  startOAuth,
  syncAuthenticatedUserFromCurrentSession,
  verifyEmailCode,
  verifyTwoFactorChallenge,
} from "@/lib/auth/client"
