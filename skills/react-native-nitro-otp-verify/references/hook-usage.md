# `useOtpVerify` hook

Source: `src/useOtpVerify.ts`

```ts
import { useOtpVerify } from 'react-native-nitro-otp-verify'

const {
  otp,           // string | null — extracted code
  message,       // string | null — full SMS text
  hash,          // string[] | null — 11-char app hash(es); null on iOS
  timeoutError,  // boolean — 5 minutes passed with no matching SMS
  error,         // string | null — Play services failure / unsupported device
  isSupported,   // boolean — false on iOS or without Play services
  isListening,   // boolean
  startListener, // () => void — start / restart (idempotent while listening)
  stopListener,  // () => void — stop (idempotent)
} = useOtpVerify({
  numberOfDigits: 6,  // default 6
  autoStart: true,    // default true — start on mount
  extractOtp: undefined, // optional (message: string) => string | null
})
```

## Behaviour

- Listening starts on mount (unless `autoStart: false`) and stops on unmount.
- Each `startListener()` resets `otp`, `message`, `timeoutError` and `error`.
- A session ends after one result. `isListening` becomes `false`.
- `hash` and `isSupported` are read **synchronously** once per app process (cached), so they are available on the first render — no loading state.
- Options are read through a ref: passing an inline `extractOtp` does not restart the listener.
- Events from a stopped/replaced session are ignored, so a late SMS can't overwrite a newer state.

## Default code extraction

`extractDigits(message, numberOfDigits)` (exported) returns the **first standalone** run of exactly `numberOfDigits` digits:

| SMS | `numberOfDigits` | result |
|---|---|---|
| `Ref 4821. Your code is 739104 AbCdEfGhIjK` | 6 | `739104` |
| `Call 0771234567` | 6 | `null` (no slicing of longer numbers) |

Use `extractOtp` for alphanumeric codes or unusual formats:

```ts
useOtpVerify({ extractOtp: (m) => m.match(/code: ([A-Z0-9]{6})/)?.[1] ?? null })
```

## Resend code

```tsx
const { otp, timeoutError, error, isListening, startListener } = useOtpVerify()

const resend = async () => {
  startListener()          // listen first
  await api.sendOtpSms()   // then ask the backend to send
}

{(timeoutError || error) && <Button title="Resend code" onPress={resend} />}
```

## Manual start (request SMS on button press)

```tsx
const { startListener } = useOtpVerify({ autoStart: false })

const onSendCode = async () => {
  startListener()
  await api.sendOtpSms(phone)
}
```

## iOS

Hook values are inert on iOS (`isSupported: false`, `hash: null`, `startListener` no-op). Make sure the input has `textContentType="oneTimeCode"` so iOS offers the code from the QuickType bar.
