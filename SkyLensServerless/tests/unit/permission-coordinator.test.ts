import { describe, expect, it, vi } from 'vitest'

import {
  buildViewerHref,
  createDemoViewerState,
  describeViewerExperience,
  hasVerifiedLiveViewerState,
  parseViewerRouteState,
  runStartFlow,
  supportsOrientationEvents,
  type PermissionStatusValue,
} from '../../lib/permissions/coordinator'

describe('permission coordinator', () => {
  it('requests permissions in the required order', async () => {
    const calls: string[] = []

    const routeState = await runStartFlow({
      requestLocation: vi.fn(async () => {
        calls.push('location')
        return 'granted' as PermissionStatusValue
      }),
      requestCamera: vi.fn(async () => {
        calls.push('camera')
        return 'denied' as PermissionStatusValue
      }),
      requestOrientation: vi.fn(async () => {
        calls.push('orientation')
        return 'granted' as PermissionStatusValue
      }),
    })

    expect(calls).toEqual(['orientation', 'camera', 'location'])
    expect(routeState).toEqual({
      entry: 'live',
      location: 'granted',
      camera: 'denied',
      orientation: 'granted',
    })
  })

  it('keeps camera and motion startup live even when location is denied', async () => {
    const requestCamera = vi.fn(async () => 'granted' as PermissionStatusValue)
    const requestOrientation = vi.fn(async () => 'granted' as PermissionStatusValue)

    const routeState = await runStartFlow({
      requestLocation: vi.fn(async () => 'denied' as PermissionStatusValue),
      requestCamera,
      requestOrientation,
    })

    expect(routeState).toEqual({
      entry: 'live',
      location: 'denied',
      camera: 'granted',
      orientation: 'granted',
    })
    expect(requestCamera).toHaveBeenCalledTimes(1)
    expect(requestOrientation).toHaveBeenCalledTimes(1)
    expect(describeViewerExperience(routeState).mode).toBe('live')
  })

  it('builds and parses the shared demo route state', () => {
    const demoState = createDemoViewerState('tokyo-iss')
    const href = buildViewerHref(demoState)

    expect(href).toContain('/view?')
    expect(href).toContain('demoScenario=tokyo-iss')
    expect(parseViewerRouteState(new URLSearchParams(href.split('?')[1]))).toEqual(
      demoState,
    )
    expect(describeViewerExperience(demoState).mode).toBe('demo')
  })

  it('prioritizes manual pan when motion permission is denied', () => {
    const routeState = parseViewerRouteState(
      new URLSearchParams({
        entry: 'live',
        location: 'granted',
        camera: 'granted',
        orientation: 'denied',
      }),
    )

    expect(describeViewerExperience(routeState)).toMatchObject({
      mode: 'manual-pan',
      title: 'Manual pan fallback',
    })
  })

  it('enters non-camera fallback when camera is denied but motion is ready', () => {
    const routeState = parseViewerRouteState(
      new URLSearchParams({
        entry: 'live',
        location: 'granted',
        camera: 'denied',
        orientation: 'granted',
      }),
    )

    expect(describeViewerExperience(routeState)).toMatchObject({
      mode: 'non-camera',
      title: 'Non-camera fallback',
    })
  })

  it('blocks bare /view until a full permission result is present', () => {
    const routeState = parseViewerRouteState(new URLSearchParams())

    expect(routeState).toEqual({
      entry: 'live',
      location: 'unknown',
      camera: 'unknown',
      orientation: 'unknown',
    })
    expect(describeViewerExperience(routeState)).toMatchObject({
      mode: 'blocked',
      title: 'Start AR to continue',
    })
  })

  it('keeps the bare route permission-only so viewer-shell can own interaction mode locally', () => {
    const routeState = parseViewerRouteState(new URLSearchParams())

    expect(Object.keys(routeState).sort()).toEqual([
      'camera',
      'entry',
      'location',
      'orientation',
    ])
  })

  it('blocks partial live state until camera and motion status are explicit', () => {
    const routeState = parseViewerRouteState(
      new URLSearchParams({
        entry: 'live',
        location: 'granted',
      }),
    )

    expect(routeState).toEqual({
      entry: 'live',
      location: 'granted',
      camera: 'unknown',
      orientation: 'unknown',
    })
    expect(describeViewerExperience(routeState)).toMatchObject({
      mode: 'blocked',
      title: 'Start AR to continue',
    })
    expect(hasVerifiedLiveViewerState(routeState)).toBe(false)
  })

  it('requires actual deviceorientation event support before marking motion ready', () => {
    expect(
      supportsOrientationEvents({
        ondeviceorientationabsolute: null,
        ondeviceorientation: null,
      }),
    ).toBe(true)

    expect(supportsOrientationEvents({})).toBe(false)
  })

  it('treats live, non-camera, and manual-pan states as verified for sensor startup', () => {
    expect(
      hasVerifiedLiveViewerState(
        parseViewerRouteState(
          new URLSearchParams({
            entry: 'live',
            location: 'granted',
            camera: 'granted',
            orientation: 'granted',
          }),
        ),
      ),
    ).toBe(true)

    expect(
      hasVerifiedLiveViewerState(
        parseViewerRouteState(
          new URLSearchParams({
            entry: 'live',
            location: 'granted',
            camera: 'denied',
            orientation: 'granted',
          }),
        ),
      ),
    ).toBe(true)

    expect(
      hasVerifiedLiveViewerState(
        parseViewerRouteState(
          new URLSearchParams({
            entry: 'live',
            location: 'granted',
            camera: 'granted',
            orientation: 'denied',
          }),
        ),
      ),
    ).toBe(true)

    expect(
      hasVerifiedLiveViewerState(
        parseViewerRouteState(
          new URLSearchParams({
            entry: 'live',
            location: 'granted',
            camera: 'granted',
          }),
        ),
      ),
    ).toBe(false)

    expect(hasVerifiedLiveViewerState(createDemoViewerState())).toBe(false)
  })
})
