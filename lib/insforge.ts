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
  refreshSession,
  resendVerificationEmail,
  retryUserProfileSync,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  startOAuth,
  syncAuthenticatedUserFromCurrentSession,
  verifyEmailCode,
} from "@/lib/auth/client"
