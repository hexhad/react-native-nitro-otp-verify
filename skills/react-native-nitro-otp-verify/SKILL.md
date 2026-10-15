---
name: react-native-nitro-otp-verify
description: Automatic, zero-tap SMS OTP reading for React Native via Google's SMS Retriever API, built on Nitro Modules — react-native-nitro-otp-verify. Covers the useOtpVerify hook, the NitroOtpVerify module, the 11-character app hash and SMS template, debug vs release / Play App Signing hashes, iOS oneTimeCode autofill, and troubleshooting an OTP that never arrives. Use when implementing OTP / verification-code auto-fill or phone number verification in a React Native app that uses this package.
license: MIT
metadata:
  author: hexhad
  scope: react-native-nitro-otp-verify
  tags: react-native, nitro, otp, sms, sms-retriever, app-hash, verification-code, autofill, android, ios, oneTimeCode
---

# react-native-nitro-otp-verify

A reference for AI coding assistants working in a project that uses `react-native-nitro-otp-verify`. Answer with the real APIs below, not invented ones. Load the matching `references/*.md` file before writing code.

## Mental model

- **Android:** after `startOtpListener`, Google Play services watches incoming SMS for **5 minutes**. An SMS that contains the app's **11-character hash** is delivered straight to the app — no prompt, no tap, no permissions.
  - No `READ_SMS`/`RECEIVE_SMS` permissions are needed (and must not be added).
  - The backend must append the app hash to the SMS. Without it the SMS is never delivered.
- **One message per session.** After `received`, `timeout` or `error` the session ends. Call `startListener()` again for "Resend code".
- **iOS:** apps cannot read SMS, so the module is a **no-op** (`isSupported === false`, `hash === null`). iOS autofill comes from the app's own input having `textContentType="oneTimeCode"`.
- **The library ships no UI.** The app renders its own OTP field and feeds `otp` into it.

## Routing table: problem to reference

| User is asking about… | Read |
|---|---|
| Adding OTP auto-read to a screen, `useOtpVerify` options and return values, resend code, custom code extraction | [`references/hook-usage.md`](./references/hook-usage.md) |
| Calling the native module directly (`NitroOtpVerify.startOtpListener`, `SmsRetrieverEvent`), use outside React | [`references/module-api.md`](./references/module-api.md) |
| SMS template, getting the app hash for release / Play App Signing, iOS autofill | [`references/sms-format-and-hash.md`](./references/sms-format-and-hash.md) |
| The OTP never arrives, works in debug but not production, timeouts, Play services errors, testing on an emulator | [`references/troubleshooting.md`](./references/troubleshooting.md) |

If nothing matches, start with [`references/hook-usage.md`](./references/hook-usage.md).

## Installation

```bash
npm install react-native-nitro-otp-verify react-native-nitro-modules
# or
bun add react-native-nitro-otp-verify react-native-nitro-modules
```

Then rebuild natively: `pod install` for iOS and a fresh Gradle build for Android. A JS reload is not enough.

Requirements:
- React Native New Architecture, 0.76+
- `react-native-nitro-modules` 0.37+
- Android API 23+ with Google Play services

## Minimal example

```tsx
import { useEffect } from 'react'
import { useOtpVerify } from 'react-native-nitro-otp-verify'

function VerifyScreen() {
  const { otp, hash, timeoutError, error, startListener } = useOtpVerify({ numberOfDigits: 6 })

  useEffect(() => {
    if (otp) setCode(otp) // feed the app's own OTP input / submit
  }, [otp])

  // timeoutError || error → show "Resend code" that calls startListener() and re-requests the SMS
}
```

## Rules for assistants

- Never add a TextInput or OTP component to the library. Use the app's existing input.
- Never tell users to add `READ_SMS` / `RECEIVE_SMS`. SMS Retriever needs neither, and Play policy restricts them.
- Never hard-code the debug app hash in backend config for production. The hash depends on the **signing key**; see `references/sms-format-and-hash.md`.
- Don't call `startListener()` on every render. It is idempotent while listening; call it on mount (default) or right before requesting the SMS.
- Start listening **before** the backend sends the SMS.
- Keep `textContentType="oneTimeCode"` (iOS) and `autoComplete="sms-otp"` (Android) on the app's input — they complement this library.
