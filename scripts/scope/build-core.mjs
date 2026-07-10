import { promises as fs } from 'node:fs'
import path from 'node:path'

import {
  DEV_FALLBACK_SEED_COUNT,
  DEV_FALLBACK_SEED_IDS,
  DEV_SYNTHETIC_MAGS,
  DEV_SYNTHETIC_OFFSETS_DEG,
  RUNTIME_FIELD_BOUNDS,
  SCOPE_CATALOG_EPOCH,
  SCOPE_CATALOG_VERSION,
  SCOPE_DATASET_BANDS,
  SCOPE_ROW_FORMAT,
} from './constants.mjs'
import {
  BRIGHT_STAR_SOURCE_PATH,
  compareUtf16,
  createDatasetBandIndex,
  ensureCleanDirectory,
  fileExists,
  NAME_OVERRIDE_PATH,
  normalizeDecDeg,
  normalizeName,
  OPTIONAL_PRODUCTION_NAMES_CACHE_PATH,
  OUT_SCOPE_ROOT,
  PUBLIC_SCOPE_ROOT,
  readJsonFile,
  replaceDirectoryAtomically,
  roundToMilli,
  SCOPE_REPORT_PATH,
  SCOPE_STAGING_ROOT,
  TYCHO2_CACHE_ROOT,
  wrapRaDeg,
  writeJsonFile,
} from './shared.mjs'
import { verifyScopeDataset } from './verify-core.mjs'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function parseNumericField(value) {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return null
  }
  const parsed = Number.parseFloat(trimmed)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function parseIntegerField(value) {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return null
  }
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function getInclusiveSlice(line, start, end) {
  return line.slice(start - 1, end)
}

export function derivePhotometry(btMag, vtMag) {
  const hasBt = Number.isFinite(btMag)
  const hasVt = Number.isFinite(vtMag)

  if (hasBt && hasVt) {
    const delta = btMag - vtMag
    return {
      vMag: roundToMilli(vtMag - 0.09 * delta),
      bMinusV: roundToMilli(Math.max(-1, Math.min(4, 0.85 * delta))),
    }
  }

  if (hasVt) {
    return {
      vMag: roundToMilli(vtMag),
      bMinusV: 0,
    }
  }

  if (hasBt) {
    return {
      vMag: roundToMilli(btMag),
      bMinusV: 0,
    }
  }

  return null
}

export function parseTycho2Line(line) {
  const record = line.replace(/\r?\n$/, '')

  if (record.length !== 206) {
    return {
      ok: false,
      reason: 'invalidLength',
    }
  }

  const sourceIdParts = {
    tyc1: parseIntegerField(getInclusiveSlice(record, 1, 4)),
    tyc2: parseIntegerField(getInclusiveSlice(record, 6, 10)),
    tyc3: parseIntegerField(getInclusiveSlice(record, 12, 12)),
  }
  if (
    !Number.isInteger(sourceIdParts.tyc1) ||
    !Number.isInteger(sourceIdParts.tyc2) ||
    !Number.isInteger(sourceIdParts.tyc3)
  ) {
    return { ok: false, reason: 'invalidLength' }
  }
  const pflag = getInclusiveSlice(record, 14, 14).trim() || ''
  const raDeg = parseNumericField(getInclusiveSlice(record, 16, 27))
  const decDeg = parseNumericField(getInclusiveSlice(record, 29, 40))
  const pmRa = parseNumericField(getInclusiveSlice(record, 42, 48))
  const pmDec = parseNumericField(getInclusiveSlice(record, 50, 56))
  const btMag = parseNumericField(getInclusiveSlice(record, 111, 116))
  const vtMag = parseNumericField(getInclusiveSlice(record, 124, 129))
  const hip = parseIntegerField(getInclusiveSlice(record, 143, 148))

  if (!Number.isFinite(raDeg)) {
    return { ok: false, reason: 'missingRa' }
  }
  if (!Number.isFinite(decDeg)) {
    return { ok: false, reason: 'missingDec' }
  }
  if (pflag === 'X') {
    return { ok: false, reason: 'pflagX' }
  }

  const derivedPhotometry = derivePhotometry(btMag, vtMag)
  if (!derivedPhotometry) {
    return { ok: false, reason: 'missingPhotometry' }
  }
  if (!Number.isFinite(derivedPhotometry.vMag) || !Number.isFinite(derivedPhotometry.bMinusV)) {
    return { ok: false, reason: 'invalidDerivedPhotometry' }
  }
  if (derivedPhotometry.vMag > 10.5) {
    return { ok: false, reason: 'tooFaint' }
  }

  return {
    ok: true,
    value: {
      sourceCatalog: 'tycho2-main',
      sourceId: `TYC:${sourceIdParts.tyc1}-${sourceIdParts.tyc2}-${sourceIdParts.tyc3}`,
      tycKey: `${sourceIdParts.tyc1}-${sourceIdParts.tyc2}-${sourceIdParts.tyc3}`,
      hip,
      raDeg,
      decDeg,
      pmRaMasPerYear: Number.isFinite(pmRa) ? pmRa : 0,
      pmDecMasPerYear: Number.isFinite(pmDec) ? pmDec : 0,
      vMag: derivedPhotometry.vMag,
      bMinusV: derivedPhotometry.bMinusV,
    },
  }
}

export async function loadBrightStarNameMap() {
  const stars = await readJsonFile(BRIGHT_STAR_SOURCE_PATH)
  const hipToName = new Map()

  for (const star of stars) {
    const match = /^hip-(\d+)$/.exec(String(star.id ?? ''))
    if (!match) {
      continue
    }

    const normalized = normalizeName(star.name)
    if (!normalized) {
      continue
    }

    const hip = Number.parseInt(match[1], 10)
    const current = hipToName.get(hip)
    if (current && current !== normalized) {
      throw new Error(`scope-bright-star-hip-name-conflict:${hip}`)
    }
    hipToName.set(hip, normalized)
  }

  return hipToName
}

export async function loadManualOverrides() {
  if (!(await fileExists(NAME_OVERRIDE_PATH))) {
    return {
      hipOverrides: new Map(),
      tycOverrides: new Map(),
    }
  }

  const csv = await fs.readFile(NAME_OVERRIDE_PATH, 'utf8')
  const lines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0)
  assert(lines[0] === 'matchType,matchKey,displayName', 'scope-name-override-header-invalid')

  const hipOverrides = new Map()
  const tycOverrides = new Map()

  for (const line of lines.slice(1)) {
    const parts = line.split(',')
    assert(parts.length === 3, 'scope-name-override-schema-invalid')
    const [matchType, matchKey, displayName] = parts
    const normalizedDisplayName = normalizeName(displayName)
    assert(Boolean(normalizedDisplayName), 'scope-name-override-display-name-invalid')

    if (matchType === 'HIP') {
      const hip = Number.parseInt(matchKey, 10)
      assert(Number.isInteger(hip), 'scope-name-override-hip-invalid')
      assert(!hipOverrides.has(hip), 'scope-name-override-duplicate')
      hipOverrides.set(hip, normalizedDisplayName)
      continue
    }

    if (matchType === 'TYC') {
      assert(/^\d+-\d+-\d+$/.test(matchKey), 'scope-name-override-tyc-invalid')
      assert(!tycOverrides.has(matchKey), 'scope-name-override-duplicate')
      tycOverrides.set(matchKey, normalizedDisplayName)
      continue
    }

    throw new Error('scope-name-override-match-type-invalid')
  }

  return { hipOverrides, tycOverrides }
}

export function assignDisplayNames(stars, { hipOverrides, tycOverrides, brightStarNameMap }) {
  return stars.map((star) => {
    const matchingManualOverrides = []

    if (star.hip != null && hipOverrides.has(star.hip)) {
      matchingManualOverrides.push(hipOverrides.get(star.hip))
    }
    if (star.tycKey && tycOverrides.has(star.tycKey)) {
      matchingManualOverrides.push(tycOverrides.get(star.tycKey))
    }

    if (matchingManualOverrides.length > 1) {
      throw new Error(`scope-name-override-row-conflict:${star.sourceId}`)
    }

    let displayName = matchingManualOverrides[0] ?? null
    if (!displayName && star.hip != null && brightStarNameMap.has(star.hip)) {
      displayName = brightStarNameMap.get(star.hip)
    }

    return {
      ...star,
      displayName: displayName ?? undefined,
    }
  })
}

export async function loadOptionalProductionNamesTable() {
  if (!(await fileExists(OPTIONAL_PRODUCTION_NAMES_CACHE_PATH))) {
    return null
  }

  const names = await readJsonFile(OPTIONAL_PRODUCTION_NAMES_CACHE_PATH)
  assert(names && typeof names === 'object' && !Array.isArray(names), 'scope-published-names-schema-invalid')
  for (const [key, value] of Object.entries(names)) {
    assert(/^\d+$/.test(key), 'scope-published-names-key-invalid')
    assert(typeof value === 'string', 'scope-published-names-value-invalid')
    assert(normalizeName(value) === value, 'scope-published-names-normalization-invalid')
  }
  return names
}

export async function parseTycho2SourceFiles(tychoRoot = TYCHO2_CACHE_ROOT) {
  const report = {
    rawFiles: {
      required: 20,
      present: 0,
    },
    parsedRows: 0,
    droppedRows: {
      invalidLength: 0,
      missingRa: 0,
      missingDec: 0,
      missingPhotometry: 0,
      invalidDerivedPhotometry: 0,
      pflagX: 0,
      tooFaint: 0,
    },
  }

  const stars = []

  for (let index = 0; index < 20; index += 1) {
    const filename = `tyc2.dat.${String(index).padStart(2, '0')}`
    const filePath = path.join(tychoRoot, filename)
    if (!(await fileExists(filePath))) {
      continue
    }

    report.rawFiles.present += 1
    const fileContents = await fs.readFile(filePath, 'utf8')
    const lines = fileContents.split('\n').filter((line) => line.length > 0)

    for (const line of lines) {
      const parsed = parseTycho2Line(line)
      if (!parsed.ok) {
        report.droppedRows[parsed.reason] += 1
        continue
      }

      stars.push(parsed.value)
      report.parsedRows += 1
    }
  }

  assert(report.rawFiles.present === report.rawFiles.required, 'scope-tycho-source-incomplete')

  return { stars, report }
}

export async function buildDevSyntheticStars(seedIds = DEV_FALLBACK_SEED_IDS) {
  assert(seedIds.length === DEV_FALLBACK_SEED_COUNT, 'scope-dev-seed-count-invalid')
  const stars = await readJsonFile(BRIGHT_STAR_SOURCE_PATH)
  const starMap = new Map(stars.map((star) => [star.id, star]))
  const syntheticStars = []

  for (const seedId of seedIds) {
    const star = starMap.get(seedId)
    assert(star, `scope-dev-seed-missing:${seedId}`)

    for (let index = 0; index < DEV_SYNTHETIC_OFFSETS_DEG.length; index += 1) {
      const [raOffsetDeg, decOffsetDeg] = DEV_SYNTHETIC_OFFSETS_DEG[index]
      syntheticStars.push({
        sourceCatalog: 'dev-synthetic-from-stars-200',
        sourceId: `DEV:${star.id}:${index}`,
        raDeg: wrapRaDeg(star.raDeg + raOffsetDeg),
        decDeg: Math.max(-89.9, Math.min(89.9, star.decDeg + decOffsetDeg)),
        pmRaMasPerYear: 0,
        pmDecMasPerYear: 0,
        vMag: DEV_SYNTHETIC_MAGS[index],
        bMinusV: 0,
        displayName: index === 5 ? normalizeName(star.name) ?? undefined : undefined,
      })
    }
  }

  return {
    stars: syntheticStars,
    report: {
      rawFiles: {
        required: 1,
        present: 1,
      },
      parsedRows: syntheticStars.length,
      droppedRows: {
        invalidLength: 0,
        missingRa: 0,
        missingDec: 0,
        missingPhotometry: 0,
        invalidDerivedPhotometry: 0,
        pflagX: 0,
        tooFaint: 0,
      },
    },
  }
}

function buildNameTable(stars) {
  const uniqueNames = [...new Set(stars.map((star) => star.displayName).filter(Boolean))].sort(
    compareUtf16,
  )

  const namesTable = {}
  const nameIds = new Map()

  uniqueNames.forEach((name, index) => {
    const nameId = index + 1
    nameIds.set(name, nameId)
    namesTable[String(nameId)] = name
  })

  return { namesTable, nameIds }
}

function sortTileRows(left, right) {
  if (left.vMag !== right.vMag) {
    return left.vMag - right.vMag
  }
  if (left.decDeg !== right.decDeg) {
    return left.decDeg - right.decDeg
  }
  if (left.raDeg !== right.raDeg) {
    return left.raDeg - right.raDeg
  }
  return left.sourceId < right.sourceId ? -1 : left.sourceId > right.sourceId ? 1 : 0
}

function encodeTileRows(stars, nameIds) {
  const buffer = Buffer.alloc(stars.length * 20)
  let offset = 0

  for (const star of stars) {
    const raMicroDeg = Math.round(wrapRaDeg(star.raDeg) * 1_000_000)
    const decMicroDeg = Math.round(normalizeDecDeg(star.decDeg) * 1_000_000)
    const pmRaMasPerYear = Math.round(star.pmRaMasPerYear)
    const pmDecMasPerYear = Math.round(star.pmDecMasPerYear)
    const vMagMilli = Math.round(star.vMag * 1000)
    const bMinusVMilli = Math.round(star.bMinusV * 1000)
    const nameId = star.displayName ? nameIds.get(star.displayName) ?? 0 : 0

    assert(
      raMicroDeg >= RUNTIME_FIELD_BOUNDS.raMicroDeg.min &&
        raMicroDeg < RUNTIME_FIELD_BOUNDS.raMicroDeg.maxExclusive,
      'scope-encode-ra-out-of-bounds',
    )
    assert(
      decMicroDeg >= RUNTIME_FIELD_BOUNDS.decMicroDeg.min &&
        decMicroDeg <= RUNTIME_FIELD_BOUNDS.decMicroDeg.max,
      'scope-encode-dec-out-of-bounds',
    )
    assert(
      pmRaMasPerYear >= RUNTIME_FIELD_BOUNDS.pmMasPerYear.min &&
        pmRaMasPerYear <= RUNTIME_FIELD_BOUNDS.pmMasPerYear.max,
      'scope-encode-pmra-out-of-bounds',
    )
    assert(
      pmDecMasPerYear >= RUNTIME_FIELD_BOUNDS.pmMasPerYear.min &&
        pmDecMasPerYear <= RUNTIME_FIELD_BOUNDS.pmMasPerYear.max,
      'scope-encode-pmdec-out-of-bounds',
    )
    assert(
      vMagMilli >= RUNTIME_FIELD_BOUNDS.vMagMilli.min &&
        vMagMilli <= RUNTIME_FIELD_BOUNDS.vMagMilli.max,
      'scope-encode-vmag-out-of-bounds',
    )
    assert(
      bMinusVMilli >= RUNTIME_FIELD_BOUNDS.bMinusVMilli.min &&
        bMinusVMilli <= RUNTIME_FIELD_BOUNDS.bMinusVMilli.max,
      'scope-encode-bminusv-out-of-bounds',
    )

    buffer.writeUInt32LE(raMicroDeg, offset)
    buffer.writeInt32LE(decMicroDeg, offset + 4)
    buffer.writeInt16LE(pmRaMasPerYear, offset + 8)
    buffer.writeInt16LE(pmDecMasPerYear, offset + 10)
    buffer.writeInt16LE(vMagMilli, offset + 12)
    buffer.writeInt16LE(bMinusVMilli, offset + 14)
    buffer.writeUInt32LE(nameId, offset + 16)
    offset += 20
  }

  return buffer
}

async function writeBandArtifacts(stagingRoot, band, stars, nameIds) {
  const bandStars = stars.filter((star) => star.vMag <= band.maxMagnitude).sort(sortTileRows)
  const tileMap = new Map()

  for (const star of bandStars) {
    const tile = createDatasetBandIndex(star.raDeg, star.decDeg, band)
    const tileKey = `${tile.decIndex}:${tile.raIndex}`
    const existing = tileMap.get(tileKey) ?? {
      ...tile,
      stars: [],
    }
    existing.stars.push(star)
    tileMap.set(tileKey, existing)
  }

  const bandDirPath = path.join(stagingRoot, band.bandDir)
  await fs.mkdir(bandDirPath, { recursive: true })

  const sortedTiles = [...tileMap.values()].sort((left, right) => {
    if (left.decIndex !== right.decIndex) {
      return left.decIndex - right.decIndex
    }
    return left.raIndex - right.raIndex
  })

  for (const tile of sortedTiles) {
    await fs.writeFile(
      path.join(bandDirPath, tile.file),
      encodeTileRows(tile.stars, nameIds),
    )
  }

  const bandIndex = {
    bandDir: band.bandDir,
    maxMagnitude: band.maxMagnitude,
    raStepDeg: band.raStepDeg,
    decStepDeg: band.decStepDeg,
    tiles: sortedTiles.map((tile) => ({
      raIndex: tile.raIndex,
      decIndex: tile.decIndex,
      file: tile.file,
      count: tile.stars.length,
    })),
  }
  await writeJsonFile(path.join(bandDirPath, 'index.json'), bandIndex)

  return {
    totalRows: bandStars.length,
    namedRows: bandStars.filter((star) => Boolean(star.displayName)).length,
    tiles: sortedTiles.length,
  }
}

function createBuildReport({ mode, sourceCatalog, rawFiles, parsedRows, droppedRows, names, bands }) {
  return {
    version: 1,
    mode,
    sourceCatalog,
    rawFiles,
    parsedRows,
    droppedRows,
    names,
    bands: bands.map((band) => ({
      bandDir: band.bandDir,
      totalRows: band.totalRows,
      namedRows: band.namedRows,
      tiles: band.tiles,
    })),
  }
}

export async function buildScopeDataset({
  mode = 'prod',
  datasetRoot = PUBLIC_SCOPE_ROOT,
  mirrorDatasetRoots = datasetRoot === PUBLIC_SCOPE_ROOT ? [OUT_SCOPE_ROOT] : [],
  stagingRoot = SCOPE_STAGING_ROOT,
  reportPath = SCOPE_REPORT_PATH,
} = {}) {
  assert(mode === 'dev' || mode === 'prod', 'scope-build-mode-invalid')
  await fs.mkdir(path.dirname(reportPath), { recursive: true })
  await ensureCleanDirectory(stagingRoot)

  const datasetSource =
    mode === 'dev' ? await buildDevSyntheticStars() : await parseTycho2SourceFiles(TYCHO2_CACHE_ROOT)

  const brightStarNameMap = await loadBrightStarNameMap()
  const manualOverrides = await loadManualOverrides()
  const optionalPublishedNames = mode === 'prod' ? await loadOptionalProductionNamesTable() : null
  void optionalPublishedNames

  const sourceCatalog =
    mode === 'dev' ? 'dev-synthetic-from-stars-200' : 'tycho2-main'
  const kind = mode
  const namedStars =
    mode === 'dev'
      ? datasetSource.stars
      : assignDisplayNames(datasetSource.stars, {
          hipOverrides: manualOverrides.hipOverrides,
          tycOverrides: manualOverrides.tycOverrides,
          brightStarNameMap,
        })

  const { namesTable, nameIds } = buildNameTable(namedStars)
  await writeJsonFile(path.join(stagingRoot, 'names.json'), namesTable)

  const manifestBands = []
  const reportBands = []

  for (const band of SCOPE_DATASET_BANDS) {
    const bandSummary = await writeBandArtifacts(stagingRoot, band, namedStars, nameIds)
    manifestBands.push({
      bandDir: band.bandDir,
      maxMagnitude: band.maxMagnitude,
      raStepDeg: band.raStepDeg,
      decStepDeg: band.decStepDeg,
      indexPath: `${band.bandDir}/index.json`,
      totalRows: bandSummary.totalRows,
      namedRows: bandSummary.namedRows,
    })
    reportBands.push({
      bandDir: band.bandDir,
      totalRows: bandSummary.totalRows,
      namedRows: bandSummary.namedRows,
      tiles: bandSummary.tiles,
    })
  }

  const manifest = {
    version: SCOPE_CATALOG_VERSION,
    kind,
    sourceCatalog,
    epoch: SCOPE_CATALOG_EPOCH,
    rowFormat: SCOPE_ROW_FORMAT,
    namesPath: 'names.json',
    bands: manifestBands,
  }

  await writeJsonFile(path.join(stagingRoot, 'manifest.json'), manifest)
  await verifyScopeDataset({
    datasetRoot: stagingRoot,
    kind,
  })
  await replaceDirectoryAtomically(stagingRoot, datasetRoot)
  const uniqueMirrorRoots = [...new Set(mirrorDatasetRoots)].filter(
    (mirrorRoot) => mirrorRoot !== datasetRoot,
  )

  for (const mirrorRoot of uniqueMirrorRoots) {
    await fs.rm(mirrorRoot, { recursive: true, force: true })
    await fs.mkdir(path.dirname(mirrorRoot), { recursive: true })
    await fs.cp(datasetRoot, mirrorRoot, { recursive: true })
  }

  const report = createBuildReport({
    mode,
    sourceCatalog,
    rawFiles: datasetSource.report.rawFiles,
    parsedRows: datasetSource.report.parsedRows,
    droppedRows: datasetSource.report.droppedRows,
    names: {
      unique: Object.keys(namesTable).length,
      emittedRows: reportBands.reduce((total, band) => total + band.namedRows, 0),
    },
    bands: reportBands,
  })

  await writeJsonFile(reportPath, report)

  return {
    manifest,
    report,
    datasetRoot,
    stagingRoot,
    reportPath,
  }
}
