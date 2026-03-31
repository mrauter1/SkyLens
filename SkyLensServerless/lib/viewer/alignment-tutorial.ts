export type AlignmentTargetPreference = 'sun' | 'moon'

export type AlignmentTargetAvailability = {
  sun: boolean
  moon: boolean
}

export type AlignmentTutorialNotice = {
  id: string
  tone: 'status' | 'warning'
  text: string
}

export type AlignmentTutorialPrimaryStep = {
  id: 'align-now' | 'return-to-live-sensors' | 'waiting-for-motion' | 'alignment-unavailable'
  title: string
  body: string
  ctaLabel: string | null
}

export const ALIGNMENT_FINE_ADJUST_CONTROLS: Array<{
  axis: 'yaw' | 'pitch'
  deltaDeg: number
  label: string
}> = [
  {
    axis: 'yaw',
    deltaDeg: -0.75,
    label: 'Nudge left',
  },
  {
    axis: 'yaw',
    deltaDeg: 0.75,
    label: 'Nudge right',
  },
  {
    axis: 'pitch',
    deltaDeg: 0.5,
    label: 'Nudge up',
  },
  {
    axis: 'pitch',
    deltaDeg: -0.5,
    label: 'Nudge down',
  },
]

export function buildAlignmentTutorialModel({
  resolvedTargetLabel,
  selectedTarget,
  calibrationStatus,
  canFixAlignment,
  canAlignCalibration,
  manualMode,
  preferredTargetUnavailable,
}: {
  resolvedTargetLabel: string
  selectedTarget: AlignmentTargetPreference
  calibrationStatus: string
  canFixAlignment: boolean
  canAlignCalibration: boolean
  manualMode: boolean
  preferredTargetUnavailable: boolean
}) {
  const selectedTargetLabel = selectedTarget === 'sun' ? 'Sun' : 'Moon'

  const supportingNotice: AlignmentTutorialNotice | null = preferredTargetUnavailable
    ? {
        id: 'fallback',
        tone: 'warning',
        text: `${selectedTargetLabel} is unavailable. SkyLens will use ${resolvedTargetLabel} for the next alignment pass.`,
      }
    : null

  const primaryStep: AlignmentTutorialPrimaryStep = canAlignCalibration
    ? {
        id: 'align-now',
        title: `Align to ${resolvedTargetLabel}`,
        body: `Center ${resolvedTargetLabel} in the crosshair, then start alignment from the live camera view.`,
        ctaLabel: `Start alignment`,
      }
    : manualMode
      ? {
          id: 'return-to-live-sensors',
          title: 'Return to live sensors',
          body: 'Alignment works only with live sensor motion. Exit manual pan or demo mode, then reopen Alignment.',
          ctaLabel: null,
        }
      : !canFixAlignment
        ? {
            id: 'alignment-unavailable',
            title: 'Alignment is unavailable',
            body: 'Live sensor alignment is unavailable in the current mode. Manual nudges and field-of-view calibration remain available.',
            ctaLabel: null,
          }
        : {
            id: 'waiting-for-motion',
            title: 'Waiting for motion data',
            body: `SkyLens will enable alignment after the next usable live motion sample arrives for ${resolvedTargetLabel}.`,
            ctaLabel: 'Start alignment',
          }

  return {
    status: calibrationStatus,
    primaryStep,
    supportingNotice,
  }
}
