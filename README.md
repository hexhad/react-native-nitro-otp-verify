# react-native-nitro-otp-verify

> Zero-tap OTP/SMS reading for Android via Google's [SMS Retriever API](https://developers.google.com/identity/sms-retriever/overview), built on [Nitro Modules](https://nitro.margelo.com).

[![Version](https://img.shields.io/npm/v/react-native-nitro-otp-verify.svg)](https://www.npmjs.com/package/react-native-nitro-otp-verify)
[![Downloads](https://img.shields.io/npm/dm/react-native-nitro-otp-verify.svg)](https://www.npmjs.com/package/react-native-nitro-otp-verify)
[![CI](https://github.com/hexhad/react-native-nitro-otp-verify/actions/workflows/ci.yml/badge.svg)](https://github.com/hexhad/react-native-nitro-otp-verify/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/react-native-nitro-otp-verify.svg)](https://github.com/hexhad/react-native-nitro-otp-verify/blob/main/LICENSE)

---

## Features

- 📩 Reads the OTP from an incoming SMS automatically — no prompt, no tap
- 🔒 No `READ_SMS` / `RECEIVE_SMS` permissions; only Play services can deliver to the receiver
- ⚡ Nitro Modules: synchronous JSI calls for `getHash()` / `isSupported`, no bridge
- 🔑 Computes your app's 11-character SMS Retriever hash
- ⏱️ Native timeout and error reporting
- 🪝 One `useOtpVerify` hook, or the raw module
- 🍎 Safe no-op on iOS (pair with `textContentType="oneTimeCode"`)
- 🛡️ Ships consumer ProGuard/R8 rules — works in minified release builds

> Prefer a one-tap consent sheet and no app hash? See the sibling package [`react-native-nitro-sms-user-consent`](https://github.com/hexhad/react-native-nitro-sms-user-consent).

---

## Requirements

|                              | Minimum                      |
| ---------------------------- | ---------------------------- |
| React Native                 | 0.76 (New Architecture)      |
| `react-native-nitro-modules` | 0.37                         |
| Android                      | API 23+ with Google Play services |

---

## Installation

```sh
npm install react-native-nitro-otp-verify react-native-nitro-modules
# or
bun add react-native-nitro-otp-verify react-native-nitro-modules
```

Rebuild the native app afterwards (`pod install` on iOS, fresh Gradle build on Android).

---

## Usage

```tsx
import { useOtpVerify } from 'react-native-nitro-otp-verify'

export default function OtpScreen() {
  const { otp, hash, timeoutError, error, startListener } = useOtpVerify({
    numberOfDigits: 6,
  })

  return (
    <View>
      <TextInput
        value={otp ?? ''}
        textContentType="oneTimeCode" // iOS autofill
        autoComplete="sms-otp"
        keyboardType="number-pad"
      />
      {(timeoutError || error) && (
        <Button title="Resend code" onPress={startListener} />
      )}
    </View>
  )
}
```

### Hook API

```ts
const {
  otp, //           string | null   — extracted code
  message, //       string | null   — full SMS text
  hash, //          string[] | null — 11-char app hash(es); null on iOS
  timeoutError, //  boolean         — 5 minutes passed with no SMS
  error, //         string | null   — Play services error / unsupported device
  isSupported, //   boolean         — false on iOS or without Play services
  isListening, //   boolean
  startListener, // () => void      — start / restart
  stopListener, //  () => void
} = useOtpVerify({
  numberOfDigits: 6, // default 6
  autoStart: true, //   default true
  extractOtp: (message) => '…', // optional custom extraction
})
```

The default extraction picks the first standalone run of exactly `numberOfDigits` digits, so `"Ref 4821. Your code is 739104"` yields `739104`. It's also exported as `extractDigits(message, numberOfDigits)`.

### Module API

```ts
import { NitroOtpVerify } from 'react-native-nitro-otp-verify'

NitroOtpVerify.isSupported // boolean (sync)
NitroOtpVerify.getHash() //   string[] (sync, cached)

await NitroOtpVerify.startOtpListener((event) => {
  // event.status: 'received' | 'timeout' | 'error'
  if (event.status === 'received') console.log(event.message)
})

NitroOtpVerify.stopOtpListener() // sync, idempotent
```

The handler fires at most once per session; starting again replaces the previous session.

---

## SMS template

The SMS must be ≤ 140 bytes, contain the code, and contain your app hash:

```
<#> Your MyApp code is 123456
FA+9qCX9VSu
```

⚠️ The hash depends on the **signing key**. Debug, release and **Google Play App Signing** builds all have different hashes — configure the backend with the hash of the build your users install. See [`sms-format-and-hash.md`](./skills/react-native-nitro-otp-verify/references/sms-format-and-hash.md) for computing the production hash from the Play signing certificate.

---

## Testing on an emulator

Use a Google Play / Google APIs system image and send an SMS through the emulator console:

```sh
adb emu sms send 5551234 "Your code is 123456 <YOUR_HASH>"
```

---

## Migrating from 0.1.x

The hook is backwards compatible. Direct module users:

| 0.1.x                                   | 0.2+                                           |
| --------------------------------------- | ---------------------------------------------- |
| `await NitroOtpVerify.getHash()`        | `NitroOtpVerify.getHash()` (sync)              |
| `startOtpListener((sms: string) => …)`  | `startOtpListener((event) => event.message …)` |
| `await NitroOtpVerify.stopOtpListener()` | `NitroOtpVerify.stopOtpListener()` (sync)      |
| `requestHint()`                         | removed (was a stub)                           |

---

## AI agent skill

[`skills/react-native-nitro-otp-verify`](./skills/react-native-nitro-otp-verify/SKILL.md) is an agent skill (Claude Code and other `SKILL.md`-compatible agents). It covers the hook, the module, the SMS template and app hash, and troubleshooting. Install it into `~/.claude/skills/`:

```sh
npx degit hexhad/react-native-nitro-otp-verify/skills/react-native-nitro-otp-verify ~/.claude/skills/react-native-nitro-otp-verify
```

It's also shipped in the npm package under `node_modules/react-native-nitro-otp-verify/skills/`.

---

## Platform support

| Platform | Status                                                   |
| -------- | -------------------------------------------------------- |
| Android  | ✅ Supported                                             |
| iOS      | No-op — iOS has no SMS API; use `textContentType="oneTimeCode"` |

---

## Contributing

Pull requests are welcome. `main` is protected: open a PR, CI (typecheck, tests, build) must pass, and commits follow [Conventional Commits](https://www.conventionalcommits.org) — releases are cut automatically from them.

```sh
bun install
bun run test
bun run build
```

---

## Credits

Bootstrapped with [create-nitro-module](https://github.com/patrickkabwe/create-nitro-module).

## License

MIT
