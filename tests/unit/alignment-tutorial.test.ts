import { describe, expect, it } from 'vitest'

import { buildAlignmentTutorialModel } from '../../lib/viewer/alignment-tutorial'

describe('buildAlignmentTutorialModel', () => {
  it('returns a single primary alignment step with one CTA when alignment can start', () => {
    const result = buildAlignmentTutorialModel({
      resolvedTargetLabel: 'Moon',
      selectedTarget: 'sun',
      calibrationStatus: 'Calibration is active.',
      canFixAlignment: true,
      canAlignCalibration: true,
      manualMode: false,
      preferredTargetUnavailable: true,
    })

    expect(result).toMatchObject({
      status: 'Calibration is active.',
      primaryStep: {
        id: 'align-now',
        title: 'Align to Moon',
        body: 'Center Moon in the crosshair, then start alignment from the live camera view.',
        ctaLabel: 'Start alignment',
      },
      supportingNotice: {
        id: 'fallback',
        tone: 'warning',
        text: 'Sun is unavailable. SkyLens will use Moon for the next alignment pass.',
      },
    })
  })

  it('returns a waiting step without a CTA while motion data is still pending', () => {
    const result = buildAlignmentTutorialModel({
      resolvedTargetLabel: 'Sun',
      selectedTarget: 'sun',
      calibrationStatus: 'Relative motion is active.',
      canFixAlignment: true,
      canAlignCalibration: false,
      manualMode: false,
      preferredTargetUnavailable: false,
    })

    expect(result.primaryStep).toEqual({
      id: 'waiting-for-motion',
      title: 'Waiting for motion data',
      body: 'SkyLens will enable alignment after the next usable live motion sample arrives for Sun.',
      ctaLabel: 'Start alignment',
    })
    expect(result.supportingNotice).toBeNull()
  })

  it('returns a live-sensors step instead of a start action in manual mode', () => {
    const result = buildAlignmentTutorialModel({
      resolvedTargetLabel: 'Moon',
      selectedTarget: 'moon',
      calibrationStatus: 'Manual pose is active.',
      canFixAlignment: true,
      canAlignCalibration: false,
      manualMode: true,
      preferredTargetUnavailable: false,
    })

    expect(result.primaryStep).toEqual({
      id: 'return-to-live-sensors',
      title: 'Return to live sensors',
      body: 'Alignment works only with live sensor motion. Exit manual pan or demo mode, then reopen Alignment.',
      ctaLabel: null,
    })
  })

  it('returns an unavailable step when live alignment cannot run in the current mode', () => {
    const result = buildAlignmentTutorialModel({
      resolvedTargetLabel: 'Sun',
      selectedTarget: 'sun',
      calibrationStatus: 'Live alignment is paused.',
      canFixAlignment: false,
      canAlignCalibration: false,
      manualMode: false,
      preferredTargetUnavailable: false,
    })

    expect(result.primaryStep).toEqual({
      id: 'alignment-unavailable',
      title: 'Alignment is unavailable',
      body: 'Live sensor alignment is unavailable in the current mode. Manual nudges and field-of-view calibration remain available.',
      ctaLabel: null,
    })
    expect(result.supportingNotice).toBeNull()
  })
})
