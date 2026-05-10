import type { HybridObject } from 'react-native-nitro-modules'

export interface NitroOtpVerify extends HybridObject<{
  ios: 'swift'
  android: 'kotlin'
}> {
  getHash(): Promise<string[]>
  requestHint(): Promise<string>
  startOtpListener(handler: (otp: string) => void): Promise<void>
  stopOtpListener(): Promise<void>
}
