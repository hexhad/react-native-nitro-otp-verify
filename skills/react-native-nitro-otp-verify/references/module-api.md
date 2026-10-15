# `NitroOtpVerify` module

Sources:
- Spec: `src/specs/nitro-otp-verify.nitro.ts`
- Android: `android/src/main/java/com/nitrootpverify/HybridNitroOtpVerify.kt`
- iOS: `ios/HybridNitroOtpVerify.swift` (no-op)

Use the module directly only outside React components, or when the hook doesn't fit. Prefer `useOtpVerify`.

```ts
import {
  NitroOtpVerify,
  extractDigits,
  type SmsRetrieverEvent,
  type SmsRetrieverStatus, // 'received' | 'timeout' | 'error'
} from 'react-native-nitro-otp-verify'

NitroOtpVerify.isSupported // boolean (sync) — false on iOS / without Play services
NitroOtpVerify.getHash()   // string[] (sync, cached natively) — [] on iOS

await NitroOtpVerify.startOtpListener((event: SmsRetrieverEvent) => {
  switch (event.status) {
    case 'received': handle(extractDigits(event.message!, 6)); break
    case 'timeout':  /* 5 minutes elapsed */ break
    case 'error':    console.warn(event.error); break
  }
})

NitroOtpVerify.stopOtpListener() // sync, idempotent
```

## Contract

- **The handler is called at most once per `startOtpListener` call.** The native side unregisters itself afterwards.
- **Calling `startOtpListener` again** stops any previous session first (no leaked receivers).
- **The returned promise rejects** if Play services refuses to start the session. It resolves once listening has started, not when the SMS arrives.
- `getHash()` and `isSupported` are synchronous JSI calls (no Promise / bridge hop). They are computed once and cached natively.

## Android internals

These matter when debugging:

- The broadcast receiver is registered with `RECEIVER_EXPORTED` **and** `SmsRetriever.SEND_PERMISSION`. Exported is required because Play services (another app) sends the broadcast; the permission means only Play services can deliver it, so other apps can't inject fake OTPs.
- The receiver is registered *before* `startSmsRetriever()` so an instantly-delivered SMS can't be missed.
- `getHash()` hashes `"<packageName> <signing certificate>"` with SHA-256, base64, first 11 chars — one entry per signer.
- Consumer ProGuard rules keep `com.nitrootpverify.**`: Nitro constructs the class from C++ via JNI, which R8 can't see. No extra rules are needed in the app.

## Migration from 0.1.x

| 0.1.x | 0.2+ |
|---|---|
| `await NitroOtpVerify.getHash()` | `NitroOtpVerify.getHash()` (sync) |
| `startOtpListener((sms: string) => …)` | `startOtpListener((event) => event.status === 'received' && event.message)` |
| `await NitroOtpVerify.stopOtpListener()` | `NitroOtpVerify.stopOtpListener()` (sync) |
| `requestHint()` (always returned `''`) | removed |

The `useOtpVerify` hook is backwards compatible; it only gained fields and options.
