import { createReadStream } from 'node:fs'
import { readdir } from 'node:fs/promises'
import readline from 'node:readline'

import { SCOPE_MAX_MAGNITUDE } from './contracts.mjs'

const TYCHO2_REQUIRED_EXPANDED_FILE_PATTERN = /^tyc2\.dat\.(\d{2})$/

function getFixedWidthField(line, startInclusive, endInclusive) {
  return line.slice(startInclusive - 1, endInclusive).trim()
}

function parseNullableFloat(value) {
  const trimmed = String(value ?? '').trim()

  if (trimmed.length === 0) {
    return null
  }

  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function parseNullableInteger(value) {
  const trimmed = String(value ?? '').trim()

  if (trimmed.length === 0) {
    return null
  }

  if (!/^-?\d+$/.test(trimmed)) {
    return Number.NaN
  }

  return Number(trimmed)
}

function roundToThreeDecimals(value) {
  return Math.round(value * 1_000) / 1_000
}

function normalizeTycho2LineEnding(line) {
  return line.endsWith('\r') ? line.slice(0, -1) : line
}

export function extractTycho2MainFields(line) {
  return {
    tyc1: parseNullableInteger(getFixedWidthField(line, 1, 4)),
    tyc2: parseNullableInteger(getFixedWidthField(line, 6, 10)),
    tyc3: parseNullableInteger(getFixedWidthField(line, 12, 12)),
    pflag: getFixedWidthField(line, 14, 14),
    raDeg: parseNullableFloat(getFixedWidthField(line, 16, 27)),
    decDeg: parseNullableFloat(getFixedWidthField(line, 29, 40)),
    pmRaMasPerYear: parseNullableFloat(getFixedWidthField(line, 42, 48)),
    pmDecMasPerYear: parseNullableFloat(getFixedWidthField(line, 50, 56)),
    btMag: parseNullableFloat(getFixedWidthField(line, 111, 116)),
    vtMag: parseNullableFloat(getFixedWidthField(line, 124, 129)),
    hipId: parseNullableInteger(getFixedWidthField(line, 143, 148)),
  }
}

export function deriveTycho2Photometry({ btMag, vtMag }) {
  const hasBt = Number.isFinite(btMag)
  const hasVt = Number.isFinite(vtMag)

  if (hasBt && hasVt) {
    const delta = btMag - vtMag

    return {
      vMag: roundToThreeDecimals(vtMag - 0.09 * delta),
      bMinusV: roundToThreeDecimals(
        Math.min(4, Math.max(-1, 0.85 * delta))
      ),
    }
  }

  if (hasVt) {
    return {
      vMag: roundToThreeDecimals(vtMag),
      bMinusV: 0,
    }
  }

  if (hasBt) {
    return {
      vMag: roundToThreeDecimals(btMag),
      bMinusV: 0,
    }
  }

  return undefined
}

function createEmptyDroppedRows() {
  return {
    invalidLength: 0,
    missingRa: 0,
    missingDec: 0,
    missingPhotometry: 0,
    invalidDerivedPhotometry: 0,
    pflagX: 0,
    tooFaint: 0,
  }
}

function normalizeFiniteOptional(value) {
  return Number.isFinite(value) ? value : 0
}

export function normalizeTycho2MainRecord(line, context = {}) {
  const normalizedLine = normalizeTycho2LineEnding(String(line ?? ''))

  if (normalizedLine.length !== 206) {
    const error = new Error(
      `Tycho-2 line length must be exactly 206 characters at ${context.fileName ?? '<unknown>'}:${context.lineNumber ?? '?'}`
    )
    error.code = 'ERR_SCOPE_TYCHO2_INVALID_LENGTH'
    throw error
  }

  const fields = extractTycho2MainFields(normalizedLine)

  if (fields.pflag === 'X') {
    return { dropReason: 'pflagX' }
  }

  if (!Number.isFinite(fields.raDeg)) {
    return { dropReason: 'missingRa' }
  }

  if (!Number.isFinite(fields.decDeg)) {
    return { dropReason: 'missingDec' }
  }

  const photometry = deriveTycho2Photometry(fields)

  if (!photometry) {
    return { dropReason: 'missingPhotometry' }
  }

  if (!Number.isFinite(photometry.vMag) || !Number.isFinite(photometry.bMinusV)) {
    return { dropReason: 'invalidDerivedPhotometry' }
  }

  if (photometry.vMag > SCOPE_MAX_MAGNITUDE) {
    return { dropReason: 'tooFaint' }
  }

  if (
    !Number.isInteger(fields.tyc1) ||
    !Number.isInteger(fields.tyc2) ||
    !Number.isInteger(fields.tyc3)
  ) {
    throw new Error(
      `Tycho source id fields must be parseable integers at ${context.fileName ?? '<unknown>'}:${context.lineNumber ?? '?'}`
    )
  }

  return {
    row: {
      sourceId: `TYC:${fields.tyc1}-${fields.tyc2}-${fields.tyc3}`,
      hipId: Number.isInteger(fields.hipId) ? fields.hipId : null,
      raDeg: fields.raDeg,
      decDeg: fields.decDeg,
      pmRaMasPerYear: normalizeFiniteOptional(fields.pmRaMasPerYear),
      pmDecMasPerYear: normalizeFiniteOptional(fields.pmDecMasPerYear),
      vMag: photometry.vMag,
      bMinusV: photometry.bMinusV,
    },
  }
}

export async function listTycho2ExpandedFiles(expandedRoot) {
  const directoryEntries = await readdir(expandedRoot, { withFileTypes: true })
  const matchedFiles = directoryEntries
    .filter((entry) => entry.isFile() && TYCHO2_REQUIRED_EXPANDED_FILE_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort()

  const expectedFiles = Array.from({ length: 20 }, (_, index) =>
    `tyc2.dat.${String(index).padStart(2, '0')}`
  )

  const missingFiles = expectedFiles.filter((fileName) => !matchedFiles.includes(fileName))

  return {
    files: matchedFiles,
    missingFiles,
  }
}

export async function parseTycho2ExpandedCatalog(expandedRoot) {
  const { files, missingFiles } = await listTycho2ExpandedFiles(expandedRoot)

  if (missingFiles.length > 0) {
    throw new Error(
      `Production build requires expanded Tycho-2 files: ${missingFiles.join(', ')}`
    )
  }

  const rows = []
  const droppedRows = createEmptyDroppedRows()

  for (const fileName of files) {
    const lineReader = readline.createInterface({
      input: createReadStream(`${expandedRoot}/${fileName}`, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    })

    let lineNumber = 0

    for await (const line of lineReader) {
      lineNumber += 1

      try {
        const result = normalizeTycho2MainRecord(line, { fileName, lineNumber })

        if (result.row) {
          rows.push(result.row)
        } else if (result.dropReason) {
          droppedRows[result.dropReason] += 1
        }
      } catch (error) {
        if (error?.code === 'ERR_SCOPE_TYCHO2_INVALID_LENGTH') {
          droppedRows.invalidLength += 1
          continue
        }

        throw error
      }
    }
  }

  return {
    rows,
    droppedRows,
  }
}
