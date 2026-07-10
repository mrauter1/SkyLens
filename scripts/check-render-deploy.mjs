#!/usr/bin/env node
import { execSync } from 'node:child_process'

const DEFAULT_SERVICE_ID = 'srv-d741154hg0os739qqaag'
const DEFAULT_URL = 'https://skylens-serverless-static.onrender.com'

const args = process.argv.slice(2)
const serviceId = args.find((arg) => !arg.startsWith('--')) ?? DEFAULT_SERVICE_ID
const siteUrl = args.find((arg, index) => index > 0 && !arg.startsWith('--')) ?? DEFAULT_URL
const requireHeadAlignment = args.includes('--require-head')

const apiKey = process.env.RENDER_API_KEY
if (!apiKey) {
  console.error('Missing RENDER_API_KEY environment variable.')
  process.exit(1)
}

function shEscape(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`
}

function run(command) {
  return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function getJson(url) {
  const output = run(
    `curl -sS -H "Authorization: Bearer ${apiKey}" ${shEscape(url)}`,
  )
  return JSON.parse(output)
}

function getLocalCommit(ref) {
  try {
    return run(`git rev-parse ${ref}`)
  } catch {
    return null
  }
}

try {
  const deploys = getJson(`https://api.render.com/v1/services/${serviceId}/deploys?limit=10`)

  const liveDeploy = deploys
    .map((item) => item.deploy)
    .find((deploy) => deploy.status === 'live')

  if (!liveDeploy) {
    console.error('No live deployment found for the service.')
    process.exit(1)
  }

  const localHead = getLocalCommit('HEAD')
  const originMain = getLocalCommit('origin/main')

  console.log(`Service ID: ${serviceId}`)
  console.log(`Site URL: ${siteUrl}`)
  console.log(`Live deploy id: ${liveDeploy.id}`)
  console.log(`Live deploy commit: ${liveDeploy.commit.id}`)
  console.log(`Live deploy finished: ${liveDeploy.finishedAt ?? 'unknown'}`)
  console.log(`Local HEAD commit: ${localHead ?? 'unavailable'}`)
  console.log(`origin/main commit: ${originMain ?? 'unavailable'}`)

  if (originMain && originMain !== liveDeploy.commit.id) {
    console.error('Mismatch: origin/main is not live on Render.')
    process.exit(2)
  }

  if (requireHeadAlignment && localHead && localHead !== liveDeploy.commit.id) {
    console.error('Mismatch: local HEAD is not live on Render (required by --require-head).')
    process.exit(3)
  }

  if (!requireHeadAlignment && localHead && localHead !== liveDeploy.commit.id) {
    console.log('Note: local HEAD differs from live deploy commit (expected on feature branches).')
  }

  const statusCode = run(`curl -sS -o /dev/null -w '%{http_code}' ${shEscape(siteUrl)}`)
  if (statusCode !== '200') {
    console.error(`Site health check failed with HTTP ${statusCode}.`)
    process.exit(4)
  }

  console.log(`Site health check: HTTP ${statusCode}`)
  console.log('Render deployment is live and branch-aligned.')
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
