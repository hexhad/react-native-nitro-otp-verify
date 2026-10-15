import Foundation
import NitroModules

// iOS has no API for apps to read SMS. One-time codes are offered by the system
// QuickType bar on inputs with `textContentType="oneTimeCode"`, so this is a no-op.
class HybridNitroOtpVerify: HybridNitroOtpVerifySpec {

    var isSupported: Bool { false }

    func getHash() throws -> [String] {
        return []
    }

    func startOtpListener(handler: @escaping (SmsRetrieverEvent) -> Void) throws -> Promise<Void> {
        return Promise.resolved()
    }

    func stopOtpListener() throws {}
}
