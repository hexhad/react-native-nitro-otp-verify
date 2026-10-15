# SMS format, app hash and iOS autofill

## SMS template (Android)

Google's rules for SMS Retriever delivery:

- No longer than **140 bytes**.
- Contains the one-time code.
- Contains the app's **11-character hash** (anywhere, conventionally on the last line).

```
<#> Your MyApp code is 123456
FA+9qCX9VSu
```

The `<#>` prefix is optional on current Play services but harmless.

## Getting the right hash

The hash is derived from the **package name + signing certificate**, so it differs per signing key:

| Build | Hash source |
|---|---|
| Debug (`debug.keystore`) | `hash` from the hook in a debug build |
| Release signed locally | `hash` from the hook in that release build |
| **Google Play App Signing** | Play re-signs the app — the hash must come from the **Play app signing key**, not your upload key |

Options for production:

1. Log/display `hash` from a build **installed from Play** (internal testing track) and copy it.
2. Compute it from the app signing certificate (download `deployment_cert.der` from Play Console → App integrity):

```bash
PKG=com.your.package

# From the Play app signing certificate (Play Console → App integrity → deployment_cert.der):
HEX=$(xxd -p deployment_cert.der | tr -d '[:space:]')
# …or from a keystore you control:
HEX=$(keytool -exportcert -alias <alias> -keystore <keystore.jks> </dev/null | xxd -p | tr -d '[:space:]')

printf '%s' "$PKG $HEX" | shasum -a 256 | cut -c1-64 | xxd -r -p | base64 | cut -c1-11
```

This matches the value `getHash()` returns on a device signed with that certificate.

Configure the backend per environment (debug / staging / production hash). If an app has multiple signers, `hash` contains one entry per signer.

## iOS

iOS never exposes SMS to apps. Use the system autofill instead:

```tsx
<TextInput
  textContentType="oneTimeCode"   // iOS QuickType suggestion
  autoComplete="sms-otp"          // Android autofill hint
  keyboardType="number-pad"
/>
```

For domain-bound codes (Safari/web credentials) append `@example.com #123456` as the last line — iOS-only, ignored by SMS Retriever.
