import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { NitroOtpVerify } from './NitroOtpVerify'
import type { SmsRetrieverEvent } from './specs/nitro-otp-verify.nitro'

// Native sends TIMEOUT after 5 minutes; this is only a backstop
const BACKSTOP_TIMEOUT_MS = 5 * 60 * 1000 + 10 * 1000

export interface UseOtpVerifyOptions {
  /** Length of the code to extract from the SMS. Defaults to 6. */
  numberOfDigits?: number
  /** Start listening on mount. Defaults to `true`. */
  autoStart?: boolean
  /** Custom code extraction from the full SMS text. */
  extractOtp?: (message: string) => string | null
}

export interface UseOtpVerifyResult {
  /** The extracted code, or `null` until an SMS arrives. */
  otp: string | null
  /** The full SMS text. */
  message: string | null
  /** The app's 11-character SMS Retriever hash(es). `null` on iOS. */
  hash: string[] | null
  /** No matching SMS arrived within 5 minutes. */
  timeoutError: boolean
  /** Play services failed to start or deliver the session. */
  error: string | null
  /** `false` on iOS, or on Android devices without Google Play services. */
  isSupported: boolean
  isListening: boolean
  startListener: () => void
  stopListener: () => void
}

/**
 * Returns the first standalone run of exactly `numberOfDigits` digits in
 * `message`, or `null`.
 */
export function extractDigits(message: string, numberOfDigits: number) {
  const match = message.match(
    new RegExp(`(?:^|\\D)(\\d{${numberOfDigits}})(?!\\d)`)
  )
  return match?.[1] ?? null
}

// Both values are fixed for the process lifetime, so cross the JSI boundary once
let supportedCache: boolean | undefined
function getIsSupported() {
  if (supportedCache === undefined) {
    supportedCache = Platform.OS === 'android' && NitroOtpVerify.isSupported
  }
  return supportedCache
}

let hashCache: string[] | null | undefined
function getHash() {
  if (hashCache === undefined) {
    hashCache = Platform.OS === 'android' ? NitroOtpVerify.getHash() : null
  }
  return hashCache
}

export function useOtpVerify({
  numberOfDigits = 6,
  autoStart = true,
  extractOtp,
}: UseOtpVerifyOptions = {}): UseOtpVerifyResult {
  const [otp, setOtp] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [timeoutError, setTimeoutError] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSupported] = useState(getIsSupported)
  const [hash] = useState(getHash)
  const [isListening, setIsListening] = useState(false)

  // Options in a ref so inline callbacks don't restart the listener
  const optionsRef = useRef({ numberOfDigits, extractOtp })
  optionsRef.current = { numberOfDigits, extractOtp }

  // Increments per session so late events from a stopped session are ignored
  const sessionRef = useRef(0)
  const isListeningRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearBackstop = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  const stopListener = useCallback(() => {
    if (!isListeningRef.current) return
    isListeningRef.current = false
    setIsListening(false)
    sessionRef.current++
    clearBackstop()
    NitroOtpVerify.stopOtpListener()
  }, [])

  const startListener = useCallback(() => {
    if (Platform.OS !== 'android') return
    if (isListeningRef.current) return
    if (!getIsSupported()) {
      setError('Google Play services is not available')
      return
    }

    const session = ++sessionRef.current
    isListeningRef.current = true
    setIsListening(true)
    setOtp(null)
    setMessage(null)
    setTimeoutError(false)
    setError(null)

    const endSession = () => {
      isListeningRef.current = false
      setIsListening(false)
      clearBackstop()
    }

    const onEvent = (event: SmsRetrieverEvent) => {
      if (session !== sessionRef.current) return
      endSession()
      switch (event.status) {
        case 'received': {
          const sms = event.message ?? ''
          const { numberOfDigits: digits, extractOtp: extract } =
            optionsRef.current
          setMessage(sms)
          setOtp(extract ? extract(sms) : extractDigits(sms, digits))
          break
        }
        case 'timeout':
          setTimeoutError(true)
          break
        case 'error':
          setError(event.error ?? 'Unknown error')
          break
      }
    }

    NitroOtpVerify.startOtpListener(onEvent).catch((err: Error) => {
      if (session !== sessionRef.current) return
      endSession()
      setError(err.message)
    })

    timeoutRef.current = setTimeout(() => {
      if (session !== sessionRef.current || !isListeningRef.current) return
      setTimeoutError(true)
      stopListener()
    }, BACKSTOP_TIMEOUT_MS)
  }, [stopListener])

  useEffect(() => {
    if (autoStart) startListener()
    return () => stopListener()
  }, [autoStart, startListener, stopListener])

  return {
    otp,
    message,
    hash,
    timeoutError,
    error,
    isSupported,
    isListening,
    startListener,
    stopListener,
  }
}
