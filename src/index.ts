import { NitroModules } from 'react-native-nitro-modules'
import type { NitroOtpVerify as NitroOtpVerifySpec } from './specs/nitro-otp-verify.nitro'

export const NitroOtpVerify =
  NitroModules.createHybridObject<NitroOtpVerifySpec>('NitroOtpVerify')