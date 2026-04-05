import {
  formatVerifyUsage,
  parseVerifyCommandArgs,
  verifyScopeDataset,
} from '../lib/scope-data/index.mjs'

async function main() {
  const options = parseVerifyCommandArgs(process.argv.slice(2))

  if (options.help) {
    process.stdout.write(`${formatVerifyUsage()}\n`)
    return
  }

  const result = await verifyScopeDataset({
    datasetRoot: options.datasetRoot,
    kind: options.kind,
  })

  process.stdout.write(
    [
      `Verified scope dataset at ${result.datasetRoot}`,
      `kind=${result.kind}`,
      `names=${result.namesCount}`,
      `bands=${result.bands.map((band) => `${band.bandDir}:${band.totalRows}`).join(', ')}`,
    ].join('\n') + '\n'
  )
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
