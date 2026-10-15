import type { HybridObject } from 'react-native-nitro-modules'

/**
 * Outcome of one SMS Retriever session.
 * - `received`: an SMS containing the app hash arrived — `message` holds its full text
 * - `timeout`: no matching SMS arrived within the 5-minute window
 * - `error`: Play services reported a failure — see `error`
 */
export type SmsRetrieverStatus = 'received' | 'timeout' | 'error'

export interface SmsRetrieverEvent {
  status: SmsRetrieverStatus
  message?: string
  error?: string
}

export interface NitroOtpVerify extends HybridObject<{
  ios: 'swift'
  android: 'kotlin'
}> {
  /** `false` on iOS, or on Android devices without Google Play services. */
  readonly isSupported: boolean
  /**
   * The 11-character SMS Retriever app hash(es) for the current signing key.
   * Computed once natively and cached. Empty on iOS.
   */
  getHash(): string[]
  /**
   * Starts a one-shot SMS Retriever session (Android). `handler` is called at
   * most once per session. Calling it again replaces the previous session.
   * Resolves once listening has started. No-op on iOS.
   */
  startOtpListener(handler: (event: SmsRetrieverEvent) => void): Promise<void>
  /** Stops the current session. Idempotent. */
  stopOtpListener(): void
}
