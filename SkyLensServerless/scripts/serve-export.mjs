import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_PATH = fileURLToPath(import.meta.url)
const SCRIPT_DIR = dirname(SCRIPT_PATH)
const DEFAULT_OUT_DIR = resolve(SCRIPT_DIR, '..', 'out')
const DEFAULT_HOST = process.env.HOST ?? '127.0.0.1'
const DEFAULT_PORT = Number.parseInt(process.env.PORT ?? '3000', 10)

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
}

export function createStaticExportServer({
  outDir = DEFAULT_OUT_DIR,
  headerRules = loadHeaderRules(outDir),
} = {}) {
  return createServer((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' })
      response.end('Method Not Allowed')
      return
    }

    const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? DEFAULT_HOST}`)
    const filePath = resolveRequestPath(requestUrl.pathname, outDir)

    if (!filePath) {
      response.writeHead(404, getHeadersForPath(requestUrl.pathname, headerRules))
      response.end('Not Found')
      return
    }

    const contentType =
      CONTENT_TYPES[extname(filePath)] ??
      'application/octet-stream'
    const fileStat = statSync(filePath)

    response.writeHead(200, {
      ...getHeadersForPath(requestUrl.pathname, headerRules),
      'Content-Length': fileStat.size,
      'Content-Type': contentType,
    })

    if (request.method === 'HEAD') {
      response.end()
      return
    }

    createReadStream(filePath).pipe(response)
  })
}

export function loadHeaderRules(outDir) {
  const headerFilePath = resolve(outDir, '_headers')

  if (!existsSync(headerFilePath)) {
    return []
  }

  const rules = []
  let currentRule = null

  for (const line of readFileSync(headerFilePath, 'utf8').split(/\r?\n/)) {
    if (line.trim().length === 0) {
      continue
    }

    if (!/^\s/.test(line)) {
      if (currentRule && Object.keys(currentRule.headers).length > 0) {
        rules.push(currentRule)
      }

      currentRule = {
        pattern: line.trim(),
        headers: {},
      }
      continue
    }

    if (!currentRule) {
      continue
    }

    const separatorIndex = line.indexOf(':')

    if (separatorIndex === -1) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()

    if (key.length === 0 || value.length === 0) {
      continue
    }

    currentRule.headers[key] = value
  }

  if (currentRule && Object.keys(currentRule.headers).length > 0) {
    rules.push(currentRule)
  }

  return rules
}

export function getHeadersForPath(pathname, headerRules) {
  const headers = {}

  for (const rule of headerRules) {
    if (matchesHeaderPattern(pathname, rule.pattern)) {
      Object.assign(headers, rule.headers)
    }
  }

  return headers
}

export function resolveRequestPath(pathname, outDir = DEFAULT_OUT_DIR) {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/'
  const relativeCandidates = normalizedPath === '/'
    ? ['index.html']
    : [
        normalizedPath.slice(1),
        `${normalizedPath.slice(1)}.html`,
        `${normalizedPath.slice(1)}${sep}index.html`,
      ]

  for (const relativeCandidate of relativeCandidates) {
    const candidatePath = resolve(outDir, relativeCandidate)

    if (!isWithinDirectory(candidatePath, outDir)) {
      continue
    }

    if (existsSync(candidatePath) && statSync(candidatePath).isFile()) {
      return candidatePath
    }
  }

  return null
}

function matchesHeaderPattern(pathname, pattern) {
  if (pattern === '/*') {
    return true
  }

  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -1)
    return pathname.startsWith(prefix)
  }

  return pathname === pattern
}

function isWithinDirectory(candidatePath, directory) {
  return candidatePath === directory || candidatePath.startsWith(`${directory}${sep}`)
}

function startStaticExportServer() {
  const server = createStaticExportServer()

  server.listen(DEFAULT_PORT, DEFAULT_HOST, () => {
    process.stdout.write(
      `Serving static export from ${DEFAULT_OUT_DIR} on http://${DEFAULT_HOST}:${DEFAULT_PORT}\n`,
    )
  })
}

if (process.argv[1] === SCRIPT_PATH) {
  startStaticExportServer()
}
