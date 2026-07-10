import React from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: vi.fn(),
  }),
}))

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    React.createElement('a', { href, ...props }, children),
}))

import {
  getPermissionRecoveryAction,
  getPermissionRecoveryHandlerId,
  resolveViewerBannerFeed,
} from '../../components/viewer/viewer-shell'

describe('resolveViewerBannerFeed', () => {
  it('prefers the highest-priority actionable banner and keeps overflow ordering deterministic', () => {
    const result = resolveViewerBannerFeed({
      astronomyFailureBanner: null,
      demoScenario: null,
      cameraStatus: 'granted',
      cameraRetryAvailable: true,
      motionRecovery: {
        body: 'Retry motion from the viewer.',
        actionLabel: 'Retry motion',
        actionDisabled: false,
        footer: null,
      },
      locationError: 'Location did not resolve in time.',
      locationRetryAvailable: true,
      cameraError: 'Rear camera could not attach.',
      startupState: 'sensor-relative-needs-calibration',
      calibrationTargetLabel: 'Moon',
      calibrationBanner: 'Calibration is active.',
      showAlignmentGuidance: true,
      alignmentActionAvailable: true,
      manualMode: false,
    })

    expect(result.primary).toMatchObject({
      id: 'motion-recovery',
      actionId: 'recover-motion',
      actionLabel: 'Retry motion',
    })
    expect(result.overflow.map((banner) => banner.id)).toEqual([
      'relative-calibration',
      'alignment-guidance',
      'location',
      'camera',
      'calibration',
    ])
    expect(result.compactNotice).toBeNull()
  })

  it('falls back to the highest-priority non-actionable banner when no actions are available', () => {
    const result = resolveViewerBannerFeed({
      astronomyFailureBanner: 'SkyLens switched to the demo sky.',
      demoScenario: {
        label: 'San Francisco evening',
        description: 'Static twilight demo.',
      },
      cameraStatus: null,
      cameraRetryAvailable: false,
      motionRecovery: null,
      locationError: null,
      locationRetryAvailable: false,
      cameraError: null,
      startupState: 'sensor-absolute',
      calibrationTargetLabel: 'Moon',
      calibrationBanner: 'Calibration is active.',
      showAlignmentGuidance: false,
      alignmentActionAvailable: false,
      manualMode: false,
    })

    expect(result.primary).toMatchObject({
      id: 'astronomy',
      critical: true,
    })
    expect(result.overflow.map((banner) => banner.id)).toEqual(['calibration', 'demo'])
    expect(result.compactNotice).toBeNull()
  })

  it('drops alignment actions when the surface should stay informational only', () => {
    const result = resolveViewerBannerFeed({
      astronomyFailureBanner: null,
      demoScenario: null,
      cameraStatus: 'granted',
      cameraRetryAvailable: false,
      motionRecovery: null,
      locationError: null,
      locationRetryAvailable: false,
      cameraError: null,
      startupState: 'sensor-relative-needs-calibration',
      calibrationTargetLabel: 'Sun',
      calibrationBanner: null,
      showAlignmentGuidance: true,
      alignmentActionAvailable: false,
      manualMode: false,
    })

    expect(result.primary).toMatchObject({
      id: 'relative-calibration',
      actionId: undefined,
      actionLabel: undefined,
    })
    expect(result.overflow.map((banner) => banner.id)).toEqual(['alignment-guidance'])
    expect(result.compactNotice).toBeNull()
  })

  it('keeps the camera fallback banner for live unavailable-camera states', () => {
    const result = resolveViewerBannerFeed({
      astronomyFailureBanner: null,
      demoScenario: null,
      cameraStatus: 'unavailable',
      cameraRetryAvailable: true,
      motionRecovery: null,
      locationError: null,
      locationRetryAvailable: false,
      cameraError: null,
      startupState: 'sensor-absolute',
      calibrationTargetLabel: 'Moon',
      calibrationBanner: null,
      showAlignmentGuidance: false,
      alignmentActionAvailable: false,
      manualMode: false,
    })

    expect(result.primary).toMatchObject({
      id: 'camera-disabled',
      actionId: 'retry-camera',
      actionLabel: 'Enable camera',
    })
    expect(result.overflow).toEqual([])
    expect(result.compactNotice).toBeNull()
  })

  it('does not synthesize a camera banner while startup is still pending', () => {
    const result = resolveViewerBannerFeed({
      astronomyFailureBanner: null,
      demoScenario: null,
      cameraStatus: null,
      cameraRetryAvailable: false,
      motionRecovery: null,
      locationError: null,
      locationRetryAvailable: false,
      cameraError: null,
      startupState: 'ready-to-request',
      calibrationTargetLabel: 'Moon',
      calibrationBanner: null,
      showAlignmentGuidance: false,
      alignmentActionAvailable: false,
      manualMode: false,
    })

    expect(result.primary).toBeNull()
    expect(result.overflow).toEqual([])
    expect(result.compactNotice).toBeNull()
  })

  it('keeps motion-pending copy visible as a compact notice when another action becomes primary', () => {
    const result = resolveViewerBannerFeed({
      astronomyFailureBanner: null,
      demoScenario: null,
      cameraStatus: 'denied',
      cameraRetryAvailable: true,
      motionRecovery: null,
      locationError: null,
      locationRetryAvailable: false,
      cameraError: null,
      startupState: 'awaiting-orientation',
      calibrationTargetLabel: 'Moon',
      calibrationBanner: null,
      showAlignmentGuidance: false,
      alignmentActionAvailable: false,
      manualMode: false,
    })

    expect(result.primary).toMatchObject({
      id: 'camera-disabled',
      actionId: 'retry-camera',
    })
    expect(result.compactNotice).toMatchObject({
      id: 'awaiting-orientation',
      title: 'Waiting for motion data.',
    })
    expect(result.primary?.id).not.toBe(result.compactNotice?.id)
    expect(result.overflow.map((banner) => banner.id)).toEqual(['awaiting-orientation'])
  })
})

describe('getPermissionRecoveryAction', () => {
  it('uses the camera-only recovery action when motion is already granted', () => {
    expect(
      getPermissionRecoveryAction({
        entry: 'live',
        location: 'granted',
        camera: 'denied',
        orientation: 'granted',
      }),
    ).toEqual({
      kind: 'camera-only',
      label: 'Enable camera',
      pendingLabel: 'Starting AR...',
    })
  })

  it('keeps the combined recovery action only when both camera and motion are missing', () => {
    expect(
      getPermissionRecoveryAction({
        entry: 'live',
        location: 'granted',
        camera: 'denied',
        orientation: 'denied',
      }),
    ).toEqual({
      kind: 'camera-and-motion',
      label: 'Enable camera and motion',
      pendingLabel: 'Starting AR...',
    })
  })

  it('uses the motion-only recovery action when camera is already granted', () => {
    expect(
      getPermissionRecoveryAction({
        entry: 'live',
        location: 'granted',
        camera: 'granted',
        orientation: 'denied',
      }),
    ).toEqual({
      kind: 'motion-only',
      label: 'Enable motion',
      pendingLabel: 'Retrying motion...',
    })
  })

  it('returns a ready state when camera and motion are already granted', () => {
    expect(
      getPermissionRecoveryAction({
        entry: 'live',
        location: 'granted',
        camera: 'granted',
        orientation: 'granted',
      }),
    ).toEqual({
      kind: 'none',
      label: 'Enable AR',
      pendingLabel: 'Starting AR...',
    })
  })
})

describe('getPermissionRecoveryHandlerId', () => {
  it('maps camera-only recovery to the camera retry handler', () => {
    expect(getPermissionRecoveryHandlerId('camera-only')).toBe('retry-camera')
  })

  it('maps motion-only recovery to the motion retry handler', () => {
    expect(getPermissionRecoveryHandlerId('motion-only')).toBe('retry-motion')
  })

  it('maps combined recovery to the full startup retry handler', () => {
    expect(getPermissionRecoveryHandlerId('camera-and-motion')).toBe('retry-all')
  })

  it('maps ready state to no recovery handler', () => {
    expect(getPermissionRecoveryHandlerId('none')).toBe('none')
  })
})
