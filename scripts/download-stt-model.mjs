import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = process.cwd()
const MODEL_ID = 'parakeet-tdt-0.6b-v3-int8'
const MODEL_URL = 'https://blob.handy.computer/parakeet-v3-int8.tar.gz'
const MODEL_DIR = path.join(ROOT, 'models', 'stt', MODEL_ID)
const REQUIRED_FILES = [
  'config.json',
  'decoder_joint-model.int8.onnx',
  'encoder-model.int8.onnx',
  'nemo128.onnx',
  'vocab.txt',
]

function hasModel() {
  return REQUIRED_FILES.every((file) => fs.existsSync(path.join(MODEL_DIR, file)))
}

function download(url, destination) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http
    const request = client.get(url, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume()
        download(new URL(response.headers.location, url).toString(), destination).then(resolve, reject)
        return
      }

      if (response.statusCode !== 200) {
        response.resume()
        reject(new Error(`Download falhou: HTTP ${response.statusCode}`))
        return
      }

      const file = fs.createWriteStream(destination)
      response.pipe(file)
      file.on('finish', () => file.close(resolve))
      file.on('error', reject)
    })
    request.on('error', reject)
  })
}

function windowsForwardSlashPath(filePath) {
  return path.resolve(filePath).replace(/\\/g, '/')
}

function msysPath(filePath) {
  const normalized = windowsForwardSlashPath(filePath)
  const match = normalized.match(/^([A-Za-z]):\/(.*)$/)
  if (!match) {
    return normalized
  }

  return `/${match[1].toLowerCase()}/${match[2]}`
}

function uniqueTarAttempts(attempts) {
  const seen = new Set()
  return attempts.filter(([archive, destination]) => {
    const key = `${archive}\0${destination}`
    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function buildTarAttempts(archive, destination) {
  if (process.platform !== 'win32') {
    return [[archive, destination]]
  }

  return uniqueTarAttempts([
    [windowsForwardSlashPath(archive), windowsForwardSlashPath(destination)],
    [msysPath(archive), msysPath(destination)],
  ])
}

function extractTarGzip(archive, destination) {
  let lastStatus = null
  let lastError = null

  for (const [archiveArg, destinationArg] of buildTarAttempts(archive, destination)) {
    const tar = spawnSync('tar', ['-xzf', archiveArg, '-C', destinationArg], {
      stdio: 'inherit',
    })

    lastStatus = tar.status
    lastError = tar.error ?? null
    if (tar.status === 0) {
      return
    }

    if (tar.error) {
      console.warn(`tar failed to start: ${tar.error.message}`)
    }
  }

  if (lastError) {
    throw lastError
  }

  throw new Error(`tar exited with status ${lastStatus}`)
}

if (hasModel()) {
  console.log(`STT model already present: ${MODEL_DIR}`)
  process.exit(0)
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'antessala-stt-model-'))
const archivePath = path.join(tmpDir, 'parakeet-v3-int8.tar.gz')

try {
  fs.mkdirSync(path.dirname(MODEL_DIR), { recursive: true })
  console.log(`Downloading STT model: ${MODEL_URL}`)
  await download(MODEL_URL, archivePath)

  extractTarGzip(archivePath, path.dirname(MODEL_DIR))

  if (!hasModel()) {
    throw new Error(`STT model extracted without required files at ${MODEL_DIR}`)
  }

  console.log(`STT model ready: ${MODEL_DIR}`)
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true })
}
