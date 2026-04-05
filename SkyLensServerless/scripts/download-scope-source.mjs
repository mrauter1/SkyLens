import { downloadScopeSource } from './scope/download-core.mjs'

function parseArgs(argv) {
  const baseUrls = []
  let force = false

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--force') {
      force = true
      continue
    }
    if (argument === '--base-url') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error('scope-download-base-url-missing')
      }
      baseUrls.push(value)
      index += 1
      continue
    }
    throw new Error(`scope-download-arg-unknown:${argument}`)
  }

  return { baseUrls, force }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const result = await downloadScopeSource(options)

  for (const entry of result.summary) {
    const source = entry.sourceUrl ? ` ${entry.sourceUrl}` : ''
    console.log(`${entry.file}: ${entry.status}${source}`)
  }

  console.log(`selectedBaseUrl: ${result.selectedBaseUrl ?? 'cache-only'}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
