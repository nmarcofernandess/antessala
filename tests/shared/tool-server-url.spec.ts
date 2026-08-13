import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { TOOL_SERVER_AUTH_FILE_ENV, resolveToolServerAuthFile } from '../../src/shared/tool-server-url'

describe('tool server URL/auth helpers', () => {
  it('scopes the default auth token file by server port', () => {
    const defaultPath = resolveToolServerAuthFile({ FLOWKIT_TOOL_SERVER_PORT: '17380' })
    const isolatedPath = resolveToolServerAuthFile({}, 0)

    expect(path.basename(defaultPath)).toMatch(/-17380\.token$/)
    expect(path.basename(isolatedPath)).toMatch(/-0\.token$/)
    expect(defaultPath).not.toBe(isolatedPath)
  })

  it('honors an explicit token file path', () => {
    const explicit = '/tmp/flowkit-explicit-token'

    expect(resolveToolServerAuthFile({ [TOOL_SERVER_AUTH_FILE_ENV]: explicit }, 17380)).toBe(explicit)
  })
})
