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

type SettingsSheetProps = {
  onEnterDemoMode: () => void
  onDemoScenarioSelect?: (scenarioId: DemoScenarioId) => void
  onFixAlignment?: () => void
  onAlignCalibration?: () => void
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
                  <p className="mt-2 text-base font-semibold text-white">
                    {calibrationTargetLabel}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-sky-100/75">
                    {calibrationTargetDescription}
                  </p>
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
