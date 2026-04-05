import path from 'node:path'

import { verifyScopeDataset } from './scope/verify-core.mjs'

function parseArgs(argv) {
  let datasetRoot = path.join(process.cwd(), 'public', 'data', 'scope', 'v1')
  let kind = 'auto'

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--dataset-root') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error('scope-verify-dataset-root-missing')
      }
      datasetRoot = path.resolve(process.cwd(), value)
      index += 1
      continue
    }
    if (argument === '--kind') {
      const value = argv[index + 1]
      if (value !== 'auto' && value !== 'dev' && value !== 'prod') {
        throw new Error('scope-verify-kind-invalid')
      }
      kind = value
      index += 1
      continue
    }
    throw new Error(`scope-verify-arg-unknown:${argument}`)
  }

  return { datasetRoot, kind }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const result = await verifyScopeDataset(options)

  console.log(`datasetRoot: ${options.datasetRoot}`)
  console.log(`kind: ${result.manifest.kind}`)
  console.log(`bands: ${result.manifest.bands.length}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
