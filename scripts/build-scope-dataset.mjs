import {
  buildScopeDataset,
  formatBuildUsage,
  parseBuildCommandArgs,
} from '../lib/scope-data/index.mjs'

async function main() {
  const options = parseBuildCommandArgs(process.argv.slice(2))

  if (options.help) {
    process.stdout.write(`${formatBuildUsage()}\n`)
    return
  }

  const result = await buildScopeDataset({ mode: options.mode })

  process.stdout.write(
    [
      `Built scope dataset at ${result.datasetRoot}`,
      `kind=${result.kind}`,
      `bands=${result.bands.map((band) => `${band.bandDir}:${band.totalRows}`).join(', ')}`,
      result.usedFallbackBecauseSourceMissing
        ? 'source=dev-fallback (production source unavailable)'
        : `source=${result.manifest.sourceCatalog}`,
    ].join('\n') + '\n'
  )
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
