import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const HYG_ZIP_URL = 'https://github.com/astronexus/HYG-Database/archive/refs/heads/main.zip'
const HYG_ZIP_ENTRY = 'HYG-Database-main/hyg/CURRENT/hygdata_v41.csv'
const TARGET_PATH = path.resolve('data/scope-source/hyg-proper-names.csv')

function parseCsvLine(line) {
  const values = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (ch === ',' && !inQuotes) {
      values.push(current)
      current = ''
      continue
    }

    current += ch
  }

  values.push(current)
  return values
}

function normalizeName(value) {
  const normalized = String(value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim()
  return normalized.length > 0 ? normalized : undefined
}

function buildHipNameCsvFromHygText(hygCsvText) {
  const lines = hygCsvText.split(/\r?\n/)
  const header = parseCsvLine(lines[0] ?? '')
  const hipIndex = header.indexOf('hip')
  const properIndex = header.indexOf('proper')

  if (hipIndex < 0 || properIndex < 0) {
    throw new Error('HYG CSV is missing required columns: hip and proper')
  }

  const hipToName = new Map()

  for (const line of lines.slice(1)) {
    if (!line) continue

    const columns = parseCsvLine(line)
    const hipRaw = String(columns[hipIndex] ?? '').trim()
    const properName = normalizeName(columns[properIndex])

    if (!hipRaw || !properName) continue

    const hip = Number(hipRaw)

    if (!Number.isInteger(hip) || hip <= 0) continue

    const existing = hipToName.get(hip)

    if (existing && existing !== properName) {
      throw new Error(`Conflicting HYG proper names for HIP ${hip}: "${existing}" vs "${properName}"`)
    }

    hipToName.set(hip, properName)
  }

  const rows = [...hipToName.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hip, name]) => `${hip},${name}`)

  return `hip,name\n${rows.join('\n')}\n`
}

async function main() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'hyg-proper-names-'))
  const zipPath = path.join(tempRoot, 'hyg.zip')

  try {
    const response = await fetch(HYG_ZIP_URL)

    if (!response.ok) {
      throw new Error(`Failed to download HYG zip: HTTP ${response.status}`)
    }

    await writeFile(zipPath, Buffer.from(await response.arrayBuffer()))

    const { stdout } = await execFileAsync('unzip', ['-p', zipPath, HYG_ZIP_ENTRY], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 256,
    })

    const outputCsv = buildHipNameCsvFromHygText(stdout)

    await mkdir(path.dirname(TARGET_PATH), { recursive: true })
    await writeFile(TARGET_PATH, outputCsv, 'utf8')

    const rowCount = outputCsv.trim().split(/\r?\n/).length - 1

    console.log(`Wrote ${TARGET_PATH}`)
    console.log(`Rows: ${rowCount}`)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
