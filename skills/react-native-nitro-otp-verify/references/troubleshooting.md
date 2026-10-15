# Troubleshooting

## The OTP never arrives (no `received`, eventually `timeoutError`)

Check in order:

1. **Hash mismatch** — by far the most common cause. The SMS must contain the hash of the **exact build installed** (debug vs release vs Play App Signing differ). Compare `hash[0]` on the device with the SMS.
2. **Listener started too late** — call `startListener()` *before* the backend sends the SMS. SMS received before the session started are not delivered.
3. **Message too long** — over 140 bytes is silently dropped.
4. **Session already ended** — one SMS per session; call `startListener()` again for resend.
5. **No Play services** — `isSupported === false` (Huawei/AOSP devices, emulators without Google APIs). Provide manual entry.

## Timeout arrives too early after a restart

Fixed in 0.2: Play services keeps the previous session's 5-minute timer running after a restart, and its stale `TIMEOUT` used to end the new session. The native side now ignores timeouts that arrive before the current session's own window.

## Works in debug, fails in production

Play App Signing re-signs the APK/AAB. Use the hash from the **app signing key** (see `sms-format-and-hash.md`). Debug and upload-key hashes will not match production installs.

## `error` is set right away

- `Google Play services is not available` — device has no (or an outdated) Play services.
- A Play services status string (e.g. `API_NOT_CONNECTED`) — usually a transient Play services issue; offer retry.
- `startOtpListener` promise rejection — Play services refused to start; message is in `error`.

## Release build crashes on first call (R8)

Versions ≥ 0.2 ship consumer ProGuard rules. If you see `NoSuchMethodError`/`<init>` stripped for `HybridNitroOtpVerify`, make sure you are not overriding consumer rules (`-dontusemixedcaseclassnames` etc. are fine) and the package version is current.

## Testing on an emulator

Use a **Google APIs / Google Play** system image, then send an SMS through the emulator console:

```bash
adb emu sms send 5551234 "Your code is 123456 <YOUR_HASH>"
```

The hook should report `otp === '123456'` within a few seconds.

## Nothing happens on iOS

Expected. iOS has no SMS API; the module is a no-op. Use `textContentType="oneTimeCode"`.
