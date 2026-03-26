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

type SettingsSheetProps = {
  onEnterDemoMode: () => void
  onDemoScenarioSelect?: (scenarioId: DemoScenarioId) => void
  onFixAlignment?: () => void
  onRecenter?: () => void
  canFixAlignment?: boolean
  canRecenter?: boolean
  headingOffsetDeg?: number
  pitchOffsetDeg?: number
  verticalFovAdjustmentDeg?: number
  layers: Record<EnabledLayer, boolean>
  layerAvailabilityLabels?: Partial<Record<EnabledLayer, string>>
  likelyVisibleOnly: boolean
  onLayerToggle: (layer: EnabledLayer, enabled: boolean) => void
  onLikelyVisibleOnlyChange: (enabled: boolean) => void
  onHeadingOffsetChange?: (value: number) => void
  onPitchOffsetChange?: (value: number) => void
  onVerticalFovAdjustmentChange?: (value: number) => void
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

export function SettingsSheet({
  onEnterDemoMode,
  onDemoScenarioSelect,
  onFixAlignment,
  onRecenter,
  canFixAlignment = false,
  canRecenter = false,
  headingOffsetDeg = 0,
  pitchOffsetDeg = 0,
  verticalFovAdjustmentDeg = 0,
  layers,
  layerAvailabilityLabels,
  likelyVisibleOnly,
  onLayerToggle,
  onLikelyVisibleOnlyChange,
  onHeadingOffsetChange,
  onPitchOffsetChange,
  onVerticalFovAdjustmentChange,
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
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCalibrationPanel(true)
                  onFixAlignment?.()
                }}
                className="min-h-11 rounded-2xl border border-sky-100/10 bg-white/5 px-4 py-3 text-sm text-sky-200/55 disabled:cursor-not-allowed"
                disabled={!canFixAlignment}
              >
                Fix alignment
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
            {showCalibrationPanel ? (
              <div className="grid gap-3 rounded-[1.5rem] border border-sky-100/10 bg-white/5 p-4">
                <RangeControl
                  label="Heading nudge"
                  min={-20}
                  max={20}
                  step={1}
                  value={headingOffsetDeg}
                  suffix="°"
                  onChange={onHeadingOffsetChange}
                />
                <RangeControl
                  label="Pitch nudge"
                  min={-10}
                  max={10}
                  step={1}
                  value={pitchOffsetDeg}
                  suffix="°"
                  onChange={onPitchOffsetChange}
                />
                <RangeControl
                  label="Field of view"
                  min={-10}
                  max={10}
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
