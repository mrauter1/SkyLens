import { createScopeNameTable } from './json.mjs'

const HIP_ID_PATTERN = /^hip-(\d+)$/
const MANUAL_OVERRIDE_HEADER = ['matchType', 'matchKey', 'displayName']

export function normalizeScopeDisplayName(value) {
  const normalized = String(value ?? '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized.length > 0 ? normalized : undefined
}

export function compareScopeNames(left, right) {
  if (left < right) {
    return -1
  }

  if (left > right) {
    return 1
  }

  return 0
}

export function collectUniqueScopeNames(values) {
  return [...new Set(values.map(normalizeScopeDisplayName).filter(Boolean))].sort(
    compareScopeNames
  )
}

export function buildScopeNameTable(values) {
  const uniqueNames = collectUniqueScopeNames(values)
  const entries = uniqueNames.map((name, index) => [String(index + 1), name])
  const nameTable = createScopeNameTable(entries)
  const nameIdByValue = new Map(entries.map(([id, name]) => [name, Number(id)]))

  return {
    uniqueNames,
    nameTable,
    nameIdByValue,
  }
}

export function getScopeNameId(nameIdByValue, value) {
  const normalizedName = normalizeScopeDisplayName(value)

  if (!normalizedName) {
    return 0
  }

  return nameIdByValue.get(normalizedName) ?? 0
}

export function parseHipIdFromSeedStarId(value) {
  const match = HIP_ID_PATTERN.exec(String(value ?? ''))

  if (!match) {
    return undefined
  }

  return Number(match[1])
}

export function buildBrightStarHipNameMap(stars) {
  const hipNameMap = new Map()

  for (const star of stars) {
    const hipId = parseHipIdFromSeedStarId(star?.id)

    if (!Number.isInteger(hipId)) {
      continue
    }

    const normalizedName = normalizeScopeDisplayName(star?.name)

    if (!normalizedName) {
      continue
    }

    const existingName = hipNameMap.get(hipId)

    if (existingName && existingName !== normalizedName) {
      throw new Error(
        `Conflicting normalized bright-star names for HIP ${hipId}: "${existingName}" vs "${normalizedName}"`
      )
    }

    hipNameMap.set(hipId, normalizedName)
  }

  return hipNameMap
}

function parseCsvLine(line) {
  const values = []
  let current = ''
  let insideQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]

    if (character === '"') {
      if (insideQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
        continue
      }

      insideQuotes = !insideQuotes
      continue
    }

    if (character === ',' && !insideQuotes) {
      values.push(current)
      current = ''
      continue
    }

    current += character
  }

  if (insideQuotes) {
    throw new Error('CSV row contains an unterminated quoted field')
  }

  values.push(current)
  return values
}

function parseManualOverrideTarget(matchType, matchKey) {
  const trimmedMatchKey = String(matchKey ?? '').trim()

  if (matchType === 'HIP') {
    const hipId = Number(trimmedMatchKey)

    if (!Number.isInteger(hipId) || hipId <= 0) {
      throw new Error(`Invalid HIP override matchKey: "${matchKey}"`)
    }

    return {
      matchType,
      matchKey: String(hipId),
      targetKey: `${matchType}:${hipId}`,
    }
  }

  if (matchType === 'TYC') {
    const normalizedKey = trimmedMatchKey.replace(/\s+/g, '')

    if (!/^\d+-\d+-\d+$/.test(normalizedKey)) {
      throw new Error(`Invalid TYC override matchKey: "${matchKey}"`)
    }

    return {
      matchType,
      matchKey: normalizedKey,
      targetKey: `${matchType}:${normalizedKey}`,
    }
  }

  throw new Error(`Invalid override matchType: "${matchType}"`)
}

export function parseScopeNameOverridesCsv(csvText) {
  const normalizedText = String(csvText ?? '').replace(/^\uFEFF/, '')
  const lines = normalizedText
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)

  if (lines.length === 0) {
    throw new Error('Name override CSV is empty')
  }

  const header = parseCsvLine(lines[0])

  if (
    header.length !== MANUAL_OVERRIDE_HEADER.length ||
    header.some((value, index) => value !== MANUAL_OVERRIDE_HEADER[index])
  ) {
    throw new Error(
      `Name override CSV header must be exactly "${MANUAL_OVERRIDE_HEADER.join(',')}"`
    )
  }

  return lines.slice(1).map((line, index) => {
    const row = parseCsvLine(line)

    if (row.length !== 3) {
      throw new Error(`Invalid override CSV row at line ${index + 2}`)
    }

    const [rawMatchType, rawMatchKey, rawDisplayName] = row
    const matchType = String(rawMatchType ?? '').trim()
    const target = parseManualOverrideTarget(matchType, rawMatchKey)

    return {
      ...target,
      displayName: normalizeScopeDisplayName(rawDisplayName),
      lineNumber: index + 2,
    }
  })
}

export function resolveScopeDisplayName({
  row,
  brightStarHipNameMap = new Map(),
  nameOverrides = [],
}) {
  const matchingOverrides = nameOverrides.filter((override) => {
    if (override.matchType === 'HIP') {
      return row.hipId === Number(override.matchKey)
    }

    return row.sourceId === `TYC:${override.matchKey}`
  })

  if (matchingOverrides.length > 1) {
    throw new Error(
      `Multiple manual override rows target source ${row.sourceId}`
    )
  }

  if (matchingOverrides.length === 1) {
    return matchingOverrides[0].displayName
  }

  if (Number.isInteger(row.hipId)) {
    return brightStarHipNameMap.get(row.hipId)
  }

  return undefined
}
