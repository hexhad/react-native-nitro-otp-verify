import type { SmsRetrieverEvent } from '../specs/nitro-otp-verify.nitro'

type Handler = (event: SmsRetrieverEvent) => void

const mockNative = {
  isSupported: true,
  getHash: jest.fn(() => ['AbCdEfGhIjK']),
  startOtpListener: jest.fn((_handler: Handler) => Promise.resolve()),
  stopOtpListener: jest.fn(),
}

jest.mock('react-native-nitro-modules', () => ({
  NitroModules: { createHybridObject: () => mockNative },
}))

const lastHandler = (): Handler =>
  mockNative.startOtpListener.mock.calls.at(-1)![0] as Handler

type Lib = typeof import('../index') &
  Pick<
    typeof import('@testing-library/react-native/pure'),
    'act' | 'renderHook' | 'cleanup'
  >

let current: Lib | undefined

// Fresh module registry per test so the module-level caches reset. React and the
// testing library must come from the same registry as the hook.
function setOS(os: 'android' | 'ios') {
  Object.defineProperty(require('react-native').Platform, 'OS', {
    configurable: true,
    get: () => os,
  })
}

function load(os: 'android' | 'ios' = 'android'): Lib {
  let lib!: Lib
  // react-native's `Platform` export is a lazy getter that re-requires on access, so
  // renders outside isolateModules resolve it from the main registry: set both.
  setOS(os)
  jest.isolateModules(() => {
    setOS(os)
    lib = {
      ...require('../index'),
      // `pure` skips auto-registered afterEach hooks, which can't be added inside a test
      ...require('@testing-library/react-native/pure'),
    }
  })
  current = lib
  return lib
}

afterEach(() => {
  current?.cleanup()
  current = undefined
})

beforeEach(() => {
  jest.clearAllMocks()
  mockNative.isSupported = true
})

describe('extractDigits', () => {
  const { extractDigits } = jest.requireActual<typeof import('../index')>(
    '../index'
  )

  it('finds a code of the requested length', () => {
    expect(extractDigits('Your code is 123456', 6)).toBe('123456')
  })

  it('skips numbers of other lengths', () => {
    expect(extractDigits('Ref 1234. Your code is 567890.', 6)).toBe('567890')
  })

  it('does not take a slice of a longer number', () => {
    expect(extractDigits('Call 0771234567', 6)).toBeNull()
  })

  it('handles codes at the start and end of the message', () => {
    expect(extractDigits('4321 is your code', 4)).toBe('4321')
    expect(extractDigits('code:4321', 4)).toBe('4321')
  })
})

describe('useOtpVerify', () => {
  it('starts on mount and exposes the cached hash', () => {
    const { useOtpVerify, renderHook } = load()
    const { result } = renderHook(() => useOtpVerify())
    expect(mockNative.startOtpListener).toHaveBeenCalledTimes(1)
    expect(result.current.isListening).toBe(true)
    expect(result.current.hash).toEqual(['AbCdEfGhIjK'])

    renderHook(() => useOtpVerify())
    expect(mockNative.getHash).toHaveBeenCalledTimes(1)
  })

  it('extracts the otp from a received SMS', () => {
    const { useOtpVerify, renderHook, act } = load()
    const { result } = renderHook(() => useOtpVerify({ numberOfDigits: 4 }))
    act(() =>
      lastHandler()({ status: 'received', message: 'Code 9876\nAbCdEfGhIjK' })
    )
    expect(result.current.otp).toBe('9876')
    expect(result.current.message).toBe('Code 9876\nAbCdEfGhIjK')
    expect(result.current.isListening).toBe(false)
  })

  it('uses a custom extractOtp', () => {
    const { useOtpVerify, renderHook, act } = load()
    const { result } = renderHook(() =>
      useOtpVerify({ extractOtp: (m) => m.split(':')[1] ?? null })
    )
    act(() => lastHandler()({ status: 'received', message: 'otp:AB12' }))
    expect(result.current.otp).toBe('AB12')
  })

  it('reports timeout and error events', () => {
    const { useOtpVerify, renderHook, act } = load()
    const { result } = renderHook(() => useOtpVerify())
    act(() => lastHandler()({ status: 'timeout' }))
    expect(result.current.timeoutError).toBe(true)

    act(() => result.current.startListener())
    expect(result.current.timeoutError).toBe(false)
    act(() => lastHandler()({ status: 'error', error: 'API_NOT_CONNECTED' }))
    expect(result.current.error).toBe('API_NOT_CONNECTED')
  })

  it('ignores events from a stopped session', () => {
    const { useOtpVerify, renderHook, act } = load()
    const { result } = renderHook(() => useOtpVerify())
    const stale = lastHandler()
    act(() => result.current.stopListener())
    expect(mockNative.stopOtpListener).toHaveBeenCalledTimes(1)
    act(() => stale({ status: 'received', message: '123456' }))
    expect(result.current.otp).toBeNull()
  })

  it('does not start twice while listening', () => {
    const { useOtpVerify, renderHook, act } = load()
    const { result } = renderHook(() => useOtpVerify())
    act(() => result.current.startListener())
    expect(mockNative.startOtpListener).toHaveBeenCalledTimes(1)
  })

  it('surfaces a rejected start', async () => {
    mockNative.startOtpListener.mockImplementationOnce(() =>
      Promise.reject(new Error('Play services missing'))
    )
    const { useOtpVerify, renderHook, act } = load()
    const { result } = renderHook(() => useOtpVerify())
    await act(async () => {})
    expect(result.current.error).toBe('Play services missing')
    expect(result.current.isListening).toBe(false)
  })

  it('stops on unmount', () => {
    const { useOtpVerify, renderHook } = load()
    const { unmount } = renderHook(() => useOtpVerify())
    unmount()
    expect(mockNative.stopOtpListener).toHaveBeenCalledTimes(1)
  })

  it('respects autoStart: false', () => {
    const { useOtpVerify, renderHook } = load()
    renderHook(() => useOtpVerify({ autoStart: false }))
    expect(mockNative.startOtpListener).not.toHaveBeenCalled()
  })

  it('reports unsupported devices without starting', () => {
    mockNative.isSupported = false
    const { useOtpVerify, renderHook } = load()
    const { result } = renderHook(() => useOtpVerify())
    expect(mockNative.startOtpListener).not.toHaveBeenCalled()
    expect(result.current.isSupported).toBe(false)
    expect(result.current.error).toMatch(/Play services/)
  })

  it('is a no-op on iOS', () => {
    const { useOtpVerify, renderHook } = load('ios')
    const { result } = renderHook(() => useOtpVerify())
    expect(mockNative.startOtpListener).not.toHaveBeenCalled()
    expect(result.current.hash).toBeNull()
    expect(result.current.error).toBeNull()
  })
})
