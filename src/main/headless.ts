export function isHeadlessRun(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ANTESSALA_HEADLESS === '1'
}

export function shouldShowMainWindow(env: NodeJS.ProcessEnv = process.env): boolean {
  return !isHeadlessRun(env)
}
