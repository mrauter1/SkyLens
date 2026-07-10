#!/usr/bin/env node

import { fileURLToPath } from 'node:url'

import { buildScopeDataset } from './scope/build-core.mjs'
import { PUBLIC_SCOPE_ROOT } from './scope/shared.mjs'
import { verifyScopeDataset } from './scope/verify-core.mjs'

const SCRIPT_PATH = fileURLToPath(import.meta.url)

export async function ensureLocalScopeDataset({
  datasetRoot = PUBLIC_SCOPE_ROOT,
  verifyDataset = verifyScopeDataset,
  buildDataset = buildScopeDataset,
} = {}) {
  try {
    const result = await verifyDataset({ datasetRoot, kind: 'auto' })

    return {
      action: 'verified',
      datasetRoot,
      manifest: result.manifest,
    }
  } catch {
    const result = await buildDataset({
      mode: 'dev',
      datasetRoot,
      mirrorDatasetRoots: [],
    })

    return {
      action: 'generated',
      datasetRoot,
      manifest: result.manifest,
    }
  }
}

async function main() {
  const result = await ensureLocalScopeDataset()

  console.log(`scope dataset: ${result.action}`)
  console.log(`datasetRoot: ${result.datasetRoot}`)
  console.log(`kind: ${result.manifest.kind}`)
}

if (process.argv[1] === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
