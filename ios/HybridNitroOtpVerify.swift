import Foundation

class HybridNitroOtpVerify: HybridNitroOtpVerifySpec {

    func getHash() throws -> Promise<[String]> {
        return Promise.resolved([])
    }

    func requestHint() throws -> Promise<String> {
        return Promise.resolved("")
    }

    func startOtpListener(handler: @escaping (String) -> Void) throws -> Promise<Void> {
        return Promise.resolved(())
    }

    func stopOtpListener() throws -> Promise<Void> {
        return Promise.resolved(())
    }
}
