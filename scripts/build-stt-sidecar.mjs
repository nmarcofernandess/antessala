#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const repoRoot = process.cwd()
const sttDir = path.join(repoRoot, 'stt')
const binaryName = process.platform === 'win32' ? 'antessala-stt.exe' : 'antessala-stt'
const source = path.join(sttDir, 'target', 'release', binaryName)
const outputDir = path.join(repoRoot, 'stt-bin')
const target = path.join(outputDir, binaryName)

const build = spawnSync('cargo', ['build', '--release'], {
  cwd: sttDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (build.status !== 0) {
  process.exit(build.status ?? 1)
}

try {
  const stat = statSync(source)
  if (!stat.isFile()) {
    throw new Error(`STT sidecar build output is not a file: ${source}`)
  }
  mkdirSync(outputDir, { recursive: true })
  copyFileSync(source, target)
  console.log(`[stt] sidecar ready: ${target}`)
} catch (error) {
  console.error(`[stt] failed to prepare sidecar: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
