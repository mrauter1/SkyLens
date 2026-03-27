'use client'

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'

import type { EnabledLayer } from '../../lib/config'
import type { DemoScenarioId } from '../../lib/demo/scenarios'
import type { LabelDisplayMode, MotionQuality } from '../../lib/viewer/settings'

type AlignmentTargetPreference = 'sun' | 'moon'

type SettingsSheetProps = {
  onEnterDemoMode: () => void
  onDemoScenarioSelect?: (scenarioId: DemoScenarioId) => void
  onFixAlignment?: () => void
  onAlignCalibration?: () => void
  onAlignmentTargetPreferenceChange?: (target: AlignmentTargetPreference) => void
  onResetCalibration?: () => void
  onFineAdjustCalibration?: (adjustment: {
    axis: 'yaw' | 'pitch'
    deltaDeg: number
  }) => void
  onRecenter?: () => void
  canFixAlignment?: boolean
  canAlignCalibration?: boolean
  canResetCalibration?: boolean
  canRecenter?: boolean
  calibrationTargetLabel?: string
  calibrationTargetDescription?: string
  calibrationStatus?: string
  calibrationInstructions?: string[]
  alignmentTargetPreference?: AlignmentTargetPreference
  alignmentTargetAvailability?: {
    sun: boolean
    moon: boolean
  }
  alignmentTargetFallbackLabel?: string | null
  verticalFovAdjustmentDeg?: number
  cameraDevices?: Array<{
    deviceId: string
    label: string
  }>
  selectedCameraDeviceId?: string | null
  layers: Record<EnabledLayer, boolean>
  layerAvailabilityLabels?: Partial<Record<EnabledLayer, string>>
  likelyVisibleOnly: boolean
  labelDisplayMode: LabelDisplayMode
  motionQuality: MotionQuality
  onLayerToggle: (layer: EnabledLayer, enabled: boolean) => void
  onLikelyVisibleOnlyChange: (enabled: boolean) => void
  onLabelDisplayModeChange: (mode: LabelDisplayMode) => void
  onMotionQualityChange: (quality: MotionQuality) => void
  onVerticalFovAdjustmentChange?: (value: number) => void
  onSelectedCameraDeviceChange?: (deviceId: string) => void
  demoScenarioId?: DemoScenarioId
  demoScenarioOptions?: Array<{
    id: DemoScenarioId
    label: string
  }>
}

const LAYER_LABELS = [
  ['aircraft', 'Planes'],
  ['satellites', 'Satellites'],
  ['planets', 'Planets'],
  ['stars', 'Stars'],
  ['constellations', 'Constellations'],
] as const

const LABEL_DISPLAY_MODE_OPTIONS: Array<{
  id: LabelDisplayMode
  label: string
  description: string
}> = [
  {
    id: 'center_only',
    label: 'Center only',
    description: 'Show identification only for the object in the crosshair.',
  },
  {
    id: 'on_objects',
    label: 'On objects',
    description: 'Pin labels near visible objects.',
  },
  {
    id: 'top_list',
    label: 'Top list',
    description: 'List all visible object names across the top.',
  },
]

const MOTION_QUALITY_OPTIONS: Array<{
  id: MotionQuality
  label: string
  description: string
}> = [
  {
    id: 'low',
    label: 'Low',
    description: 'Battery-conscious cadence with a short direction vector only.',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Moderate trails for moving objects at the default viewer cadence.',
  },
  {
    id: 'high',
    label: 'High',
    description: 'Longest moving-object trails with the highest animation cadence.',
  },
]

export function SettingsSheet({
  onEnterDemoMode,
  onDemoScenarioSelect,
  onFixAlignment,
  onAlignCalibration,
  onAlignmentTargetPreferenceChange,
  onResetCalibration,
  onFineAdjustCalibration,
  onRecenter,
  canFixAlignment = false,
  canAlignCalibration = false,
  canResetCalibration = false,
  canRecenter = false,
  calibrationTargetLabel = 'North marker',
  calibrationTargetDescription = 'Use north on the horizon when no sky body is suitable.',
  calibrationStatus = 'Calibration is off.',
  calibrationInstructions = [
    'Choose the Sun or Moon target for this alignment pass.',
    'Center the current target in the reticle.',
    'Tap Align to lock labels to the target.',
    'If labels still drift, fine-adjust or reset calibration.',
  ],
  alignmentTargetPreference = 'sun',
  alignmentTargetAvailability = {
    sun: false,
    moon: false,
  },
  alignmentTargetFallbackLabel = null,
  verticalFovAdjustmentDeg = 0,
  cameraDevices = [],
  selectedCameraDeviceId = null,
  layers,
  layerAvailabilityLabels,
  likelyVisibleOnly,
  labelDisplayMode,
  motionQuality,
  onLayerToggle,
  onLikelyVisibleOnlyChange,
  onLabelDisplayModeChange,
  onMotionQualityChange,
  onVerticalFovAdjustmentChange,
  onSelectedCameraDeviceChange,
  demoScenarioId,
  demoScenarioOptions = [],
}: SettingsSheetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showCalibrationPanel, setShowCalibrationPanel] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const panelId = useId()

  useEffect(() => {
    if (!isOpen) {
      if (previousFocusRef.current) {
        previousFocusRef.current.focus()
        previousFocusRef.current = null
      }
      return
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    closeButtonRef.current?.focus()
  }, [isOpen])

  const closeSheet = () => {
    setIsOpen(false)
  }

  const handlePanelKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeSheet()
      return
    }

    if (event.key !== 'Tab' || !panelRef.current) {
      return
    }

    const focusableElements = getFocusableElements(panelRef.current)

    if (focusableElements.length === 0) {
      return
    }

    const firstFocusable = focusableElements[0]
    const lastFocusable = focusableElements[focusableElements.length - 1]
    const activeElement = document.activeElement

    if (event.shiftKey && activeElement === firstFocusable) {
      event.preventDefault()
      lastFocusable.focus()
      return
    }

    if (!event.shiftKey && activeElement === lastFocusable) {
      event.preventDefault()
      firstFocusable.focus()
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="min-h-11 rounded-full border border-sky-100/15 bg-slate-950/45 px-4 py-2 text-sm text-sky-50"
      >
        Settings
      </button>
      {isOpen ? (
        <section
          id={panelId}
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="shell-panel absolute inset-x-4 bottom-24 z-30 rounded-[1.75rem] p-5"
          onKeyDown={handlePanelKeyDown}
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-sky-200/60">
                Viewer controls
              </p>
              <h2
                id={titleId}
                className="text-lg font-semibold text-white"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Settings
              </h2>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeSheet}
              className="min-h-11 rounded-full border border-sky-100/15 px-3 py-1 text-sm text-sky-50"
            >
              Close
            </button>
          </div>
          <div className="grid gap-3">
            {LAYER_LABELS.map(([layerId, label]) => (
              <label
                key={layerId}
                className="flex items-center justify-between rounded-2xl border border-sky-100/10 bg-white/5 px-4 py-3 text-sm text-sky-50"
              >
                <span>
                  <span className="block">{label}</span>
                  {layerAvailabilityLabels?.[layerId] ? (
                    <span className="mt-1 block text-xs text-amber-200/85">
                      {layerAvailabilityLabels[layerId]}
                    </span>
                  ) : null}
                </span>
                <input
                  type="checkbox"
                  checked={layers[layerId]}
                  onChange={(event) =>
                    onLayerToggle(layerId, event.target.checked)
                  }
                  aria-label={label}
                />
              </label>
            ))}
            <label className="flex items-center justify-between rounded-2xl border border-sky-100/10 bg-white/5 px-4 py-3 text-sm text-sky-50">
              <span>Likely visible only</span>
              <input
                type="checkbox"
                checked={likelyVisibleOnly}
                onChange={(event) => onLikelyVisibleOnlyChange(event.target.checked)}
              />
            </label>
            <fieldset className="rounded-[1.5rem] border border-sky-100/10 bg-white/5 p-4">
              <legend className="px-1 text-xs uppercase tracking-[0.18em] text-sky-200/60">
                Label display
              </legend>
              <div className="mt-3 grid gap-2">
                {LABEL_DISPLAY_MODE_OPTIONS.map((option) => (
                  <label
                    key={option.id}
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      labelDisplayMode === option.id
                        ? 'border-amber-200/45 bg-amber-200/12 text-amber-50'
                        : 'border-sky-100/10 bg-slate-950/30 text-sky-50'
                    }`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span>
                        <span className="block font-medium">{option.label}</span>
                        <span className="mt-1 block text-xs text-sky-100/70">
                          {option.description}
                        </span>
                      </span>
                      <input
                        type="radio"
                        name="label-display-mode"
                        value={option.id}
                        checked={labelDisplayMode === option.id}
                        onChange={() => onLabelDisplayModeChange(option.id)}
                        aria-label={option.label}
                      />
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="rounded-[1.5rem] border border-sky-100/10 bg-white/5 p-4">
              <legend className="px-1 text-xs uppercase tracking-[0.18em] text-sky-200/60">
                Motion quality
              </legend>
              <div className="mt-3 grid gap-2">
                {MOTION_QUALITY_OPTIONS.map((option) => (
                  <label
                    key={option.id}
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      motionQuality === option.id
                        ? 'border-amber-200/45 bg-amber-200/12 text-amber-50'
                        : 'border-sky-100/10 bg-slate-950/30 text-sky-50'
                    }`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span>
                        <span className="block font-medium">{option.label}</span>
                        <span className="mt-1 block text-xs text-sky-100/70">
                          {option.description}
                        </span>
                      </span>
                      <input
                        type="radio"
                        name="motion-quality"
                        value={option.id}
                        checked={motionQuality === option.id}
                        onChange={() => onMotionQualityChange(option.id)}
                        aria-label={option.label}
                      />
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCalibrationPanel(true)
                  if (canFixAlignment) {
                    onFixAlignment?.()
                  }
                }}
                className="min-h-11 rounded-2xl border border-sky-100/10 bg-white/5 px-4 py-3 text-sm text-sky-200/55 disabled:cursor-not-allowed"
              >
                Alignment
              </button>
              <button
                type="button"
                onClick={onRecenter}
                className="min-h-11 rounded-2xl border border-sky-100/10 bg-white/5 px-4 py-3 text-sm text-sky-200/55 disabled:cursor-not-allowed"
                disabled={!canRecenter}
              >
                Recenter
              </button>
            </div>
            {cameraDevices.length > 0 ? (
              <label className="grid gap-2 rounded-[1.5rem] border border-sky-100/10 bg-white/5 p-4 text-sm text-sky-50">
                <span className="text-xs uppercase tracking-[0.18em] text-sky-200/60">
                  Camera source
                </span>
                <select
                  aria-label="Camera source"
                  value={selectedCameraDeviceId ?? ''}
                  onChange={(event) => onSelectedCameraDeviceChange?.(event.target.value)}
                  className="min-h-11 rounded-2xl border border-sky-100/10 bg-slate-950/35 px-4 py-3 text-sm text-sky-50"
                >
                  <option value="">Auto rear camera</option>
                  {cameraDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {showCalibrationPanel ? (
              <div className="grid gap-3 rounded-[1.5rem] border border-sky-100/10 bg-white/5 p-4">
                <div className="rounded-[1.25rem] border border-sky-100/10 bg-slate-950/30 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-sky-200/60">
                    Calibration target
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <AlignmentTargetButton
                      label="Sun"
                      target="sun"
                      selected={alignmentTargetPreference === 'sun'}
                      available={alignmentTargetAvailability.sun}
                      onSelect={onAlignmentTargetPreferenceChange}
                    />
                    <AlignmentTargetButton
                      label="Moon"
                      target="moon"
                      selected={alignmentTargetPreference === 'moon'}
                      available={alignmentTargetAvailability.moon}
                      onSelect={onAlignmentTargetPreferenceChange}
                    />
                  </div>
                  <p className="mt-2 text-base font-semibold text-white">
                    {calibrationTargetLabel}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-sky-100/75">
                    {calibrationTargetDescription}
                  </p>
                  {alignmentTargetFallbackLabel ? (
                    <p className="mt-3 text-sm leading-6 text-amber-100/80">
                      {alignmentTargetPreference === 'sun' ? 'Sun' : 'Moon'} is unavailable.
                      SkyLens will use {alignmentTargetFallbackLabel}.
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-amber-100/75">
                    {calibrationStatus}
                  </p>
                  {!canFixAlignment ? (
                    <p className="mt-3 text-sm leading-6 text-sky-100/70">
                      Live sensor alignment is unavailable in the current mode. Field-of-view
                      calibration still applies.
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-2 rounded-[1.25rem] border border-sky-100/10 bg-slate-950/30 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-sky-200/60">
                    Alignment steps
                  </p>
                  <ol className="grid gap-2 text-sm leading-6 text-sky-100/80">
                    {calibrationInstructions.map((instruction, index) => (
                      <li
                        key={`${instruction}-${index}`}
                        className="rounded-2xl border border-sky-100/10 bg-white/5 px-4 py-3"
                      >
                        <span className="mr-2 text-sky-200/70">{index + 1}.</span>
                        {instruction}
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={onAlignCalibration}
                    disabled={!canAlignCalibration}
                    className="min-h-11 rounded-2xl bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-amber-100"
                  >
                    Align to target
                  </button>
                  <button
                    type="button"
                    onClick={onResetCalibration}
                    disabled={!canResetCalibration}
                    className="min-h-11 rounded-2xl border border-sky-100/10 bg-slate-950/35 px-4 py-3 text-sm text-sky-50 disabled:cursor-not-allowed"
                  >
                    Reset calibration
                  </button>
                </div>
                <div className="grid gap-2 rounded-[1.25rem] border border-sky-100/10 bg-slate-950/30 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-sky-200/60">
                    Fine adjust
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onFineAdjustCalibration?.({ axis: 'yaw', deltaDeg: -0.75 })
                      }
                      className="min-h-11 rounded-2xl border border-sky-100/10 bg-white/5 px-4 py-3 text-sm text-sky-50"
                    >
                      Nudge left
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onFineAdjustCalibration?.({ axis: 'yaw', deltaDeg: 0.75 })
                      }
                      className="min-h-11 rounded-2xl border border-sky-100/10 bg-white/5 px-4 py-3 text-sm text-sky-50"
                    >
                      Nudge right
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onFineAdjustCalibration?.({ axis: 'pitch', deltaDeg: 0.5 })
                      }
                      className="min-h-11 rounded-2xl border border-sky-100/10 bg-white/5 px-4 py-3 text-sm text-sky-50"
                    >
                      Nudge up
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onFineAdjustCalibration?.({ axis: 'pitch', deltaDeg: -0.5 })
                      }
                      className="min-h-11 rounded-2xl border border-sky-100/10 bg-white/5 px-4 py-3 text-sm text-sky-50"
                    >
                      Nudge down
                    </button>
                  </div>
                </div>
                <RangeControl
                  label="Field of view"
                  min={-30}
                  max={30}
                  step={1}
                  value={verticalFovAdjustmentDeg}
                  suffix="°"
                  onChange={onVerticalFovAdjustmentChange}
                />
              </div>
            ) : null}
            {demoScenarioOptions.length > 0 ? (
              <div className="grid gap-2 rounded-[1.5rem] border border-sky-100/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-sky-200/60">
                  Demo scenarios
                </p>
                <div className="grid gap-2">
                  {demoScenarioOptions.map((scenario) => (
                    <button
                      key={scenario.id}
                      type="button"
                      onClick={() => onDemoScenarioSelect?.(scenario.id)}
                      className={`min-h-11 rounded-2xl border px-4 py-3 text-left text-sm ${
                        demoScenarioId === scenario.id
                          ? 'border-amber-200/45 bg-amber-200/12 text-amber-50'
                          : 'border-sky-100/10 bg-slate-950/30 text-sky-50'
                      }`}
                    >
                      {scenario.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={onEnterDemoMode}
              className="min-h-11 rounded-2xl bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950"
            >
              Enter demo mode
            </button>
          </div>
        </section>
      ) : null}
    </>
  )
}

function getFocusableElements(root: HTMLElement) {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute('hidden'))
}

function RangeControl({
  label,
  min,
  max,
  step,
  value,
  suffix,
  onChange,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  suffix: string
  onChange?: (value: number) => void
}) {
  return (
    <label className="grid gap-2 text-sm text-sky-50">
      <span className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <span className="text-xs uppercase tracking-[0.16em] text-sky-200/65">
          {value > 0 ? '+' : ''}
          {value}
          {suffix}
        </span>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange?.(Number(event.target.value))}
      />
    </label>
  )
}

function AlignmentTargetButton({
  label,
  target,
  selected,
  available,
  onSelect,
}: {
  label: 'Sun' | 'Moon'
  target: AlignmentTargetPreference
  selected: boolean
  available: boolean
  onSelect?: (target: AlignmentTargetPreference) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(target)}
      disabled={!available}
      aria-pressed={selected}
      aria-label={`Use ${label} for alignment`}
      className={`flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm ${
        selected
          ? 'border-amber-200/45 bg-amber-200/12 text-amber-50'
          : 'border-sky-100/10 bg-white/5 text-sky-50'
      } disabled:cursor-not-allowed disabled:border-sky-100/5 disabled:text-sky-100/40`}
    >
      <AlignmentTargetIcon target={target} />
      <span>{label}</span>
    </button>
  )
}

function AlignmentTargetIcon({ target }: { target: AlignmentTargetPreference }) {
  if (target === 'sun') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 1.75a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V2.5a.75.75 0 0 1 .75-.75Zm0 16.5a.75.75 0 0 1 .75.75v2.5a.75.75 0 0 1-1.5 0V19a.75.75 0 0 1 .75-.75Zm10.25-6.25a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5h2.25a.75.75 0 0 1 .75.75ZM5.5 12a.75.75 0 0 1-.75.75H2.5a.75.75 0 0 1 0-1.5h2.25A.75.75 0 0 1 5.5 12Zm13.225-6.975a.75.75 0 0 1 1.06 1.06L18.19 7.68a.75.75 0 1 1-1.06-1.06l1.595-1.595Zm-11.845 11.845a.75.75 0 0 1 1.06 1.06l-1.595 1.595a.75.75 0 1 1-1.06-1.06L6.88 16.87Zm11.845 2.655a.75.75 0 0 1-1.06 0L16.07 17.93a.75.75 0 1 1 1.06-1.06l1.595 1.595a.75.75 0 0 1 0 1.06ZM7.94 7.68a.75.75 0 1 1-1.06-1.06L8.475 5.025a.75.75 0 0 1 1.06 1.06L7.94 7.68Z" />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
      <path d="M14.75 2.4a.75.75 0 0 1 .52 1.28 8 8 0 1 0 5.05 5.05.75.75 0 0 1 1.28.52A9.5 9.5 0 1 1 14.75 2.4Z" />
    </svg>
  )
}
