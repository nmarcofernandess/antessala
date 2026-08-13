import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const DEFAULT_TOOL_SERVER_PORT = 17380
export const DEFAULT_TOOL_SERVER_HOST = '127.0.0.1'
export const TOOL_SERVER_AUTH_HEADER = 'x-flowkit-tool-token'
export const TOOL_SERVER_AUTH_ENV = 'FLOWKIT_TOOL_SERVER_TOKEN'
export const TOOL_SERVER_AUTH_FILE_ENV = 'FLOWKIT_TOOL_SERVER_TOKEN_FILE'

export function resolveToolServerPort(env: Record<string, string | undefined> = process.env): number {
  const raw = env.FLOWKIT_TOOL_SERVER_PORT?.trim()
  if (!raw) return DEFAULT_TOOL_SERVER_PORT
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65_535
    ? parsed
    : DEFAULT_TOOL_SERVER_PORT
}

export function resolveToolServerUrl(env: Record<string, string | undefined> = process.env): string {
  const explicit = env.FLOWKIT_TOOL_SERVER?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  return `http://${DEFAULT_TOOL_SERVER_HOST}:${resolveToolServerPort(env)}`
}

export function resolveToolServerAuthFile(
  env: Record<string, string | undefined> = process.env,
  port = resolveToolServerPort(env),
): string {
  const explicit = env[TOOL_SERVER_AUTH_FILE_ENV]?.trim()
  if (explicit) return explicit
  const userId = typeof process.getuid === 'function'
    ? String(process.getuid())
    : (env.USERNAME || env.USER || 'default')
  return path.join(os.tmpdir(), `flowkit-tool-server-${userId}-${port}.token`)
}

export function readToolServerAuthToken(env: Record<string, string | undefined> = process.env): string {
  const explicit = env[TOOL_SERVER_AUTH_ENV]?.trim()
  if (explicit) return explicit

  try {
    return fs.readFileSync(resolveToolServerAuthFile(env), 'utf-8').trim()
  } catch {
    return ''
  }
}

export function buildToolServerAuthHeaders(
  env: Record<string, string | undefined> = process.env,
): Record<string, string> {
  const token = readToolServerAuthToken(env)
  return token ? { [TOOL_SERVER_AUTH_HEADER]: token } : {}
}
