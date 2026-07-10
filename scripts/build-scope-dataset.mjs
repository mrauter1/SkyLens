import { buildScopeDataset } from './scope/build-core.mjs'

function parseArgs(argv) {
  let mode = 'prod'

  for (const argument of argv) {
    if (argument === '--dev') {
      mode = 'dev'
      continue
    }
    throw new Error(`scope-build-arg-unknown:${argument}`)
  }

  return { mode }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const result = await buildScopeDataset(options)

  console.log(`datasetRoot: ${result.datasetRoot}`)
  console.log(`kind: ${result.manifest.kind}`)
  console.log(`sourceCatalog: ${result.manifest.sourceCatalog}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
