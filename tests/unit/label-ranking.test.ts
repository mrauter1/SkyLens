import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  compareLabelCandidates,
  doLabelRectsOverlap,
  layoutLabels,
  selectLabelCandidates,
  type LabelCandidate,
} from '../../lib/labels/ranking'
import type { SkyObject } from '../../lib/viewer/contracts'

const VIEWPORT = {
  width: 390,
  height: 844,
}

const DENSE_SCENE_FIXTURE = JSON.parse(
  readFileSync(join(process.cwd(), 'tests/fixtures/labels/dense_scene.json'), 'utf8'),
) as LabelCandidate[]

describe('label ranking', () => {
  it('keeps dense-scene labels collision-free, clamped, and under the global cap', () => {
    const placements = layoutLabels(DENSE_SCENE_FIXTURE, {
      viewport: VIEWPORT,
      maxLabels: 18,
      centerLockedObjectId: 'moon',
    })

    expect(placements.length).toBeLessThanOrEqual(18)
    expect(placements.every((placement) => placement.rect.left >= 0)).toBe(true)
    expect(placements.every((placement) => placement.rect.top >= 0)).toBe(true)
    expect(placements.every((placement) => placement.rect.right <= VIEWPORT.width)).toBe(true)
    expect(placements.every((placement) => placement.rect.bottom <= VIEWPORT.height)).toBe(true)

    for (const [index, placement] of placements.entries()) {
      for (const other of placements.slice(index + 1)) {
        expect(doLabelRectsOverlap(placement.rect, other.rect)).toBe(false)
      }
    }

    const venusPlacement = placements.find((placement) => placement.object.id === 'planet-venus')
    expect(venusPlacement?.rect.left).toBe(0)
  })

  it('suppresses colliding labels instead of hopping them to a remote anchor', () => {
    const placements = layoutLabels(
      DENSE_SCENE_FIXTURE.filter((candidate) =>
        candidate.object.id === 'icao24-alpha' || candidate.object.id === 'icao24-bravo',
      ),
      {
        viewport: VIEWPORT,
      },
    )

    expect(placements).toHaveLength(1)
    expect(placements[0].anchor).toBe('above')
  })

  it('uses a stable below-anchor only when the preferred above-anchor would leave the viewport', () => {
    const placements = layoutLabels(
      [
        createCandidate({
          id: 'top-edge',
          type: 'planet',
          label: 'Mercury',
          importance: 60,
          x: 180,
          y: 14,
          magnitude: -1.2,
        }),
      ],
      {
        viewport: VIEWPORT,
      },
    )

    expect(placements).toHaveLength(1)
    expect(placements[0].anchor).toBe('below')
  })

  it('applies the type-priority ladder and center-lock override deterministically', () => {
    const issCandidate = DENSE_SCENE_FIXTURE.find((candidate) => candidate.object.id === '25544')
    const aircraftCandidate = DENSE_SCENE_FIXTURE.find(
      (candidate) => candidate.object.id === 'icao24-alpha',
    )
    const moonCandidate = DENSE_SCENE_FIXTURE.find((candidate) => candidate.object.id === 'moon')

    expect(issCandidate).toBeDefined()
    expect(aircraftCandidate).toBeDefined()
    expect(moonCandidate).toBeDefined()
    expect(compareLabelCandidates(issCandidate!, aircraftCandidate!)).toBeLessThan(0)
    expect(
      compareLabelCandidates(moonCandidate!, issCandidate!, {
        centerLockedObjectId: 'moon',
      }),
    ).toBeLessThan(0)
  })

  it('enforces the PRD per-type candidate budgets before layout', () => {
    const generatedCandidates = [
      ...Array.from({ length: 13 }, (_, index) =>
        createCandidate({
          id: `icao24-${index}`,
          type: 'aircraft',
          label: `Flight ${index}`,
          importance: 80 - index,
          x: 24 + index * 20,
          y: 120,
          rangeKm: 10 + index,
        }),
      ),
      ...Array.from({ length: 9 }, (_, index) =>
        createCandidate({
          id: index === 0 ? '25544' : `sat-${index}`,
          type: 'satellite',
          label: index === 0 ? 'ISS (ZARYA)' : `Sat ${index}`,
          importance: 70 - index,
          x: 24 + index * 20,
          y: 200,
          rangeKm: 400 + index * 10,
          metadata: index === 0 ? { isIss: true } : {},
        }),
      ),
      ...Array.from({ length: 35 }, (_, index) =>
        createCandidate({
          id: `star-${index}`,
          type: 'star',
          label: `Star ${index}`,
          importance: 40 - index * 0.2,
          x: 24 + (index % 10) * 20,
          y: 300 + Math.floor(index / 10) * 20,
          magnitude: index / 10,
        }),
      ),
    ]

    const selected = selectLabelCandidates(generatedCandidates)

    expect(selected.filter((candidate) => candidate.object.type === 'aircraft')).toHaveLength(12)
    expect(selected.filter((candidate) => candidate.object.type === 'satellite')).toHaveLength(8)
    expect(selected.filter((candidate) => candidate.object.type === 'star')).toHaveLength(30)
    expect(selected.some((candidate) => candidate.object.id === '25544')).toBe(true)
  })
})

function createCandidate({
  id,
  type,
  label,
  importance,
  x,
  y,
  rangeKm,
  magnitude,
  metadata = {},
}: {
  id: string
  type: SkyObject['type']
  label: string
  importance: number
  x: number
  y: number
  rangeKm?: number
  magnitude?: number
  metadata?: Record<string, unknown>
}): LabelCandidate {
  return {
    object: {
      id,
      type,
      label,
      azimuthDeg: 0,
      elevationDeg: 24,
      rangeKm,
      magnitude,
      importance,
      metadata,
    },
    projection: {
      visible: true,
      inViewport: true,
      inOverscan: true,
      x,
      y,
      angularDistanceDeg: Math.abs(x - VIEWPORT.width / 2) / 100,
    },
  }
}
