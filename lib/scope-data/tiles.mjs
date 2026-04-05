import {
  SCOPE_BAND_DEFINITIONS,
  SCOPE_MAX_MAGNITUDE,
  SCOPE_ROW_SIZE_BYTES,
} from './contracts.mjs'

const MAX_RA_MICRO_DEG = 360_000_000
const MAX_DEC_MICRO_DEG = 90_000_000
const MIN_INT16 = -32_768
const MAX_INT16 = 32_767
const MAX_UINT32 = 4_294_967_295

export function normalizeRaDeg(value) {
  return ((value % 360) + 360) % 360
}

export function clampDecDeg(value) {
  return Math.min(90, Math.max(-90, value))
}

export function getBandsForMagnitude(vMag) {
  return SCOPE_BAND_DEFINITIONS.filter((band) => vMag <= band.maxMagnitude)
}

export function getTileIndices({ raDeg, decDeg }, band) {
  const normalizedRaDeg = normalizeRaDeg(raDeg)
  const shiftedDec = Math.min(179.999999, Math.max(0, decDeg + 90))

  return {
    raIndex: Math.floor(normalizedRaDeg / band.raStepDeg),
    decIndex: Math.floor(shiftedDec / band.decStepDeg),
  }
}

export function getTileFileName(raIndex, decIndex) {
  return `r${raIndex}_d${decIndex}.bin`
}

export function compareNormalizedScopeStars(left, right) {
  if (left.vMag !== right.vMag) {
    return left.vMag - right.vMag
  }

  if (left.decDeg !== right.decDeg) {
    return left.decDeg - right.decDeg
  }

  if (left.raDeg !== right.raDeg) {
    return left.raDeg - right.raDeg
  }

  if (left.sourceId < right.sourceId) {
    return -1
  }

  if (left.sourceId > right.sourceId) {
    return 1
  }

  return 0
}

function roundMetric(value, scale) {
  return Math.round(value * scale)
}

function assertInt16(name, value) {
  if (!Number.isInteger(value) || value < MIN_INT16 || value > MAX_INT16) {
    throw new Error(`${name} must fit in int16. Received: ${value}`)
  }
}

function assertUInt32(name, value) {
  if (!Number.isInteger(value) || value < 0 || value > MAX_UINT32) {
    throw new Error(`${name} must fit in uint32. Received: ${value}`)
  }
}

function toEncodedScopeRowValues(row) {
  const raMicroDeg = Math.min(
    MAX_RA_MICRO_DEG - 1,
    roundMetric(normalizeRaDeg(row.raDeg), 1_000_000)
  )
  const decMicroDeg = roundMetric(clampDecDeg(row.decDeg), 1_000_000)
  const pmRaMasPerYear = Math.round(row.pmRaMasPerYear)
  const pmDecMasPerYear = Math.round(row.pmDecMasPerYear)
  const vMagMilli = roundMetric(row.vMag, 1_000)
  const bMinusVMilli = roundMetric(row.bMinusV, 1_000)
  const nameId = Math.round(row.nameId ?? 0)

  assertUInt32('raMicroDeg', raMicroDeg)
  if (decMicroDeg < -MAX_DEC_MICRO_DEG || decMicroDeg > MAX_DEC_MICRO_DEG) {
    throw new Error(`decMicroDeg must be within +/-90 degrees. Received: ${decMicroDeg}`)
  }
  assertInt16('pmRaMasPerYear', pmRaMasPerYear)
  assertInt16('pmDecMasPerYear', pmDecMasPerYear)
  assertInt16('vMagMilli', vMagMilli)
  assertInt16('bMinusVMilli', bMinusVMilli)
  assertUInt32('nameId', nameId)

  if (vMagMilli < 0 || vMagMilli > SCOPE_MAX_MAGNITUDE * 1_000) {
    throw new Error(`vMagMilli must be between 0 and 10500. Received: ${vMagMilli}`)
  }

  if (bMinusVMilli < -1_000 || bMinusVMilli > 4_000) {
    throw new Error(
      `bMinusVMilli must be between -1000 and 4000. Received: ${bMinusVMilli}`
    )
  }

  return {
    raMicroDeg,
    decMicroDeg,
    pmRaMasPerYear,
    pmDecMasPerYear,
    vMagMilli,
    bMinusVMilli,
    nameId,
  }
}

export function encodeScopeStarRow(row) {
  const values = toEncodedScopeRowValues(row)
  const buffer = Buffer.allocUnsafe(SCOPE_ROW_SIZE_BYTES)

  buffer.writeUInt32LE(values.raMicroDeg, 0)
  buffer.writeInt32LE(values.decMicroDeg, 4)
  buffer.writeInt16LE(values.pmRaMasPerYear, 8)
  buffer.writeInt16LE(values.pmDecMasPerYear, 10)
  buffer.writeInt16LE(values.vMagMilli, 12)
  buffer.writeInt16LE(values.bMinusVMilli, 14)
  buffer.writeUInt32LE(values.nameId, 16)

  return buffer
}

export function decodeScopeStarRow(buffer, offset = 0) {
  if (buffer.length - offset < SCOPE_ROW_SIZE_BYTES) {
    throw new Error('Buffer does not contain a full scope tile row')
  }

  return {
    raDeg: buffer.readUInt32LE(offset) / 1_000_000,
    decDeg: buffer.readInt32LE(offset + 4) / 1_000_000,
    pmRaMasPerYear: buffer.readInt16LE(offset + 8),
    pmDecMasPerYear: buffer.readInt16LE(offset + 10),
    vMag: buffer.readInt16LE(offset + 12) / 1_000,
    bMinusV: buffer.readInt16LE(offset + 14) / 1_000,
    nameId: buffer.readUInt32LE(offset + 16),
  }
}

export function decodeScopeStarTile(buffer) {
  if (buffer.length % SCOPE_ROW_SIZE_BYTES !== 0) {
    throw new Error('Scope tile byte length must be divisible by the row size')
  }

  const rows = []

  for (let offset = 0; offset < buffer.length; offset += SCOPE_ROW_SIZE_BYTES) {
    rows.push(decodeScopeStarRow(buffer, offset))
  }

  return rows
}

