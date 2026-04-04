import {
  downloadScopeSource,
  formatDownloadUsage,
  parseDownloadCommandArgs,
  formatScopeSourceDownloadSummary,
} from '../lib/scope-data/index.mjs'

async function main() {
  const options = parseDownloadCommandArgs(process.argv.slice(2))

  if (options.help) {
    process.stdout.write(`${formatDownloadUsage()}\n`)
    return
  }

  const result = await downloadScopeSource(options)
  process.stdout.write(`${formatScopeSourceDownloadSummary(result)}\n`)
}

main().catch((error) => {
  if (typeof error.summaryText === 'string' && error.summaryText.length > 0) {
    process.stderr.write(`${error.summaryText}\n`)
  }

  console.error(error.message)
  process.exitCode = 1
})
