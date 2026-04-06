import { describe, expect, it } from 'vitest'

import {
  buildVisibleConstellations,
  loadConstellationCatalog,
  validateConstellationCatalog,
} from '../../lib/astronomy/constellations'
import { normalizeCelestialObjects } from '../../lib/astronomy/celestial'
import { loadStarCatalog, normalizeVisibleStars } from '../../lib/astronomy/stars'
import { createCameraQuaternion, projectWorldPointToScreen } from '../../lib/projection/camera'
import type { CameraPose, ObserverState, SkyObject } from '../../lib/viewer/contracts'
import nyDayObserver from '../fixtures/observer/ny_day.json'
import sfEveningObserver from '../fixtures/observer/sf_evening.json'

const ENABLED_LAYERS = {
  aircraft: true,
  satellites: true,
  planets: true,
  stars: true,
  constellations: true,
} as const

const VIEWPORT = {
  width: 390,
  height: 844,
}

describe('celestial layer', () => {
  it('loads deterministic bundled star and constellation catalogs', () => {
    const stars = loadStarCatalog()
    const constellations = loadConstellationCatalog()

    expect(stars).toHaveLength(200)
    expect(stars[0]).toMatchObject({
      id: 'hip-32349',
      name: 'Sirius',
    })
    expect(constellations.length).toBeGreaterThan(10)
    expect(() => validateConstellationCatalog(constellations, stars)).not.toThrow()
  })

  it('applies likely-visible-only daylight rules to celestial bodies', () => {
    const result = normalizeCelestialObjects({
      observer: sfEveningObserver as ObserverState,
      timeMs: sfEveningObserver.timestampMs,
      enabledLayers: ENABLED_LAYERS,
      likelyVisibleOnly: true,
    })
    const visibleDaylightLabels = result.objects
      .filter((object) => object.metadata.daylightLabelSuppressed !== true)
      .map((object) => object.label)
    const suppressedDaylightPlanets = result.objects.filter(
      (object) => object.metadata.daylightLabelSuppressed === true,
    )

    expect(result.sunAltitudeDeg).toBeGreaterThan(0)
    expect(visibleDaylightLabels).toEqual([
      'Sun',
      'Moon',
      'Venus',
      'Jupiter',
    ])
    expect(
      suppressedDaylightPlanets.every((object) => object.type === 'planet'),
    ).toBe(true)
  })

  it('keeps daylit non-priority planets in the scene when they are already focused', () => {
    const result = normalizeCelestialObjects({
      observer: sfEveningObserver as ObserverState,
      timeMs: sfEveningObserver.timestampMs,
      enabledLayers: ENABLED_LAYERS,
      likelyVisibleOnly: true,
      focusedObjectId: 'planet-mars',
    })
    const mars = requireObject(result.objects, 'planet-mars')

    expect(mars.metadata.daylightLabelSuppressed).not.toBe(true)
  })

  it('projects fixture celestial objects within the locked screen tolerance', () => {
    const result = normalizeCelestialObjects({
      observer: sfEveningObserver as ObserverState,
      timeMs: sfEveningObserver.timestampMs,
      enabledLayers: ENABLED_LAYERS,
      likelyVisibleOnly: true,
    })
    const pose = createPose(100, 50)
    const moon = requireObject(result.objects, 'moon')
    const jupiter = requireObject(result.objects, 'planet-jupiter')
    const moonProjection = projectWorldPointToScreen(pose, moon, VIEWPORT)
    const jupiterProjection = projectWorldPointToScreen(pose, jupiter, VIEWPORT)

    expect(moonProjection.inViewport).toBe(true)
    expect(moonProjection.x).toBeCloseTo(162, -1)
    expect(moonProjection.y).toBeCloseTo(321, -1)
    expect(jupiterProjection.inViewport).toBe(true)
    expect(jupiterProjection.x).toBeCloseTo(168, -1)
    expect(jupiterProjection.y).toBeCloseTo(449, -1)
  })

  it('normalizes visible stars and on-screen constellation overlays from the bundled catalogs', () => {
    const stars = normalizeVisibleStars({
      observer: nyDayObserver as ObserverState,
      timeMs: nyDayObserver.timestampMs,
      enabledLayers: ENABLED_LAYERS,
      likelyVisibleOnly: false,
      sunAltitudeDeg: 12.61,
    })
    const pose = createPose(75, 78)
    const deneb = stars.find((entry) => entry.object.label === 'Deneb')
    const constellations = buildVisibleConstellations({
      cameraPose: pose,
      viewport: VIEWPORT,
      enabledLayers: ENABLED_LAYERS,
      likelyVisibleOnly: false,
      sunAltitudeDeg: 12.61,
      visibleStars: stars,
      starCatalog: loadStarCatalog(),
    })

    expect(deneb?.object.label).toBe('Deneb')
    const denebProjection = projectWorldPointToScreen(pose, deneb!.object, VIEWPORT)
    expect(denebProjection.inViewport).toBe(true)
    expect(denebProjection.x).toBeCloseTo(158, -1)
    expect(denebProjection.y).toBeCloseTo(476, -1)
    expect(constellations.objects.map((object) => object.label)).toContain('Cygnus')
    expect(constellations.lineSegments.length).toBeGreaterThan(1)
  })

  it('suppresses stars and constellations when likely-visible-only daylight rules are active', () => {
    const stars = normalizeVisibleStars({
      observer: nyDayObserver as ObserverState,
      timeMs: nyDayObserver.timestampMs,
      enabledLayers: ENABLED_LAYERS,
      likelyVisibleOnly: true,
      sunAltitudeDeg: 12.61,
    })
    const constellations = buildVisibleConstellations({
      cameraPose: createPose(75, 78),
      viewport: VIEWPORT,
      enabledLayers: ENABLED_LAYERS,
      likelyVisibleOnly: true,
      sunAltitudeDeg: 12.61,
      visibleStars: stars,
      starCatalog: loadStarCatalog(),
    })

    expect(stars).toEqual([])
    expect(constellations.objects).toEqual([])
    expect(constellations.lineSegments).toEqual([])
  })

  it('adds scope render metadata only in scope mode and filters stars through the optics limit after existing gates', () => {
    const baselineStars = normalizeVisibleStars({
      observer: nyDayObserver as ObserverState,
      timeMs: nyDayObserver.timestampMs,
      enabledLayers: ENABLED_LAYERS,
      likelyVisibleOnly: false,
      sunAltitudeDeg: 12.61,
    })
    const scopeStars = normalizeVisibleStars({
      observer: nyDayObserver as ObserverState,
      timeMs: nyDayObserver.timestampMs,
      enabledLayers: ENABLED_LAYERS,
      likelyVisibleOnly: false,
      sunAltitudeDeg: 12.61,
      scopeModeEnabled: true,
      scopeOptics: {
        apertureMm: 40,
        magnificationX: 10,
        transparencyPct: 40,
      },
    })

    expect(baselineStars.length).toBeGreaterThanOrEqual(scopeStars.length)
    expect(
      baselineStars.every((entry) => entry.object.metadata.scopeRender === undefined),
    ).toBe(true)
    expect(scopeStars.length).toBeGreaterThan(0)
    expect(
      scopeStars.every((entry) => {
        const scopeRender = entry.object.metadata.scopeRender as
          | {
              effectiveLimitMag?: number
              intensity?: number
              haloPx?: number
            }
          | undefined

        return (
          scopeRender !== undefined &&
          Number.isFinite(scopeRender.effectiveLimitMag) &&
          Number.isFinite(scopeRender.intensity) &&
          Number.isFinite(scopeRender.haloPx)
        )
      }),
    ).toBe(true)
  })

  it('locks celestial, star, and constellation detail payload fields', () => {
    const celestial = normalizeCelestialObjects({
      observer: sfEveningObserver as ObserverState,
      timeMs: sfEveningObserver.timestampMs,
      enabledLayers: ENABLED_LAYERS,
      likelyVisibleOnly: true,
    })
    const stars = normalizeVisibleStars({
      observer: nyDayObserver as ObserverState,
      timeMs: nyDayObserver.timestampMs,
      enabledLayers: ENABLED_LAYERS,
      likelyVisibleOnly: false,
      sunAltitudeDeg: 12.61,
    })
    const constellations = buildVisibleConstellations({
      cameraPose: createPose(75, 78),
      viewport: VIEWPORT,
      enabledLayers: ENABLED_LAYERS,
      likelyVisibleOnly: false,
      sunAltitudeDeg: 12.61,
      visibleStars: stars,
      starCatalog: loadStarCatalog(),
    })

    const moonDetail = requireDetail(requireObject(celestial.objects, 'moon'))
    const starDetail = requireDetail(stars[0].object)
    const constellationDetail = requireDetail(constellations.objects[0])

    expect(moonDetail).toMatchObject({
      typeLabel: 'Moon',
      azimuthDeg: expect.any(Number),
      elevationDeg: expect.any(Number),
    })
    expect(starDetail).toMatchObject({
      typeLabel: 'Star',
      magnitude: expect.any(Number),
      elevationDeg: expect.any(Number),
    })
    expect(constellationDetail).toEqual({
      typeLabel: 'Constellation',
      summaryText: 'Major star pattern',
    })
  })
})

function createPose(yawDeg: number, pitchDeg: number): CameraPose {
  return {
    yawDeg,
    pitchDeg,
    rollDeg: 0,
    quaternion: createCameraQuaternion(yawDeg, pitchDeg, 0),
    alignmentHealth: 'good',
    mode: 'sensor',
  }
}

function requireObject(objects: readonly SkyObject[], id: string) {
  const object = objects.find((entry) => entry.id === id)

  if (!object) {
    throw new Error(`Missing sky object ${id}.`)
  }

  return object
}

function requireDetail(object: SkyObject) {
  const detail = object.metadata.detail

  if (!detail || typeof detail !== 'object') {
    throw new Error(`Missing detail metadata for ${object.id}.`)
  }

  return detail
}
