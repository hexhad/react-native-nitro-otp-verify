# react-native-nitro-otp-verify

> Automatic OTP/SMS reading for Android, built on [Nitro Modules](https://nitro.margelo.com) for synchronous JSI performance.

[![Version](https://img.shields.io/npm/v/react-native-nitro-otp-verify.svg)](https://www.npmjs.com/package/react-native-nitro-otp-verify)
[![Downloads](https://img.shields.io/npm/dm/react-native-nitro-otp-verify.svg)](https://www.npmjs.com/package/react-native-nitro-otp-verify)
[![License](https://img.shields.io/npm/l/react-native-nitro-otp-verify.svg)](https://github.com/hashan/react-native-nitro-otp-verify/blob/main/LICENSE)

---

## Features

- 📩 Auto-reads OTP from incoming SMS on Android
- ⚡ Built with Nitro Modules — no bridge overhead
- 🔑 Computes your app's 11-char SMS Retriever hash
- ⏱️ Built-in timeout detection
- 🪝 Simple `useOtpVerify` hook — drop in and go
- 🍎 iOS-safe — no-ops on iOS, no crashes

---

## Requirements

|                              | Minimum |
| ---------------------------- | ------- |
| React Native                 | 0.76.0  |
| Node                         | 18.0.0  |
| Android                      | API 23+ |
| `react-native-nitro-modules` | 0.18.0+ |

---

## Installation

```sh
npm install react-native-nitro-otp-verify react-native-nitro-modules
# or
yarn add react-native-nitro-otp-verify react-native-nitro-modules
# or
bun add react-native-nitro-otp-verify react-native-nitro-modules
```

No extra setup needed. Play Services is included automatically.

---

## Usage

### Hook

```js
import { useOtpVerify } from 'react-native-nitro-otp-verify'

export default function OtpScreen() {
  const { otp, hash, timeoutError, startListener, stopListener } = useOtpVerify(
    {
      numberOfDigits: 6,
    }
  )

  return (
    <View>
      <Text>App Hash: {hash?.[0]}</Text>
      <TextInput value={otp ?? ''} placeholder="Waiting for OTP..." />
      {timeoutError && <Text>Timeout — no SMS received</Text>}
      <Button title="Restart" onPress={startListener} />
    </View>
  )
}
```

### Hook API

```ts
const {
  otp, // string | null — extracted OTP digits
  message, // string | null — full raw SMS message
  hash, // string[] | null — your app's 11-char hash(es)
  timeoutError, // boolean — true if 5 min passed with no SMS
  startListener, // () => void — start/restart listening
  stopListener, // () => void — stop listening manually
} = useOtpVerify({ numberOfDigits: 6 })
```

---

## SMS Template

Your backend must send an SMS in this exact format for Android to route it to your app:

```
Your OTP is 123456.

<#> YourAppName
<YOUR_11_CHAR_HASH>
```

Get your 11-char hash from the `hash` value returned by the hook and pass it to your backend SMS template.

---

## How it works

1. On mount, `useOtpVerify` calls `getHash()` to retrieve your app's SMS Retriever hash
2. `startOtpListener()` registers Android's `SmsRetriever` broadcast receiver — **no READ_SMS permission required**
3. When an SMS arrives containing your hash, Android delivers it directly to your app
4. The OTP digits are extracted and returned via the `otp` state
5. The listener auto-stops after receiving an OTP or after a 5-minute timeout

---

## Module API

If you need direct access beyond the hook:

```ts
import { NitroOtpVerify } from 'react-native-nitro-otp-verify'

// Get app hash for your SMS template
const hash = await NitroOtpVerify.getHash()

// Start listening
await NitroOtpVerify.startOtpListener((smsMessage) => {
  console.log('SMS received:', smsMessage)
})

// Stop listening
await NitroOtpVerify.stopOtpListener()
```

---

## Permissions

No special permissions required. This library uses the [SMS Retriever API](https://developers.google.com/identity/sms-retriever/overview) which does **not** require `READ_SMS` or `RECEIVE_SMS`.

---

## Platform Support

| Platform | Status                       |
| -------- | ---------------------------- |
| Android  | ✅ Fully supported           |
| iOS      | 🚧 No-op stubs (coming soon) |

---

## Credits

Bootstrapped with [create-nitro-module](https://github.com/patrickkabwe/create-nitro-module).

---

## Contributing

Pull requests are welcome. For major changes please open an issue first to discuss what you would like to change.

1. Fork the repo
2. Create your branch: `git checkout -b feat/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push and open a PR

---

## License

MIT
