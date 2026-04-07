'use client'

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'

import type { EnabledLayer } from '../../lib/config'
import type { DemoScenarioId } from '../../lib/demo/scenarios'
import {
  SCOPE_LENS_DIAMETER_PCT_RANGE,
  type LabelDisplayMode,
  type MotionQuality,
} from '../../lib/viewer/settings'
import { SCOPE_OPTICS_RANGES } from '../../lib/viewer/scope-optics'
import { CompactMobilePanelShell } from '../ui/compact-mobile-panel-shell'
import {
  focusAfterDismiss,
  resolveFocusRestoreTarget,
  trapFocusWithinPanel,
} from '../ui/dismissable-layer'

type SettingsSheetProps = {
  onEnterDemoMode: () => void
  onOpenChange?: (open: boolean) => void
  triggerSurfaceId?: string
  presentation?: 'mobile-sheet' | 'desktop-dialog'
  onDemoScenarioSelect?: (scenarioId: DemoScenarioId) => void
  onFixAlignment?: () => void
  onRecenter?: () => void
  canFixAlignment?: boolean
  canRecenter?: boolean
  verticalFovAdjustmentDeg?: number
  showScopeControls?: boolean
  scopeModeEnabled?: boolean
  scopeLensDiameterPct?: number
  transparencyPct?: number
  markerScale?: number
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
  onScopeModeEnabledChange?: (enabled: boolean) => void
  onScopeLensDiameterPctChange?: (value: number) => void
  onTransparencyChange?: (value: number) => void
  onMarkerScaleChange?: (value: number) => void
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
  onOpenChange,
  triggerSurfaceId,
  presentation = 'mobile-sheet',
  onDemoScenarioSelect,
  onFixAlignment,
  onRecenter,
  canFixAlignment = false,
  canRecenter = false,
  verticalFovAdjustmentDeg = 0,
  showScopeControls = false,
  scopeModeEnabled = false,
  scopeLensDiameterPct = SCOPE_LENS_DIAMETER_PCT_RANGE.defaultValue,
  transparencyPct = 85,
  markerScale = 1,
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
  onScopeModeEnabledChange,
  onScopeLensDiameterPctChange,
  onTransparencyChange,
  onMarkerScaleChange,
  onSelectedCameraDeviceChange,
  demoScenarioId,
  demoScenarioOptions = [],
}: SettingsSheetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const shouldRestoreFocusRef = useRef(true)
  const wasOpenRef = useRef(false)
  const hasReportedOpenStateRef = useRef(false)
  const titleId = useId()
  const panelId = useId()

  useEffect(() => {
    if (!isOpen) {
      if (!wasOpenRef.current) {
        return
      }

      const restoreTarget = shouldRestoreFocusRef.current
        ? resolveFocusRestoreTarget(triggerRef.current, previousFocusRef.current)
        : null

      focusAfterDismiss(restoreTarget)
      shouldRestoreFocusRef.current = true
      previousFocusRef.current = null
      wasOpenRef.current = false
      return
    }

    wasOpenRef.current = true
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    closeButtonRef.current?.focus()
  }, [isOpen])

  useEffect(() => {
    if (!hasReportedOpenStateRef.current) {
      hasReportedOpenStateRef.current = true
      return
    }

    onOpenChange?.(isOpen)
  }, [isOpen, onOpenChange])

  useEffect(
    () => () => {
      onOpenChange?.(false)
    },
    [onOpenChange],
  )

  const closeSheet = () => {
    shouldRestoreFocusRef.current = true
    setIsOpen(false)
  }

  const closeSheetWithoutFocusRestore = () => {
    shouldRestoreFocusRef.current = false
    setIsOpen(false)
  }

  const handlePanelKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeSheet()
      return
    }

    trapFocusWithinPanel(event, panelRef.current)
  }

  const header = (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-sky-200/60">Viewer controls</p>
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
  )

  const settingsContent = (
    <div className="grid gap-3 pb-1">
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
            onChange={(event) => onLayerToggle(layerId, event.target.checked)}
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
            if (canFixAlignment) {
              onFixAlignment?.()
              closeSheetWithoutFocusRestore()
            }
          }}
          className="min-h-11 rounded-2xl border border-sky-100/10 bg-white/5 px-4 py-3 text-sm text-sky-200/55 disabled:cursor-not-allowed"
          disabled={!canFixAlignment}
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
      <RangeControl
        label="Field of view"
        min={-30}
        max={30}
        step={1}
        value={verticalFovAdjustmentDeg}
        suffix="°"
        showPositiveSign
        onChange={onVerticalFovAdjustmentChange}
      />
      <RangeControl
        label="Marker scale"
        min={1}
        max={4}
        step={0.1}
        value={markerScale}
        suffix="x"
        onChange={onMarkerScaleChange}
      />
      {showScopeControls ? (
        <>
          <label className="flex items-center justify-between rounded-2xl border border-sky-100/10 bg-white/5 px-4 py-3 text-sm text-sky-50">
            <span>Scope mode</span>
            <input
              type="checkbox"
              checked={scopeModeEnabled}
              onChange={(event) => onScopeModeEnabledChange?.(event.target.checked)}
              aria-label="Scope mode"
            />
          </label>
          <RangeControl
            label="Telescope diameter"
            min={SCOPE_LENS_DIAMETER_PCT_RANGE.min}
            max={SCOPE_LENS_DIAMETER_PCT_RANGE.max}
            step={SCOPE_LENS_DIAMETER_PCT_RANGE.step}
            value={scopeLensDiameterPct}
            suffix="%"
            description="% of screen height"
            onChange={onScopeLensDiameterPctChange}
          />
          <RangeControl
            label="Transparency"
            min={SCOPE_OPTICS_RANGES.transparencyPct.min}
            max={SCOPE_OPTICS_RANGES.transparencyPct.max}
            step={SCOPE_OPTICS_RANGES.transparencyPct.step}
            value={transparencyPct}
            suffix="%"
            onChange={onTransparencyChange}
          />
        </>
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
  )

  const panelProps = {
    id: panelId,
    role: 'dialog' as const,
    'aria-modal': 'true' as const,
    'aria-labelledby': titleId,
    onClick: (event: ReactMouseEvent<HTMLElement>) => event.stopPropagation(),
    onKeyDown: handlePanelKeyDown,
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-controls={panelId}
        data-focus-surface={triggerSurfaceId}
        className="min-h-11 rounded-full border border-sky-100/15 bg-slate-950/45 px-4 py-2 text-sm text-sky-50"
      >
        Settings
      </button>
      {isOpen ? (
        presentation === 'desktop-dialog' ? (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center p-6"
            data-testid="settings-sheet-shell"
          >
            <button
              type="button"
              tabIndex={-1}
              aria-label="Close settings"
              data-testid="settings-sheet-backdrop"
              onClick={closeSheet}
              className="absolute inset-0 bg-slate-950/45"
            />
            <section
              ref={panelRef}
              className="shell-panel relative flex min-h-0 w-full max-w-4xl flex-col overflow-hidden rounded-[1.75rem] border border-sky-100/10 bg-slate-950/95 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.55)]"
              style={{ maxHeight: 'calc(100dvh - 3rem)' }}
              data-testid="settings-sheet-panel"
              {...panelProps}
            >
              {header}
              <div
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2"
                data-testid="settings-sheet-scroll-region"
              >
                {settingsContent}
              </div>
            </section>
          </div>
        ) : (
          <CompactMobilePanelShell
            ref={panelRef}
            shellTestId="settings-sheet-shell"
            shellClassName="z-40"
            shellChildren={
              <button
                type="button"
                tabIndex={-1}
                aria-label="Close settings"
                data-testid="settings-sheet-backdrop"
                onClick={closeSheet}
                className="absolute inset-0 bg-slate-950/45"
              />
            }
            panelTestId="settings-sheet-panel"
            panelProps={panelProps}
            header={header}
            scrollRegionTestId="settings-sheet-scroll-region"
            scrollRegionClassName="pr-1"
          >
            {settingsContent}
          </CompactMobilePanelShell>
        )
      ) : null}
    </>
  )
}

function RangeControl({
  label,
  min,
  max,
  step,
  value,
  suffix,
  description,
  showPositiveSign = false,
  onChange,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  suffix: string
  description?: string
  showPositiveSign?: boolean
  onChange?: (value: number) => void
}) {
  return (
    <label className="grid gap-2 text-sm text-sky-50">
      <span className="flex items-center justify-between gap-3">
        <span>
          <span className="block">{label}</span>
          {description ? (
            <span className="mt-1 block text-xs text-sky-100/70">{description}</span>
          ) : null}
        </span>
        <span className="text-xs uppercase tracking-[0.16em] text-sky-200/65">
          {showPositiveSign && value > 0 ? '+' : ''}
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
