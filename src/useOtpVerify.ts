import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { NitroOtpVerify } from './index'

const LISTENER_TIMEOUT_MS = 5 * 60 * 1000

interface UseOtpVerifyOptions {
  numberOfDigits?: number
}

interface UseOtpVerifyResult {
  otp: string | null
  message: string | null
  hash: string[] | null
  timeoutError: boolean
  startListener: () => void
  stopListener: () => void
}

export function useOtpVerify({
  numberOfDigits = 6,
}: UseOtpVerifyOptions = {}): UseOtpVerifyResult {
  const [otp, setOtp] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [hash, setHash] = useState<string[] | null>(null)
  const [timeoutError, setTimeoutError] = useState(false)

  const isListeningRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopListener = useCallback(() => {
    if (!isListeningRef.current) return
    isListeningRef.current = false
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    NitroOtpVerify.stopOtpListener().catch(() => {})
  }, [])

  const startListener = useCallback(() => {
    if (Platform.OS === 'ios') return
    if (isListeningRef.current) return

    isListeningRef.current = true
    setOtp(null)
    setMessage(null)
    setTimeoutError(false)

    NitroOtpVerify.startOtpListener((smsMessage: string) => {
      if (!isListeningRef.current) return
      setMessage(smsMessage)
      const digits = smsMessage.match(/\b(\d{4,8})\b/)?.[0] ?? null
      if (digits && digits.length === numberOfDigits) {
        setOtp(digits)
        stopListener()
      }
    }).catch((err: Error) => {
      setMessage(err.message)
      isListeningRef.current = false
    })

    timeoutRef.current = setTimeout(() => {
      if (isListeningRef.current) {
        setTimeoutError(true)
        stopListener()
      }
    }, LISTENER_TIMEOUT_MS)
  }, [numberOfDigits, stopListener])

  useEffect(() => {
    NitroOtpVerify.getHash()
      .then(setHash)
      .catch(() => {})
  }, [])

  useEffect(() => {
    startListener()
    return () => stopListener()
  }, [startListener, stopListener])

  return { otp, message, hash, timeoutError, startListener, stopListener }
}
