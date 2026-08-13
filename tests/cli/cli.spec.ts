import { describe, it, expect } from 'vitest'
import { execFile, execSync } from 'node:child_process'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const CLI_CMD = 'npx tsx src/cli/index.ts'
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const EXEC_OPTS = { timeout: 10_000, encoding: 'utf-8' as const, cwd: REPO_ROOT }
const TSX_BIN = path.join(REPO_ROOT, 'node_modules/.bin/tsx')
const execFileAsync = promisify(execFile)

describe('CLI entry point', () => {
  it('--help shows available commands (chat, search, status, tools)', () => {
    const output = execSync(`${CLI_CMD} --help`, EXEC_OPTS)
    expect(output).toContain('chat')
    expect(output).toContain('search')
    expect(output).toContain('status')
    expect(output).toContain('tools')
  })

  it('rag import help shows bulk import flags', () => {
    const output = execSync(`${CLI_CMD} rag import --help`, EXEC_OPTS)
    expect(output).toContain('--group')
    expect(output).toContain('--wait')
    expect(output).toContain('--enrich')
    expect(output).toContain('--no-enrich')
  })

  it('terminal help shows harness commands', () => {
    const output = execSync(`${CLI_CMD} terminal --help`, EXEC_OPTS)
    expect(output).toContain('exec')
    expect(output).toContain('read')
    expect(output).toContain('write')
  })

  it('mcp config emits the configured tool-server URL', async () => {
    const { stdout } = await execFileAsync(TSX_BIN, ['src/cli/index.ts', 'mcp', 'config'], {
      ...EXEC_OPTS,
      env: {
        ...process.env,
        FLOWKIT_TOOL_SERVER: 'http://127.0.0.1:19999',
      },
    })
    const parsed = JSON.parse(stdout)

    expect(parsed.mcpServers.flowkit.env.FLOWKIT_TOOL_SERVER).toBe('http://127.0.0.1:19999')
  })

  it('--version returns without crashing', () => {
    let output: string
    try {
      output = execSync(`${CLI_CMD} --version`, EXEC_OPTS)
    } catch (err: any) {
      // commander may exit(0) which some shells treat as success
      output = err.stdout ?? err.stderr ?? ''
    }
    expect(output).toBeTruthy()
  })

  it('chat aborts with friendly preflight text when IA is not ready', async () => {
    const server = createServer((req, res) => {
      if (req.url === '/chat/preflight') {
        res.writeHead(409, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          status: 'error',
          message: 'Modelo local baixado, mas ainda não foi validado.',
          readiness: {
            ok: false,
            provider: 'local',
            model: 'gemma-4-e2b-it-q4',
            reason: 'validate_local_model',
            message: 'Modelo local baixado, mas ainda não foi validado.',
            action: 'Clique em Testar conexão antes de usar chat ou CLI.',
          },
        }))
        return
      }
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'error', message: 'chat endpoint should not be called' }))
    })

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0

    try {
      await execFileAsync(TSX_BIN, ['src/cli/index.ts', 'chat', 'e ai mano'], {
        ...EXEC_OPTS,
        env: {
          ...process.env,
          FLOWKIT_TOOL_SERVER: `http://127.0.0.1:${port}`,
        },
      })
      throw new Error('CLI should have failed preflight')
    } catch (err: any) {
      const output = `${String(err.stdout ?? '')}${String(err.stderr ?? '')}`
      expect(output).toContain('Erro do FlowKit (409)')
      expect(output).toContain('Modelo local baixado')
      expect(output).toContain('Acao: Clique em Testar conexão')
      expect(output).not.toContain('{"status"')
      expect(output).not.toContain('chat endpoint should not be called')
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it('chat sends the prompt and prints the literal app response when IA is ready', async () => {
    const requests: Array<{ url?: string; body: any }> = []
    const server = createServer((req, res) => {
      if (req.url === '/chat/preflight') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          status: 'ok',
          readiness: {
            ok: true,
            provider: 'local',
            model: 'gemma-4-e2b-it-q4',
            reason: 'ready',
            message: 'IA pronta.',
          },
        }))
        return
      }

      if (req.url === '/chat' && req.method === 'POST') {
        const chunks: Buffer[] = []
        req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
        req.on('end', () => {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'))
          requests.push({ url: req.url, body })
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            status: 'ok',
            response: 'O padeiro contou uma piada e a massa caiu na risada.',
          }))
        })
        return
      }

      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'error', message: 'not found' }))
    })

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0

    try {
      const { stdout } = await execFileAsync(TSX_BIN, ['src/cli/index.ts', 'chat', 'me conta uma piada de padeiro'], {
        ...EXEC_OPTS,
        env: {
          ...process.env,
          FLOWKIT_TOOL_SERVER: `http://127.0.0.1:${port}`,
        },
      })

      expect(stdout).toContain('O padeiro contou uma piada')
      expect(requests).toEqual([{
        url: '/chat',
        body: {
          message: 'me conta uma piada de padeiro',
          history: [],
          context: { page: 'cli', route: '/cli' },
          stream: false,
        },
      }])
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it('terminal exec --wait exits non-zero on timeout results', async () => {
    const server = createServer((req, res) => {
      if (req.url === '/terminal/exec') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          status: 'error',
          result: {
            command: 'sleep 5',
            cwd: REPO_ROOT,
            exit_code: null,
            signal: 'SIGKILL',
            stdout: '',
            stderr: '',
            duration_ms: 100,
            timed_out: true,
          },
        }))
        return
      }
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'error', message: 'not found' }))
    })

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0

    try {
      await execFileAsync(TSX_BIN, ['src/cli/index.ts', 'terminal', 'exec', 'sleep 5', '--wait'], {
        ...EXEC_OPTS,
        env: {
          ...process.env,
          FLOWKIT_TOOL_SERVER: `http://127.0.0.1:${port}`,
        },
      })
      throw new Error('CLI should have exited non-zero on timeout')
    } catch (err: any) {
      const output = `${String(err.stdout ?? '')}${String(err.stderr ?? '')}`
      expect(err.code).toBe(1)
      expect(output).toContain('[timeout]')
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })
})
