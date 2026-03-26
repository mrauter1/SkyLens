import tokyoIssFixture from '../fixtures/demo/tokyo_iss.json'

import { describe, expect, it } from 'vitest'

import {
  DEFAULT_DEMO_SCENARIO_ID,
  getDemoScenario,
  listDemoScenarios,
} from '../../lib/demo/scenarios'

describe('demo scenarios', () => {
  it('exposes the three bundled deterministic scenarios', () => {
    const scenarios = listDemoScenarios()

    expect(scenarios.map((scenario) => scenario.id)).toEqual([
      'sf-evening',
      'ny-day',
      'tokyo-iss',
    ])
    expect(DEFAULT_DEMO_SCENARIO_ID).toBe('sf-evening')
  })

  it('matches the required Tokyo ISS fixture contract', () => {
    const scenario = getDemoScenario('tokyo-iss')

    expect(scenario.id).toBe(tokyoIssFixture.id)
    expect(scenario.label).toBe(tokyoIssFixture.label)
    expect(scenario.observer).toEqual(tokyoIssFixture.observer)
    expect(scenario.satelliteCatalog?.satellites[0]).toMatchObject(
      tokyoIssFixture.satelliteCatalog.satellites[0],
    )
  })

  it('falls back to the default scenario for unknown ids', () => {
    expect(getDemoScenario('unknown' as never).id).toBe(DEFAULT_DEMO_SCENARIO_ID)
  })
})
