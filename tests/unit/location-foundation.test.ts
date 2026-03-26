import { describe, expect, it, vi } from 'vitest'

import nyDayFixture from '../fixtures/observer/ny_day.json'
import sfEveningFixture from '../fixtures/observer/sf_evening.json'
import {
  getDistanceMeters,
  requestStartupObserverState,
  shouldAcceptObserverUpdate,
  startObserverTracking,
  toObserverState,
} from '../../lib/sensors/location'

describe('location foundation', () => {
  it('normalizes altitude to zero when the device does not provide it', () => {
    expect(
      toObserverState(
        {
          coords: {
            latitude: sfEveningFixture.lat,
            longitude: sfEveningFixture.lon,
            altitude: null,
            accuracy: 12,
          },
          timestamp: 1234,
        },
        'live',
      ),
    ).toMatchObject({
      lat: sfEveningFixture.lat,
      lon: sfEveningFixture.lon,
      altMeters: 0,
      accuracyMeters: 12,
      timestampMs: 1234,
      source: 'live',
    })
  })

  it('accepts updates only after the 25 meter or 15 second thresholds', () => {
    const base = {
      ...sfEveningFixture,
      source: 'live' as const,
    }

    expect(
      shouldAcceptObserverUpdate(base, {
        ...base,
        lat: base.lat + 0.00005,
        timestampMs: base.timestampMs + 5_000,
      }),
    ).toBe(false)

    expect(
      shouldAcceptObserverUpdate(base, {
        ...base,
        lat: base.lat + 0.0003,
        timestampMs: base.timestampMs + 5_000,
      }),
    ).toBe(true)

    expect(
      shouldAcceptObserverUpdate(base, {
        ...base,
        timestampMs: base.timestampMs + 15_000,
      }),
    ).toBe(true)
  })

  it('tracks watch-position updates behind the gating thresholds', () => {
    const delivered: ReturnType<typeof toObserverState>[] = []
    let successCallback: ((position: GeolocationPosition) => void) | undefined
    const watchPosition = vi.fn((success) => {
      successCallback = success
      return 17
    })
    const clearWatch = vi.fn()

    const tracker = startObserverTracking(
      (observer) => delivered.push(observer),
      {
        initialObserver: {
          ...sfEveningFixture,
          source: 'live',
        },
        runtime: {
          getCurrentPosition: vi.fn(),
          clearWatch,
          watchPosition,
        },
      },
    )

    successCallback?.({
      coords: {
        latitude: sfEveningFixture.lat + 0.00001,
        longitude: sfEveningFixture.lon,
        altitude: 16,
        accuracy: 10,
      },
      timestamp: sfEveningFixture.timestampMs + 1_000,
    } as GeolocationPosition)
    successCallback?.({
      coords: {
        latitude: sfEveningFixture.lat + 0.00035,
        longitude: sfEveningFixture.lon,
        altitude: 16,
        accuracy: 10,
      },
      timestamp: sfEveningFixture.timestampMs + 2_000,
    } as GeolocationPosition)

    expect(delivered).toHaveLength(1)
    expect(delivered[0].lat).toBeCloseTo(sfEveningFixture.lat + 0.00035, 6)
    expect(watchPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      {
        enableHighAccuracy: false,
        maximumAge: 5_000,
        timeout: 15_000,
      },
    )

    tracker.stop()
    expect(clearWatch).toHaveBeenCalledWith(17)
  })

  it('requests the startup fix with the locked high-accuracy geolocation options', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback, _error, options) => {
      expect(options).toEqual({
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10_000,
      })

      success({
        coords: {
          latitude: sfEveningFixture.lat,
          longitude: sfEveningFixture.lon,
          altitude: null,
          accuracy: 8,
        },
        timestamp: sfEveningFixture.timestampMs,
      } as GeolocationPosition)
    })

    await expect(
      requestStartupObserverState({
        getCurrentPosition,
      }),
    ).resolves.toMatchObject({
      lat: sfEveningFixture.lat,
      lon: sfEveningFixture.lon,
      altMeters: 0,
      accuracyMeters: 8,
      timestampMs: sfEveningFixture.timestampMs,
      source: 'live',
    })
  })

  it('keeps the observer fixtures deterministic for later astronomy work', () => {
    expect(getDistanceMeters(sfEveningFixture, nyDayFixture)).toBeGreaterThan(4_000_000)
  })
})
