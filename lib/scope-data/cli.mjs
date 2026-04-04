import {
  SCOPE_DEFAULT_SOURCE_BASE_URLS,
  SCOPE_DEFAULT_TIMEOUT_MS,
} from './contracts.mjs'
import {
  getScopeDatasetRoot,
  getTycho2Root,
} from './paths.mjs'

function requireValue(option, nextValue) {
  if (nextValue === undefined) {
    throw new Error(`Missing value for ${option}`)
  }

  return nextValue
}

export function resolveScopeSourceBaseUrls({
  cliBaseUrls = [],
  envValue = process.env.SKYLENS_SCOPE_SOURCE_BASE_URLS,
} = {}) {
  if (cliBaseUrls.length > 0) {
    return [...cliBaseUrls]
  }

  if (typeof envValue === 'string' && envValue.trim().length > 0) {
    return envValue
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  }

  return [...SCOPE_DEFAULT_SOURCE_BASE_URLS]
}

export function parseDownloadCommandArgs(argv) {
  const cliBaseUrls = []
  let dest = getTycho2Root()
  let force = false
  let expand = true
  let timeoutMs = SCOPE_DEFAULT_TIMEOUT_MS
  let help = false

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    switch (arg) {
      case '--base-url':
        cliBaseUrls.push(requireValue(arg, argv[index + 1]))
        index += 1
        break
      case '--dest':
        dest = requireValue(arg, argv[index + 1])
        index += 1
        break
      case '--force':
        force = true
        break
      case '--expand':
        expand = true
        break
      case '--timeout-ms':
        timeoutMs = Number(requireValue(arg, argv[index + 1]))
        index += 1
        break
      case '--help':
      case '-h':
        help = true
        break
      default:
        throw new Error(`Unknown argument for download-scope-source: ${arg}`)
    }
  }

  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`--timeout-ms must be a positive integer. Received: ${timeoutMs}`)
  }

  return {
    baseUrls: resolveScopeSourceBaseUrls({ cliBaseUrls }),
    dest,
    force,
    expand,
    timeoutMs,
    help,
  }
}

export function parseBuildCommandArgs(argv) {
  let mode
  let help = false

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    switch (arg) {
      case '--mode':
        mode = requireValue(arg, argv[index + 1])
        index += 1
        break
      case '--help':
      case '-h':
        help = true
        break
      default:
        throw new Error(`Unknown argument for build-scope-dataset: ${arg}`)
    }
  }

  if (!help && mode !== 'dev' && mode !== 'prod') {
    throw new Error('--mode must be either "dev" or "prod"')
  }

  return {
    mode,
    help,
  }
}

export function parseVerifyCommandArgs(argv) {
  let datasetRoot = getScopeDatasetRoot()
  let kind = 'auto'
  let help = false

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    switch (arg) {
      case '--dataset-root':
        datasetRoot = requireValue(arg, argv[index + 1])
        index += 1
        break
      case '--kind':
        kind = requireValue(arg, argv[index + 1])
        index += 1
        break
      case '--help':
      case '-h':
        help = true
        break
      default:
        throw new Error(`Unknown argument for verify-scope-dataset: ${arg}`)
    }
  }

  if (!help && !['auto', 'dev', 'prod'].includes(kind)) {
    throw new Error('--kind must be one of "auto", "dev", or "prod"')
  }

  return {
    datasetRoot,
    kind,
    help,
  }
}

export function formatDownloadUsage() {
  return [
    'Usage: node scripts/download-scope-source.mjs [options]',
    '',
    'Options:',
    '  --base-url <url>    Repeatable override for the source base URL list.',
    '  --dest <path>       Destination root. Defaults to .cache/scope-source/tycho2/.',
    '  --force             Re-download even when cached files are valid.',
    '  --expand            Expand raw .gz files into the expanded cache tree.',
    `  --timeout-ms <int>  Request timeout in milliseconds. Defaults to ${SCOPE_DEFAULT_TIMEOUT_MS}.`,
  ].join('\n')
}

export function formatBuildUsage() {
  return [
    'Usage: node scripts/build-scope-dataset.mjs --mode <prod|dev>',
    '',
    'Options:',
    '  --mode <prod|dev>   Select the production or deterministic development pipeline.',
  ].join('\n')
}

export function formatVerifyUsage() {
  return [
    'Usage: node scripts/verify-scope-dataset.mjs [options]',
    '',
    'Options:',
    '  --dataset-root <path>  Dataset root. Defaults to public/data/scope/v1.',
    '  --kind <auto|dev|prod> Override dataset kind detection. Defaults to auto.',
  ].join('\n')
}

export function createPendingPhaseError(commandName) {
  return new Error(
    `${commandName} is wired to the shared scope-data contracts, but command execution lands in a later implementation phase.`
  )
}

