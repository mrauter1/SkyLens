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
  canResetCalibration,
  manualMode,
  preferredTargetUnavailable,
}: {
  resolvedTargetLabel: string
  selectedTarget: AlignmentTargetPreference
  calibrationStatus: string
  canFixAlignment: boolean
  canAlignCalibration: boolean
  canResetCalibration: boolean
  manualMode: boolean
  preferredTargetUnavailable: boolean
}) {
  const selectedTargetLabel = selectedTarget === 'sun' ? 'Sun' : 'Moon'

  const notices: AlignmentTutorialNotice[] = [
    {
      id: 'status',
      tone: 'status',
      text: calibrationStatus,
    },
  ]

  if (preferredTargetUnavailable) {
    notices.push({
      id: 'fallback',
      tone: 'warning',
      text: `${selectedTargetLabel} is unavailable. SkyLens will use ${resolvedTargetLabel} if you align now.`,
    })
  }

  if (!canFixAlignment) {
    notices.push({
      id: 'mode-blocker',
      tone: 'warning',
      text: 'Live sensor alignment is unavailable in the current mode. Manual nudges and field-of-view calibration are still available.',
    })
  } else if (!canAlignCalibration) {
    notices.push({
      id: 'align-blocker',
      tone: 'warning',
      text: manualMode
        ? 'Align is unavailable while manual panning is active. Return to live sensors to run alignment again.'
        : `Align stays disabled until live motion data is ready. SkyLens will keep ${resolvedTargetLabel} as the next target.`,
    })
  }

  const nextAction = canAlignCalibration
    ? `Center ${resolvedTargetLabel} in the crosshair, then press the middle of the screen to align.`
    : manualMode
      ? 'Return to live sensors to align from the center crosshair.'
      : `Wait for live motion data, then press the middle of the screen to align to ${resolvedTargetLabel}.`

  return {
    alignActionLabel: canAlignCalibration
      ? `Align to ${resolvedTargetLabel}`
      : 'Waiting for motion sample',
    focusPrompt: `Press the middle of the screen to align to ${resolvedTargetLabel}.`,
    nextAction,
    notices,
  }
}
