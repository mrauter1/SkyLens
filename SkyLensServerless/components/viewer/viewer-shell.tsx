'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEventHandler,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react'

import {
  fetchAircraftSnapshot,
  getAircraftAvailabilityMessage,
} from '../../lib/aircraft/client'
import type { AircraftAvailability } from '../../lib/aircraft/contracts'
import {
  createAircraftTracker,
  type AircraftTracker,
} from '../../lib/aircraft/tracker'
import {
  getDemoScenario,
  getDemoAircraftSnapshotAtTime,
  listDemoScenarios,
  type DemoScenarioId,
} from '../../lib/demo/scenarios'
import {
  type HealthApiResponse,
} from '../../lib/health/contracts'
import { fetchHealthStatus } from '../../lib/health/client'
import {
  type EnabledLayer,
  POLL_INTERVAL_MS_BY_QUALITY,
  PRIVACY_REASSURANCE_COPY,
  getPublicConfig,
} from '../../lib/config'
import { buildVisibleConstellations } from '../../lib/astronomy/constellations'
import {
  isCelestialDaylightLabelSuppressed,
  normalizeCelestialObjects,
} from '../../lib/astronomy/celestial'
import { loadStarCatalog, normalizeVisibleStars } from '../../lib/astronomy/stars'
import {
  fetchSatelliteCatalog,
} from '../../lib/satellites/client'
import type { TleApiResponse } from '../../lib/satellites/contracts'
import {
  type AircraftDetailMetadata,
  type MovingObjectMotionState,
  type SatelliteDetailMetadata,
  resolveAircraftMotionObjects,
  resolveSatelliteMotionObjects,
} from '../../lib/viewer/motion'
import {
  compareLabelCandidates,
  getLabelRankScore,
  layoutLabels,
  type LabelCandidate,
  type RankedLabelPlacement,
} from '../../lib/labels/ranking'
import {
  createAxisAngleQuaternion,
  createCameraFrameLayout,
  createCameraQuaternion,
  createProjectionProfile,
  createQuaternionFromBasis,
  crossVec3,
  dotVec3,
  getEffectiveVerticalFovDeg,
  getCameraBasisVectors,
  getStreamVideoDeviceId,
  horizontalToWorldVector,
  listAvailableVideoInputDevices,
  multiplyQuaternions,
  normalizeVec3,
  pickCenterLockedCandidate,
  projectWorldPointToScreen,
  projectWorldPointToScreenWithProfile,
  requestRearCameraStream,
  stopMediaStream,
  type CameraDeviceOption,
} from '../../lib/projection/camera'
import {
  buildViewerHref,
  createDemoViewerRoute,
  type PermissionStatusValue,
  type ViewerRouteState,
} from '../../lib/permissions/coordinator'
import {
  createScopeRequestTracker,
  loadScopeBandIndex,
  loadScopeManifest,
  loadScopeNamesTable,
  loadScopeTileRows,
} from '../../lib/scope/catalog'
import {
  applyScopeProperMotion,
  convertScopeEquatorialToHorizontal,
  convertScopeHorizontalToEquatorial,
  getObservationJulianYear,
} from '../../lib/scope/coordinates'
import {
  areScopeDeepStarsDaylightSuppressed,
  selectScopeBand,
} from '../../lib/scope/depth'
import {
  getScopeTileSelectionRadiusDeg,
  getScopeTileId,
  selectScopeTilesForPointing,
} from '../../lib/scope/position-tiles'
import type {
  ScopeBandIndex,
  ScopeDecodedTileRow,
  ScopeNameTable,
} from '../../lib/scope/contracts'
import {
  requestStartupObserverState,
  startObserverTracking,
} from '../../lib/sensors/location'
import {
  applyManualPoseDrag,
  createManualCameraPose,
  createPoseCalibration,
  createPoseCalibrationFromReferencePose,
  createManualPoseState,
  createIdentityPoseCalibration,
  getOrientationCapabilities,
  getScreenOrientationCorrectionDeg,
  recenterManualPose,
  requestOrientationPermission,
  subscribeToOrientationPose,
  type OrientationSample,
  type OrientationSource,
  type PoseCalibration,
} from '../../lib/sensors/orientation'
import type { CameraPose, ObserverState, SkyObject } from '../../lib/viewer/contracts'
import {
  ALIGNMENT_FINE_ADJUST_CONTROLS,
  buildAlignmentTutorialModel,
  type AlignmentTargetPreference,
  type AlignmentTutorialNotice,
  type AlignmentTutorialPrimaryStep,
} from '../../lib/viewer/alignment-tutorial'
import {
  SCOPE_LENS_DIAMETER_PCT_RANGE,
  markViewerOnboardingCompleted,
  normalizeScopeLensDiameterPct,
  readViewerSettings,
  writeViewerSettings,
  type ManualObserverSettings,
  type MotionQuality,
} from '../../lib/viewer/settings'
import {
  SCOPE_OPTICS_RANGES,
  computeScopeRenderProfile,
  magnificationToScopeVerticalFovDeg,
  normalizeScopeOptics,
  normalizeScopeOpticsValue,
  passesScopeLimitingMagnitude,
  type ScopeOptics,
  type ScopeRenderProfile,
} from '../../lib/viewer/scope-optics'
import { SettingsSheet } from '../settings/settings-sheet'
import { CompactMobilePanelShell } from '../ui/compact-mobile-panel-shell'
import {
  ScopeLensOverlay,
  type ScopeLensOverlayObject,
} from './scope-lens-overlay'
import type { ScopeStarCanvasPoint } from './scope-star-canvas'

type ViewerShellProps = {
  initialState: ViewerRouteState
}

type ProjectedSkyObject = SkyObject & {
  projection: ReturnType<typeof projectWorldPointToScreen>
}

type ScopeProjectedSkyObject = ProjectedSkyObject & {
  scopeProjection: ReturnType<typeof projectWorldPointToScreenWithProfile>
  scopeInLensCircle: boolean
}

type ScopeProjectedDeepStarObject = SkyObject & {
  bMinusV: number
  displayName?: string
  projection: ReturnType<typeof projectWorldPointToScreenWithProfile>
  scopeProjection: ReturnType<typeof projectWorldPointToScreenWithProfile>
  scopeInLensCircle: boolean
  source: 'scope-deep-star'
}

type ScopeLoadedDeepStar = ScopeDecodedTileRow & {
  id: string
  displayName?: string
}

type SummarySkyObject = ProjectedSkyObject | ScopeProjectedDeepStarObject

type OnObjectLabel = RankedLabelPlacement<ProjectedSkyObject>
type MotionAffordanceSample = {
  id: string
  x: number
  y: number
}
export type ViewerBannerActionId =
  | 'open-alignment'
  | 'recover-motion'
  | 'retry-camera'
  | 'retry-location'

export type ViewerBannerItem = {
  id: string
  title: string
  body: string
  critical?: boolean
  tone?: 'info'
  actionId?: ViewerBannerActionId
  actionLabel?: string
  actionDisabled?: boolean
  footer?: string | null
}

type ViewerSurface = 'mobile' | 'desktop'

type StartupState =
  | 'unsupported'
  | 'ready-to-request'
  | 'requesting'
  | 'awaiting-orientation'
  | 'camera-only'
  | 'sensor-relative-needs-calibration'
  | 'sensor-absolute'
  | 'manual'
  | 'error'

export type ViewerBannerResolverInput = {
  astronomyFailureBanner: string | null
  demoScenario: {
    label: string
    description: string
  } | null
  cameraStatus: PermissionStatusValue | null
  cameraRetryAvailable: boolean
  motionRecovery: {
    body: string
    actionLabel: string
    actionDisabled: boolean
    footer: string | null
  } | null
  locationError: string | null
  locationRetryAvailable: boolean
  cameraError: string | null
  startupState: StartupState
  calibrationTargetLabel: string
  calibrationBanner: string | null
  showAlignmentGuidance: boolean
  alignmentActionAvailable: boolean
  manualMode: boolean
}

type RuntimeExperience = {
  mode: 'blocked' | 'live' | 'non-camera' | 'manual-pan' | 'demo' | 'camera-only'
  title: string
  body: string
}

type BrowserFamily =
  | 'ios-safari'
  | 'chrome-android'
  | 'firefox-android'
  | 'samsung-internet'
  | 'other'

type ManualObserverDraft = {
  lat: string
  lon: string
  altMeters: string
}

type SceneSnapshot = {
  objects: SkyObject[]
  visibleStars: ReturnType<typeof normalizeVisibleStars>
  sunAltitudeDeg: number
  error: string | null
}

type CalibrationTarget = {
  id: string
  label: string
  description: string
  azimuthDeg: number
  elevationDeg: number
  sourceType: SkyObject['type'] | 'north-marker'
}

type CalibrationTargetResolution = {
  availability: {
    sun: boolean
    moon: boolean
  }
  autoTarget: CalibrationTarget
  target: CalibrationTarget
  preferredTarget: AlignmentTargetPreference
  preferredTargetUnavailable: boolean
}

type VisibleCalibrationTargetCandidates = {
  sunTarget: CalibrationTarget | null
  moonTarget: CalibrationTarget | null
  planetTarget: CalibrationTarget | null
  starTarget: CalibrationTarget | null
}

const DEFAULT_VIEWPORT = {
  width: 390,
  height: 844,
}
const SCOPE_LENS_DIAMETER_PX_RANGE = {
  min: 180,
  max: 440,
} as const
const SCOPE_LENS_VIEWPORT_MARGIN_PX = 32
const DEEP_STAR_ATTENUATION_APERTURE_MM_RANGE = {
  min: 40,
  max: 240,
} as const
const SCOPE_EXTENDED_OBJECT_BASELINE_ANGULAR_DIAMETER_DEG_BY_ID = {
  sun: 0.533,
  moon: 0.518,
  'planet-mercury': 0.08,
  'planet-venus': 0.16,
  'planet-mars': 0.11,
  'planet-jupiter': 0.22,
  'planet-saturn': 0.19,
  'planet-uranus': 0.07,
  'planet-neptune': 0.06,
} as const
const DEFAULT_SCOPE_PLANET_BASELINE_ANGULAR_DIAMETER_DEG = 0.1

const PUBLIC_CONFIG = getPublicConfig()
const STAR_CATALOG = loadStarCatalog()
const EMPTY_SCENE_SNAPSHOT: SceneSnapshot = {
  objects: [] as SkyObject[],
  visibleStars: [],
  sunAltitudeDeg: -90,
  error: null as string | null,
}
const EMPTY_CONSTELLATION_SCENE = {
  objects: [] as ReturnType<typeof buildVisibleConstellations>['objects'],
  lineSegments: [] as ReturnType<typeof buildVisibleConstellations>['lineSegments'],
}
const WORLD_UP: [number, number, number] = [0, 0, 1]
const SCENE_CLOCK_COARSE_INTERVAL_MS = 1_000
const AIRCRAFT_REQUEST_TIMEOUT_MS = 8_000
const ORIENTATION_READY_TIMEOUT_MS = 1_500
const SCENE_CLOCK_FRAME_INTERVAL_MS: Record<Exclude<MotionQuality, 'low'>, number> = {
  balanced: 1_000 / 15,
  high: 1_000 / 30,
}
const MOTION_AFFORDANCE_SAMPLE_LIMITS: Record<MotionQuality, number> = {
  low: 2,
  balanced: 8,
  high: 16,
}
const COMPACT_MOTION_WARNING_IDS = ['motion-recovery', 'awaiting-orientation'] as const
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function resolveViewerBannerFeed({
  astronomyFailureBanner,
  demoScenario,
  cameraStatus,
  cameraRetryAvailable,
  motionRecovery,
  locationError,
  locationRetryAvailable,
  cameraError,
  startupState,
  calibrationTargetLabel,
  calibrationBanner,
  showAlignmentGuidance,
  alignmentActionAvailable,
  manualMode,
}: ViewerBannerResolverInput): {
  primary: ViewerBannerItem | null
  overflow: ViewerBannerItem[]
  compactNotice: ViewerBannerItem | null
} {
  const candidates: Array<ViewerBannerItem & { priority: number }> = []

  if (astronomyFailureBanner) {
    candidates.push({
      id: 'astronomy',
      title: 'Astronomy fallback active.',
      body: astronomyFailureBanner,
      critical: true,
      priority: 10,
    })
  }

  if (motionRecovery) {
    candidates.push({
      id: 'motion-recovery',
      title: 'Motion recovery',
      body: motionRecovery.body,
      actionId: 'recover-motion',
      actionLabel: motionRecovery.actionLabel,
      actionDisabled: motionRecovery.actionDisabled,
      footer: motionRecovery.footer,
      priority: 20,
    })
  }

  if (startupState === 'awaiting-orientation') {
    candidates.push({
      id: 'awaiting-orientation',
      title: 'Waiting for motion data.',
      body: 'SkyLens requested motion access and is waiting for the first usable sample before it marks orientation ready.',
      priority: 30,
    })
  }

  if (startupState === 'sensor-relative-needs-calibration') {
    candidates.push({
      id: 'relative-calibration',
      title: 'Relative sensor mode needs alignment.',
      body: `Center ${calibrationTargetLabel} in the crosshair, then align before trusting label placement.`,
      actionId: alignmentActionAvailable ? 'open-alignment' : undefined,
      actionLabel: alignmentActionAvailable ? 'Open alignment' : undefined,
      priority: 40,
    })
  }

  if (showAlignmentGuidance && !manualMode) {
    candidates.push({
      id: 'alignment-guidance',
      title: 'Alignment looks off.',
      body: `Move phone in a figure eight or open Alignment to use ${calibrationTargetLabel}.`,
      actionId: alignmentActionAvailable ? 'open-alignment' : undefined,
      actionLabel: alignmentActionAvailable ? 'Open alignment' : undefined,
      priority: 50,
    })
  }

  if (locationError) {
    candidates.push({
      id: 'location',
      title: 'Live location is temporarily unavailable.',
      body: locationError,
      actionId: locationRetryAvailable ? 'retry-location' : undefined,
      actionLabel: locationRetryAvailable ? 'Retry location' : undefined,
      priority: 60,
    })
  }

  if (cameraError) {
    candidates.push({
      id: 'camera',
      title: 'Rear camera could not attach.',
      body: cameraError,
      actionId: cameraRetryAvailable ? 'retry-camera' : undefined,
      actionLabel: cameraRetryAvailable ? 'Retry camera' : undefined,
      priority: 70,
    })
  }

  if (cameraStatus !== null && cameraStatus !== 'granted' && cameraStatus !== 'unknown') {
    candidates.push({
      id: 'camera-disabled',
      title: 'Camera access is off.',
      body: 'SkyLens switched to the dark gradient background while keeping the same pose and projection pipeline available.',
      actionId: cameraRetryAvailable ? 'retry-camera' : undefined,
      actionLabel: cameraRetryAvailable ? 'Enable camera' : undefined,
      priority: 35,
    })
  }

  if (calibrationBanner) {
    candidates.push({
      id: 'calibration',
      title: 'Calibration',
      body: calibrationBanner,
      tone: 'info',
      priority: 90,
    })
  }

  if (demoScenario) {
    candidates.push({
      id: 'demo',
      title: 'Demo mode',
      body: `Demo mode is active. ${demoScenario.label}. ${demoScenario.description}`,
      tone: 'info',
      priority: 100,
    })
  }

  const ordered = [...candidates].sort((left, right) =>
    left.priority === right.priority
      ? left.id.localeCompare(right.id)
      : left.priority - right.priority,
  )

  if (ordered.length === 0) {
    return {
      primary: null,
      overflow: [],
      compactNotice: null,
    }
  }

  const primaryIndex = ordered.findIndex((item) => item.actionId)
  const featuredIndex = primaryIndex === -1 ? 0 : primaryIndex
  const primary = ordered[featuredIndex]
  const overflow = ordered.filter((_, index) => index !== featuredIndex)
  const compactNotice =
    COMPACT_MOTION_WARNING_IDS.includes(primary.id as (typeof COMPACT_MOTION_WARNING_IDS)[number])
      ? null
      : ordered.find((item) =>
          COMPACT_MOTION_WARNING_IDS.includes(
            item.id as (typeof COMPACT_MOTION_WARNING_IDS)[number],
          ),
        ) ?? null

  return {
    primary,
    overflow,
    compactNotice,
  }
}

export function ViewerShell({ initialState }: ViewerShellProps) {
  const router = useRouter()
  const initialDemoScenario = getDemoScenario(initialState.demoScenarioId)
  const persistedViewerSettings = readViewerSettings()
  const persistedManualObserver =
    initialState.entry === 'live' && initialState.location !== 'granted'
      ? createObserverStateFromManualSettings(persistedViewerSettings.manualObserver)
      : null
  const [isPending, startTransition] = useTransition()
  const [retryError, setRetryError] = useState<string | null>(null)
  const [state, setState] = useState(initialState)
  const [stageElement, setStageElement] = useState<HTMLDivElement | null>(null)
  const [viewport, setViewport] = useState(DEFAULT_VIEWPORT)
  const [liveObserver, setLiveObserver] = useState<ObserverState | null>(persistedManualObserver)
  const [liveLocationError, setLiveLocationError] = useState<string | null>(null)
  const [observerSource, setObserverSource] = useState<'geo' | 'manual' | null>(
    persistedManualObserver ? 'manual' : null,
  )
  const [manualPoseState, setManualPoseState] = useState(() =>
    createManualPoseState({
      pitchDeg: initialState.entry === 'demo' ? initialDemoScenario.initialPitchDeg : 0,
    }),
  )
  const [sensorCameraPose, setSensorCameraPose] = useState<CameraPose>(() =>
    createDefaultSensorCameraPose(),
  )
  const [sceneTimeMs, setSceneTimeMs] = useState(() =>
    initialState.entry === 'demo'
      ? initialDemoScenario.observer.timestampMs
      : getCurrentTimestampMs(),
  )
  const [viewerSettings, setViewerSettings] = useState(persistedViewerSettings)
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null)
  const [astronomyFailureBanner, setAstronomyFailureBanner] = useState<string | null>(null)
  const [aircraftRevision, setAircraftRevision] = useState(0)
  const [aircraftAvailability, setAircraftAvailability] = useState<AircraftAvailability>(
    'available',
  )
  const [latestAircraftSnapshotTimeS, setLatestAircraftSnapshotTimeS] = useState<number | null>(
    null,
  )
  const [satelliteCatalog, setSatelliteCatalog] = useState<TleApiResponse | null>(null)
  const [liveCameraStreamActive, setLiveCameraStreamActive] = useState(false)
  const [liveCameraError, setLiveCameraError] = useState<string | null>(null)
  const [cameraDevices, setCameraDevices] = useState<CameraDeviceOption[]>([])
  const [renderFrameToken, setRenderFrameToken] = useState(0)
  const [cameraSourceSize, setCameraSourceSize] = useState<{
    width: number
    height: number
  } | null>(null)
  const [orientationSource, setOrientationSource] = useState<OrientationSource | null>(null)
  const [orientationAbsolute, setOrientationAbsolute] = useState(
    initialState.orientation === 'granted',
  )
  const [, setOrientationNeedsCalibration] = useState(false)
  const [latestOrientationSample, setLatestOrientationSample] = useState<OrientationSample | null>(
    null,
  )
  const [startupState, setStartupState] = useState<StartupState>(() =>
    initialState.entry === 'demo'
      ? 'sensor-absolute'
      : initialState.location === 'unknown' ||
          initialState.camera === 'unknown' ||
          initialState.orientation === 'unknown'
        ? 'ready-to-request'
        : resolveStartupState({
            orientationStatus: initialState.orientation,
            cameraStatus: initialState.camera,
            hasObserver: persistedManualObserver !== null || initialState.location === 'granted',
          }),
  )
  const [showAlignmentGuidance, setShowAlignmentGuidance] = useState(false)
  const [calibrationBanner, setCalibrationBanner] = useState<string | null>(null)
  const [lastAppliedCalibrationTarget, setLastAppliedCalibrationTarget] =
    useState<CalibrationTarget | null>(null)
  const [healthStatus, setHealthStatus] = useState<HealthApiResponse | null>(null)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    getInitialReducedMotionPreference(),
  )
  const [motionAffordanceSamples, setMotionAffordanceSamples] = useState<
    MotionAffordanceSample[]
  >([])
  const [isMobileOverlayOpen, setIsMobileOverlayOpen] = useState(false)
  const [isDesktopViewerPanelOpen, setIsDesktopViewerPanelOpen] = useState(false)
  const [isDesktopSettingsSheetOpen, setIsDesktopSettingsSheetOpen] = useState(false)
  const [isMobileSettingsSheetOpen, setIsMobileSettingsSheetOpen] = useState(false)
  const [isAlignmentPanelOpen, setIsAlignmentPanelOpen] = useState(false)
  const [isMobileAlignmentFocusActive, setIsMobileAlignmentFocusActive] = useState(false)
  const [motionRetryError, setMotionRetryError] = useState<string | null>(null)
  const [manualObserverError, setManualObserverError] = useState<string | null>(null)
  const [orientationSampleRateHz, setOrientationSampleRateHz] = useState<number | null>(null)
  const [orientationUpgradedFromRelative, setOrientationUpgradedFromRelative] =
    useState(false)
  const [manualObserverDraft, setManualObserverDraft] = useState<ManualObserverDraft>(() =>
    createManualObserverDraft(persistedViewerSettings.manualObserver),
  )
  const [scopeNamesTable, setScopeNamesTable] = useState<ScopeNameTable>({})
  const [scopeBandIndexState, setScopeBandIndexState] = useState<{
    bandDir: ScopeBandIndex['bandDir']
    index: ScopeBandIndex
  } | null>(null)
  const [scopeLoadedDeepStars, setScopeLoadedDeepStars] = useState<ScopeLoadedDeepStar[]>([])
  void latestAircraftSnapshotTimeS
  const [documentVisible, setDocumentVisible] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState === 'visible',
  )
  const orientationControllerRef = useRef<ReturnType<typeof subscribeToOrientationPose> | null>(
    null,
  )
  const videoElementRef = useRef<HTMLVideoElement | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const cameraRequestIdRef = useRef(0)
  const lastOpenedCameraPreferenceRef = useRef<string | null>(null)
  const orientationStartupTimeoutRef = useRef<number | null>(null)
  const viewerRouteStateRef = useRef(state)
  const liveObserverRef = useRef<ObserverState | null>(persistedManualObserver)
  const latestAircraftSnapshotTimeSRef = useRef<number | null>(null)
  const previousOrientationSampleTimestampRef = useRef<number | null>(null)
  const previousOrientationSelectionRef = useRef<{
    source: OrientationSource | null
    absolute: boolean
  }>({
    source: null,
    absolute: false,
  })
  const sceneTimeMsRef = useRef(sceneTimeMs)
  const aircraftTrackerRef = useRef(createAircraftTracker())
  const poorSinceRef = useRef<number | null>(null)
  const dragRef = useRef<{
    pointerId: number
    clientX: number
    clientY: number
    moved: boolean
  } | null>(null)
  const mobileViewerOverlayTriggerRef = useRef<HTMLButtonElement | null>(null)
  const mobileViewerOverlayPanelRef = useRef<HTMLElement | null>(null)
  const mobileViewerOverlayCloseButtonRef = useRef<HTMLButtonElement | null>(null)
  const mobileAlignActionRef = useRef<HTMLButtonElement | null>(null)
  const mobileAlignmentOverlayPanelRef = useRef<HTMLElement | null>(null)
  const mobileAlignmentOverlayCloseButtonRef = useRef<HTMLButtonElement | null>(null)
  const mobileViewerOverlayRestoreTargetRef = useRef<HTMLElement | null>(null)
  const pendingMobileViewerFocusRestoreRef = useRef<(() => HTMLElement | null) | null>(null)
  const alignmentOverlayRestoreTargetRef = useRef<{
    opener: HTMLElement | null
    fallback: () => HTMLElement | null
  } | null>(null)
  const pendingAlignmentFocusRestoreRef = useRef<(() => HTMLElement | null) | null>(null)
  const lastTapAtRef = useRef(0)
  const scopeCatalogRequestTrackerRef = useRef(createScopeRequestTracker())
  const scopeTileRequestTrackerRef = useRef(createScopeRequestTracker())
  const hasMounted = useSyncExternalStore(subscribeToHydrationReady, getHydratedSnapshot, getServerHydrationSnapshot)
  const secureLiveArContext =
    typeof window === 'undefined' ||
    window.location.protocol === 'about:' ||
    window.isSecureContext
  const demoScenario = getDemoScenario(state.demoScenarioId)
  const demoScenarioOptions = listDemoScenarios().map((scenario) => ({
    id: scenario.id,
    label: scenario.label,
  }))
  const hasLiveSessionStarted =
    state.entry === 'live' &&
    startupState !== 'ready-to-request' &&
    startupState !== 'requesting' &&
    startupState !== 'unsupported' &&
    startupState !== 'error'
  const enabledLayers = viewerSettings.enabledLayers
  const likelyVisibleOnly = viewerSettings.likelyVisibleOnly
  const observer =
    state.entry === 'demo'
      ? demoScenario.observer
      : liveObserver
  const experience = describeRuntimeExperience({
    state,
    startupState,
    hasObserver: observer !== null,
  })
  const scopeControlsAvailable = experience.mode !== 'blocked'
  const browserFamily = hasMounted ? getBrowserFamily() : 'other'
  const locationError = state.entry === 'demo' ? null : liveLocationError
  const manualMode =
    experience.mode === 'demo' || experience.mode === 'manual-pan'
  const cameraPose = manualMode
    ? createManualCameraPose(manualPoseState)
    : sensorCameraPose
  const shouldFetchAircraft =
    state.entry !== 'demo' &&
    hasLiveSessionStarted &&
    observer !== null &&
    enabledLayers.aircraft &&
    documentVisible
  const activeAircraftAvailability =
    state.entry === 'demo'
      ? demoScenario.aircraftSnapshot.availability
      : enabledLayers.aircraft
        ? aircraftAvailability
        : 'available'
  const activeSatelliteCatalog =
    state.entry === 'demo' ? demoScenario.satelliteCatalog : satelliteCatalog
  const demoAircraftSeedTimeMs =
    Math.floor(sceneTimeMs / POLL_INTERVAL_MS_BY_QUALITY.high) * POLL_INTERVAL_MS_BY_QUALITY.high
  const sceneSnapshot = observer
    ? buildSceneSnapshot({
        observer,
        timeMs: sceneTimeMs,
        enabledLayers,
        likelyVisibleOnly,
        scopeModeEnabled: viewerSettings.scopeModeEnabled,
        scopeOptics: viewerSettings.scopeOptics,
        focusedObjectId: selectedObjectId,
        aircraftTracker: aircraftTrackerRef.current,
        aircraftRevision,
        satelliteCatalog: activeSatelliteCatalog,
      })
    : EMPTY_SCENE_SNAPSHOT
  const cameraStreamActive =
    state.entry === 'live' && state.camera === 'granted' && liveCameraStreamActive
  const cameraError = state.entry === 'demo' ? null : liveCameraError
  const shouldMountVideoElement = state.entry === 'live'
  const cameraFrameLayout = cameraSourceSize
    ? createCameraFrameLayout({
        width: viewport.width,
        height: viewport.height,
        sourceWidth: cameraSourceSize.width,
        sourceHeight: cameraSourceSize.height,
      })
    : null

  const showGradientBackground =
    state.entry === 'demo' ||
    state.camera !== 'granted' ||
    !cameraStreamActive
  const baseEffectiveVerticalFovDeg = getEffectiveVerticalFovDeg(
    viewerSettings.verticalFovAdjustmentDeg,
  )
  const scopeLensDiameterPx = getScopeLensDiameterPx(
    viewport,
    viewerSettings.scopeLensDiameterPct,
  )
  const scopeLensRadiusPx = scopeLensDiameterPx / 2
  const scopeEffectiveVerticalFovDeg = magnificationToScopeVerticalFovDeg(
    viewerSettings.scopeOptics.magnificationX,
  )
  const scopeProjectionProfile = createProjectionProfile({
    verticalFovDeg: scopeEffectiveVerticalFovDeg,
  })
  const scopeLensVisualScale = clampNumber(
    baseEffectiveVerticalFovDeg / scopeEffectiveVerticalFovDeg,
    1,
    12,
  )
  const scopeModeActive =
    scopeControlsAvailable && viewerSettings.scopeModeEnabled && !isMobileAlignmentFocusActive
  const hydratedScopeEnabled = hasMounted ? viewerSettings.scopeModeEnabled : false
  const hydratedScopeVerticalFovDeg = hasMounted ? scopeEffectiveVerticalFovDeg : 10
  const blockingCopy = getBlockingCopy(state, startupState)
  const locationStatusValue =
    state.entry === 'demo'
      ? 'Demo scenario'
      : observer
        ? getObserverStatusValue(observer, observerSource)
        : startupState === 'requesting'
          ? 'Pending'
          : startupState === 'camera-only'
            ? 'Manual needed'
            : badgeValue(state.location)
  const cameraStatusValue =
    state.camera === 'granted' && cameraStreamActive ? 'Ready' : badgeValue(state.camera)
  const motionStatusValue = getMotionBadgeValue(
    experience.mode,
    state,
    startupState,
    orientationSource,
    latestOrientationSample,
  )
  const orientationDiagnosticsNowMs =
    state.entry === 'live' ? sceneTimeMs : getCurrentTimestampMs()
  const orientationSampleAgeMs =
    latestOrientationSample === null
      ? null
      : Math.max(0, orientationDiagnosticsNowMs - latestOrientationSample.timestampMs)
  const scopeActiveBand = selectScopeBand({
    scopeVerticalFovDeg: scopeEffectiveVerticalFovDeg,
    cameraMode: cameraPose.mode,
    orientationStatus: state.orientation,
    latestOrientationSampleAgeMs: orientationSampleAgeMs,
    alignmentHealth: cameraPose.alignmentHealth,
  })
  const scopeDeepStarsDaylightSuppressed = areScopeDeepStarsDaylightSuppressed({
    likelyVisibleOnly,
    sunAltitudeDeg: sceneSnapshot.sunAltitudeDeg,
  })
  const scopeDeepStarsEnabled =
    scopeModeActive && observer !== null && !scopeDeepStarsDaylightSuppressed
  const activeScopeBandIndex =
    scopeBandIndexState?.bandDir === scopeActiveBand.bandDir ? scopeBandIndexState.index : null
  const scopeEquatorialCenter =
    scopeDeepStarsEnabled && observer
      ? convertScopeHorizontalToEquatorial(
          {
            azimuthDeg: cameraPose.yawDeg,
            elevationDeg: cameraPose.pitchDeg,
          },
          observer,
          sceneTimeMs,
        )
      : null
  const scopeSelectionRadiusDeg =
    scopeDeepStarsEnabled && scopeEquatorialCenter
      ? getScopeTileSelectionRadiusDeg({
          verticalFovDeg: scopeEffectiveVerticalFovDeg,
          viewportWidth: scopeLensDiameterPx,
          viewportHeight: scopeLensDiameterPx,
        })
      : null
  const scopeSelectedTiles =
    scopeDeepStarsEnabled &&
    scopeEquatorialCenter &&
    scopeSelectionRadiusDeg !== null &&
    activeScopeBandIndex
      ? selectScopeTilesForPointing({
          index: activeScopeBandIndex,
          centerRaDeg: scopeEquatorialCenter.raDeg,
          centerDecDeg: scopeEquatorialCenter.decDeg,
          selectionRadiusDeg: scopeSelectionRadiusDeg,
        }).sort((left, right) => left.file.localeCompare(right.file))
      : []
  const scopeSelectedTileKey = scopeSelectedTiles.map((tile) => tile.file).join('|')
  const constellationScene =
    observer && sceneSnapshot.error === null
      ? buildVisibleConstellations({
          cameraPose,
          viewport,
          verticalFovAdjustmentDeg: viewerSettings.verticalFovAdjustmentDeg,
          enabledLayers,
          likelyVisibleOnly,
          sunAltitudeDeg: sceneSnapshot.sunAltitudeDeg,
          visibleStars: sceneSnapshot.visibleStars,
          starCatalog: STAR_CATALOG,
        })
      : EMPTY_CONSTELLATION_SCENE
  const sceneObjects = sceneSnapshot.error
    ? EMPTY_SCENE_SNAPSHOT.objects
    : [...sceneSnapshot.objects, ...constellationScene.objects]
  const defaultAlignmentTargetPreference = resolveDefaultAlignmentTargetPreference(
    sceneObjects,
    sceneSnapshot.sunAltitudeDeg,
  )
  const alignmentTargetPreference =
    viewerSettings.alignmentTargetPreference ?? defaultAlignmentTargetPreference
  const projectedObjects: ProjectedSkyObject[] = sceneObjects.map((object) => ({
    ...object,
    projection: projectWorldPointToScreen(
      cameraPose,
      {
        azimuthDeg: object.azimuthDeg,
        elevationDeg: object.elevationDeg,
      },
      {
        ...viewport,
        sourceWidth: cameraFrameLayout?.sourceWidth,
        sourceHeight: cameraFrameLayout?.sourceHeight,
      },
      viewerSettings.verticalFovAdjustmentDeg,
    ),
  }))
  const wideCenterLockedCandidate = pickCenterLockedCandidate(
    projectedObjects
      .filter((object) => object.projection.visible)
      .map((object) => ({
        id: object.id,
        rankScore: getLabelRankScore(
          {
            object,
            projection: object.projection,
          },
          {
            centerLockedObjectId: null,
          },
        ),
        angularDistanceDeg: object.projection.angularDistanceDeg,
      })),
  )
  const wideCenterLockedObject =
    projectedObjects.find((object) => object.id === wideCenterLockedCandidate?.id) ?? null
  const scopeProjectedBrightObjects: ScopeProjectedSkyObject[] = projectedObjects
    .filter(
      (object) =>
        isScopeBrightObject(object) &&
        (!scopeDeepStarsDaylightSuppressed || object.type !== 'star'),
    )
    .map((object) => {
      const scopeProjection = projectWorldPointToScreenWithProfile(
        cameraPose,
        {
          azimuthDeg: object.azimuthDeg,
          elevationDeg: object.elevationDeg,
        },
        {
          width: scopeLensDiameterPx,
          height: scopeLensDiameterPx,
        },
        scopeProjectionProfile,
      )
      const scopeOffsetX = scopeProjection.x - scopeLensRadiusPx
      const scopeOffsetY = scopeProjection.y - scopeLensRadiusPx

      return {
        ...object,
        scopeProjection,
        scopeInLensCircle:
          scopeProjection.visible &&
          scopeOffsetX * scopeOffsetX + scopeOffsetY * scopeOffsetY <=
            scopeLensRadiusPx * scopeLensRadiusPx,
      }
    })
  const observationJulianYear = getObservationJulianYear(sceneTimeMs)
  const scopeProjectedDeepStars: ScopeProjectedDeepStarObject[] =
    hasMounted && scopeDeepStarsEnabled && observer
      ? scopeLoadedDeepStars.flatMap((star) => {
          const adjustedPosition = applyScopeProperMotion(star, observationJulianYear)
          const horizontalPosition = convertScopeEquatorialToHorizontal(
            adjustedPosition,
            observer,
            sceneTimeMs,
          )
          if (horizontalPosition.elevationDeg < 0) {
            return []
          }

          if (
            !passesScopeLimitingMagnitude({
              magnitude: star.vMag,
              altitudeDeg: horizontalPosition.elevationDeg,
              optics: viewerSettings.scopeOptics,
            })
          ) {
            return []
          }
          const scopeRender = computeScopeRenderProfile({
            magnitude: star.vMag,
            altitudeDeg: horizontalPosition.elevationDeg,
            optics: viewerSettings.scopeOptics,
          })
          const scopeProjection = projectWorldPointToScreenWithProfile(
            cameraPose,
            horizontalPosition,
            {
              width: scopeLensDiameterPx,
              height: scopeLensDiameterPx,
            },
            scopeProjectionProfile,
          )
          const scopeOffsetX = scopeProjection.x - scopeLensRadiusPx
          const scopeOffsetY = scopeProjection.y - scopeLensRadiusPx
          const scopeInLensCircle =
            scopeProjection.visible &&
            scopeOffsetX * scopeOffsetX + scopeOffsetY * scopeOffsetY <=
              scopeLensRadiusPx * scopeLensRadiusPx

          return [{
            id: star.id,
            type: 'star' as const,
            label: star.displayName ?? 'Deep star',
            displayName: star.displayName,
            bMinusV: star.bMinusV,
            azimuthDeg: horizontalPosition.azimuthDeg,
            elevationDeg: horizontalPosition.elevationDeg,
            magnitude: star.vMag,
            importance: getScopeDeepStarImportance(star.vMag, Boolean(star.displayName)),
            metadata: {
              detail: {
                typeLabel: 'Star',
                magnitude: star.vMag,
                elevationDeg: horizontalPosition.elevationDeg,
                bMinusV: star.bMinusV,
              },
              scopeRender: {
                typeLabel: 'Scope render',
                ...scopeRender,
              },
              scopeFilter: {
                effectiveLimitMag: scopeRender.effectiveLimitMag,
              },
            },
            projection: scopeProjection,
            scopeProjection,
            scopeInLensCircle,
            source: 'scope-deep-star' as const,
          }]
        })
      : []
  const scopeCenterLockedCandidate = scopeModeActive
    ? pickCenterLockedCandidate(
        scopeProjectedBrightObjects
          .filter((object) => object.scopeInLensCircle)
          .map((object) => ({
            id: object.id,
            rankScore: getLabelRankScore(
              {
                object,
                projection: object.scopeProjection,
              },
              {
                centerLockedObjectId: null,
              },
            ),
            angularDistanceDeg: object.scopeProjection.angularDistanceDeg,
          })),
      )
    : null
  const scopeCenterLockedBrightObject =
    scopeModeActive
      ? scopeProjectedBrightObjects.find((object) => object.id === scopeCenterLockedCandidate?.id) ??
        null
      : null
  const scopeNamedDeepCenterLockedCandidate = scopeModeActive
    ? pickCenterLockedCandidate(
        scopeProjectedDeepStars
          .filter((object) => object.scopeInLensCircle && Boolean(object.displayName))
          .map((object) => ({
            id: object.id,
            rankScore: getLabelRankScore(
              {
                object,
                projection: object.scopeProjection,
              },
              {
                centerLockedObjectId: null,
              },
            ),
            angularDistanceDeg: object.scopeProjection.angularDistanceDeg,
          })),
      )
    : null
  const scopeCenterLockedDeepStar =
    scopeModeActive
      ? scopeProjectedDeepStars.find((object) => object.id === scopeNamedDeepCenterLockedCandidate?.id) ??
        null
      : null
  const wideSceneCenterLockedObject = wideCenterLockedObject
  const centerLockedObject: SummarySkyObject | null = scopeModeActive
    ? scopeCenterLockedBrightObject ?? scopeCenterLockedDeepStar
    : wideSceneCenterLockedObject
  const markerObjects = projectedObjects.filter(
    (object) =>
      object.projection.visible &&
      (!isCelestialDaylightLabelSuppressed(object) ||
        object.id === wideSceneCenterLockedObject?.id ||
        object.id === selectedObjectId),
  )
  const markerLabelCandidates = markerObjects.map((object) => ({
    object,
    projection: object.projection,
    secondaryLabel: formatSkyObjectSublabel(object),
  })) satisfies LabelCandidate<ProjectedSkyObject>[]
  const onObjectLabels: OnObjectLabel[] =
    viewerSettings.labelDisplayMode === 'on_objects'
      ? layoutLabels(markerLabelCandidates, {
          viewport,
          maxLabels: PUBLIC_CONFIG.defaults.maxLabels,
          centerLockedObjectId: wideSceneCenterLockedObject?.id ?? null,
        })
      : []
  const topListObjects =
    viewerSettings.labelDisplayMode === 'top_list'
      ? [...markerLabelCandidates]
          .sort((left, right) =>
            compareLabelCandidates(left, right, {
              centerLockedObjectId: wideSceneCenterLockedObject?.id ?? null,
            }),
          )
          .map((candidate) => candidate.object)
      : []
  const selectedObject =
    projectedObjects.find((object) => object.id === selectedObjectId) ?? null
  const hoveredObject =
    projectedObjects.find(
      (object) => object.id === hoveredObjectId && object.projection.visible,
    ) ?? null
  const selectedDetailObject = selectedObject ?? hoveredObject
  const detailObjectHeading = selectedObject ? 'Selected object' : hoveredObject ? 'Hovered object' : null
  const activeSummaryObject: SummarySkyObject | null =
    hoveredObject ?? selectedObject ?? centerLockedObject
  const shouldRenderMotionAffordance =
    !prefersReducedMotion && isMotionAffordanceEligible(activeSummaryObject)
  const activeMotionAffordanceObjectId = activeSummaryObject?.id ?? null
  const activeMotionAffordanceX = activeSummaryObject?.projection.x ?? null
  const activeMotionAffordanceY = activeSummaryObject?.projection.y ?? null
  const activeMotionAffordanceVisible = activeSummaryObject?.projection.visible ?? false
  const activeMotionAffordanceInViewport = activeSummaryObject?.projection.inViewport ?? false
  const activeMotionAffordanceKind =
    shouldRenderMotionAffordance && activeSummaryObject
      ? getMotionAffordanceKind(viewerSettings.motionQuality)
      : null
  const activeMotionAffordance =
    shouldRenderMotionAffordance && activeSummaryObject
      ? motionAffordanceSamples.filter((sample) => sample.id === activeSummaryObject.id)
      : []
  const scopeStarCanvasPoints: ScopeStarCanvasPoint[] =
    hasMounted && scopeModeActive
      ? scopeProjectedDeepStars
          .filter((object) => object.scopeInLensCircle)
          .map((object) => {
            const scopeRender = getScopeRenderProfile(object)

            return {
              id: object.id,
              x: object.scopeProjection.x,
              y: object.scopeProjection.y,
              bMinusV: object.bMinusV,
              intensity: getScopeDeepStarDisplayIntensity(
                scopeRender?.intensity,
                viewerSettings.scopeOptics.apertureMm,
              ),
              corePx: scopeRender?.corePx ?? 1.2,
              haloPx: scopeRender?.haloPx ?? 2.4,
            }
          })
      : []
  const scopeLensObjects: ScopeLensOverlayObject[] =
    hasMounted && scopeModeActive
      ? scopeProjectedBrightObjects
          .filter((object) => object.scopeInLensCircle)
          .map((object) => ({
            id: object.id,
            x: object.scopeProjection.x,
            y: object.scopeProjection.y,
            sizePx: getScopeMarkerSizePx(object, {
              lensDiameterPx: scopeLensDiameterPx,
              scopeVerticalFovDeg: scopeEffectiveVerticalFovDeg,
              markerScale: viewerSettings.markerScale,
            }),
            opacity: getScopeMarkerOpacity(object, viewerSettings.scopeOptics),
            className: getMarkerVisualClassName(object, {
              centerLockedObjectId: scopeCenterLockedBrightObject?.id ?? null,
              selectedObjectId,
            }),
          }))
      : []
  const renderedLineSegments = hasMounted ? constellationScene.lineSegments : []
  const renderedMarkerObjects = hasMounted ? markerObjects : []
  const renderedOnObjectLabels = hasMounted ? onObjectLabels : []
  const renderedTopListObjects = hasMounted ? topListObjects : []
  const renderedCenterLockedObject = hasMounted ? centerLockedObject : null
  const renderedSelectedDetailObject = hasMounted ? selectedDetailObject : null
  const renderedActiveSummaryObject = hasMounted ? activeSummaryObject : null
  const focusedAircraftTrailIds = [...new Set(
    [selectedObject, wideSceneCenterLockedObject]
      .filter((object): object is ProjectedSkyObject => object !== null && object.type === 'aircraft')
      .map((object) => object.id),
  )]
  const focusedAircraftTrails =
    hasMounted && observer && enabledLayers.aircraft
      ? focusedAircraftTrailIds
          .map((id) => ({
            id,
            points: aircraftTrackerRef.current
              .getTrail({
                id,
                observer,
                nowMs: sceneTimeMs,
              })
              .map((point) =>
                projectWorldPointToScreen(
                  cameraPose,
                  {
                    azimuthDeg: point.azimuthDeg,
                    elevationDeg: point.elevationDeg,
                  },
                  {
                    ...viewport,
                    sourceWidth: cameraFrameLayout?.sourceWidth,
                    sourceHeight: cameraFrameLayout?.sourceHeight,
                  },
                  viewerSettings.verticalFovAdjustmentDeg,
                ),
              )
              .filter((projection) => projection.visible)
              .map((projection) => `${projection.x},${projection.y}`),
          }))
          .filter((trail) => trail.points.length >= 2)
      : []
  const visibilityDiagnosticsNote =
    renderedMarkerObjects.length === 0
      ? likelyVisibleOnly
        ? 'No objects are currently visible. Likely visible only may hide stars, constellations, and satellites in daylight.'
        : 'No objects are currently visible. Check location accuracy, tilt the phone above the horizon, and confirm layer toggles in Settings.'
      : `${renderedMarkerObjects.length} objects are currently visible on screen.`
  const calibrationTargetResolution = resolveCalibrationTarget(
    sceneObjects,
    alignmentTargetPreference,
  )
  const calibrationTarget = calibrationTargetResolution.target
  const shouldShowAlignmentInstructions =
    !manualMode && isAlignmentPanelOpen && !isMobileAlignmentFocusActive
  const calibrationStatus = describeCalibrationStatus({
    startupState,
    cameraPose,
    poseCalibration: viewerSettings.poseCalibration,
    calibrationTarget,
    appliedCalibrationTarget: lastAppliedCalibrationTarget,
  })
  const canFixAlignment = experience.mode !== 'blocked'
  const canAlignCalibration = cameraPose.mode === 'sensor' && latestOrientationSample !== null
  const canResetCalibration =
    cameraPose.mode === 'sensor' &&
    (viewerSettings.poseCalibration.calibrated ||
      !quaternionsApproximatelyEqual(
        viewerSettings.poseCalibration.offsetQuaternion,
        createIdentityPoseCalibration().offsetQuaternion,
      ))
  const alignmentTutorial = buildAlignmentTutorialModel({
    resolvedTargetLabel: calibrationTarget.label,
    selectedTarget: alignmentTargetPreference,
    calibrationStatus,
    canFixAlignment,
    canAlignCalibration,
    manualMode,
    preferredTargetUnavailable: calibrationTargetResolution.preferredTargetUnavailable,
  })
  const alignmentFocusPrompt = `Press the middle of the screen to align to ${calibrationTarget.label}.`
  const sensorStatusValue = getSensorStatusValue({
    startupState,
    orientationSource,
    orientationAbsolute,
    cameraPose,
    latestOrientationSample,
    poseCalibration: viewerSettings.poseCalibration,
    orientationUpgradedFromRelative,
  })
  const showMobilePermissionAction =
    state.entry === 'live' &&
    startupState !== 'awaiting-orientation' &&
    startupState !== 'requesting' &&
    (state.camera !== 'granted' || state.orientation !== 'granted')
  const showMobileAlignAction = state.entry === 'live' && !isMobileAlignmentFocusActive
  const showMobileScopeAction = scopeControlsAvailable && !isMobileAlignmentFocusActive
  const permissionRecoveryAction = getPermissionRecoveryAction(state)
  const activeLiveCameraStage = state.entry === 'live' && cameraStreamActive
  const isSettingsSheetOpen = isDesktopSettingsSheetOpen || isMobileSettingsSheetOpen
  const shouldLockViewerScroll =
    activeLiveCameraStage || isMobileAlignmentFocusActive || isSettingsSheetOpen
  const usesCameraStageAlignmentFocus =
    state.entry === 'live' && cameraStreamActive && !manualMode
  const shouldUseCompactNonScrollingOverlay = activeLiveCameraStage && !manualMode
  const getMobileAlignmentFallbackFocusTarget = useCallback(() => {
    if (typeof document === 'undefined') {
      return resolveFocusRestoreTarget(mobileAlignActionRef.current, mobileViewerOverlayTriggerRef.current)
    }

    return resolveFocusRestoreTarget(
      mobileAlignActionRef.current,
      document.querySelector<HTMLElement>('[data-testid="mobile-align-action"]'),
      document.querySelector<HTMLElement>('[data-focus-surface="mobile-settings-trigger"]'),
      mobileViewerOverlayTriggerRef.current,
      document.querySelector<HTMLElement>('[data-testid="mobile-viewer-overlay-trigger"]'),
    )
  }, [])
  const getDesktopAlignmentFallbackFocusTarget = useCallback(() => {
    if (typeof document === 'undefined') {
      return null
    }

    return resolveFocusRestoreTarget(
      document.querySelector<HTMLElement>('[data-testid="desktop-align-action"]'),
      document.querySelector<HTMLElement>('[data-focus-surface="desktop-settings-trigger"]'),
      document.querySelector<HTMLElement>('[data-testid="desktop-open-viewer-action"]'),
    )
  }, [])

  const handleAlignmentTargetPreferenceChange = useCallback(
    (target: AlignmentTargetPreference) => {
      setViewerSettings((current) => ({
        ...current,
        alignmentTargetPreference: target,
      }))
    },
    [],
  )

  const openMobileViewerOverlay = () => {
    mobileViewerOverlayRestoreTargetRef.current = getActiveFocusableElement()
    setIsMobileOverlayOpen(true)
  }

  const closeMobileViewerOverlay = () => {
    pendingMobileViewerFocusRestoreRef.current = () =>
      resolveFocusRestoreTarget(
        mobileViewerOverlayRestoreTargetRef.current,
        mobileViewerOverlayTriggerRef.current,
        typeof document === 'undefined'
          ? null
          : document.querySelector<HTMLElement>('[data-testid="mobile-viewer-overlay-trigger"]'),
      )
    setIsMobileOverlayOpen(false)
  }

  const openAlignmentExperience = (
    request?: {
      opener?: HTMLElement | null
      surface?: ViewerSurface
    },
  ) => {
    const opener = request?.opener ?? (request?.surface ? null : getActiveFocusableElement())
    const openerTestId = opener?.getAttribute('data-testid')
    const openerSurface = opener?.getAttribute('data-focus-surface')
    const alignmentSurface =
      request?.surface ??
      (isMobileOverlayOpen ||
      isMobileSettingsSheetOpen ||
      openerSurface === 'mobile-settings-trigger' ||
      openerTestId === 'mobile-align-action' ||
      openerTestId === 'mobile-viewer-overlay-trigger'
        ? 'mobile'
        : 'desktop')

    alignmentOverlayRestoreTargetRef.current = {
      opener,
      fallback:
        alignmentSurface === 'mobile'
          ? getMobileAlignmentFallbackFocusTarget
          : getDesktopAlignmentFallbackFocusTarget,
    }
    setShowAlignmentGuidance(false)
    setIsDesktopViewerPanelOpen(false)
    setIsMobileOverlayOpen(false)
    setIsDesktopSettingsSheetOpen(false)
    setIsMobileSettingsSheetOpen(false)
    setIsAlignmentPanelOpen(true)
    setIsMobileAlignmentFocusActive(false)
  }

  const startAlignmentFocus = () => {
    if (!usesCameraStageAlignmentFocus || !canAlignCalibration) {
      return
    }

    alignmentOverlayRestoreTargetRef.current = null
    setShowAlignmentGuidance(false)
    setIsMobileOverlayOpen(false)
    setIsDesktopSettingsSheetOpen(false)
    setIsMobileSettingsSheetOpen(false)
    setIsAlignmentPanelOpen(false)
    setIsMobileAlignmentFocusActive(true)
  }

  const closeAlignmentExperience = () => {
    pendingAlignmentFocusRestoreRef.current = () =>
      resolveFocusRestoreTarget(
        alignmentOverlayRestoreTargetRef.current?.opener ?? null,
        alignmentOverlayRestoreTargetRef.current?.fallback() ?? null,
      )
    setIsAlignmentPanelOpen(false)
    setIsMobileAlignmentFocusActive(false)
  }

  const handleMobileViewerOverlayKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeMobileViewerOverlay()
      return
    }

    trapFocusWithinPanel(event, mobileViewerOverlayPanelRef.current)
  }

  const handleMobileAlignmentOverlayKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeAlignmentExperience()
      return
    }

    trapFocusWithinPanel(event, mobileAlignmentOverlayPanelRef.current)
  }

  const clearOrientationStartupTimeout = useCallback(() => {
    if (orientationStartupTimeoutRef.current !== null) {
      window.clearTimeout(orientationStartupTimeoutRef.current)
      orientationStartupTimeoutRef.current = null
    }
  }, [])

  const commitViewerRouteState = useCallback((nextState: ViewerRouteState) => {
    viewerRouteStateRef.current = nextState
    setState(nextState)
    router.replace(buildViewerHref(nextState))
  }, [router])

  const syncCameraDevices = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      return
    }

    const nextDevices = await listAvailableVideoInputDevices(navigator.mediaDevices)

    setCameraDevices(nextDevices)
  }

  const openLiveCamera = async (preferredDeviceId?: string | null) => {
    const videoElement = videoElementRef.current

    if (!videoElement) {
      throw new Error('camera-element-unavailable')
    }

    const mediaRuntime =
      typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined

    const requestId = cameraRequestIdRef.current + 1
    cameraRequestIdRef.current = requestId
    setLiveCameraStreamActive(false)
    setLiveCameraError(null)
    setCameraSourceSize(null)

    stopMediaStream(cameraStreamRef.current)
    cameraStreamRef.current = null
    videoElement.srcObject = null

    try {
      const stream = await requestRearCameraStream(mediaRuntime, {
        preferredDeviceId,
      })

      if (cameraRequestIdRef.current !== requestId) {
        stopMediaStream(stream)
        return null
      }

      cameraStreamRef.current = stream
      lastOpenedCameraPreferenceRef.current =
        getStreamVideoDeviceId(stream) ?? preferredDeviceId ?? null
      videoElement.srcObject = stream
      await videoElement.play().catch(() => undefined)
      setLiveCameraStreamActive(true)
      await syncCameraDevices()

      const activeDeviceId = getStreamVideoDeviceId(stream) ?? preferredDeviceId ?? null

      if (activeDeviceId) {
        setViewerSettings((current) => ({
          ...current,
          selectedCameraDeviceId: activeDeviceId,
        }))
      }

      return stream
    } catch (error) {
      if (cameraRequestIdRef.current === requestId) {
        setLiveCameraError(
          'SkyLens retried the stored camera if available, then exact environment, then environment fallback, without requesting microphone access.',
        )
        setLiveCameraStreamActive(false)
        lastOpenedCameraPreferenceRef.current = null
      }

      throw error
    }
  }

  const applyManualObserver = (manualObserver: ManualObserverSettings) => {
    const nextObserver = createObserverStateFromManualSettings(manualObserver)

    setLiveObserver(nextObserver)
    setObserverSource('manual')
    setLiveLocationError(
      'SkyLens is using your saved manual observer until a live location fix is available.',
    )
    setViewerSettings((current) => ({
      ...current,
      manualObserver,
    }))
    setStartupState(resolveStartupState({
      orientationStatus: state.orientation,
      cameraStatus: state.camera,
      hasObserver: true,
      orientationNeedsCalibration: startupState === 'sensor-relative-needs-calibration',
    }))
  }

  const requestInitialObserver = async () => {
    try {
      const nextObserver = await requestStartupObserverState()

      setLiveObserver(nextObserver)
      setObserverSource('geo')
      setLiveLocationError(null)
      return {
        locationStatus: 'granted' as const,
        hasObserver: true,
      }
    } catch {
      const savedManualObserver = viewerSettings.manualObserver

      if (savedManualObserver) {
        applyManualObserver(savedManualObserver)

        return {
          locationStatus: 'denied' as const,
          hasObserver: true,
        }
      }

      setLiveObserver(null)
      setObserverSource(null)
      setLiveLocationError(
        'Location did not resolve in time. Enter latitude, longitude, and altitude manually or retry geolocation.',
      )

      return {
        locationStatus: 'denied' as const,
        hasObserver: false,
      }
    }
  }

  const applyOrientationRetryResult = ({
    orientation,
    nextState,
    hasObserver,
    orientationNeedsCalibration = startupState === 'sensor-relative-needs-calibration',
  }: {
    orientation: PermissionStatusValue
    nextState: ViewerRouteState
    hasObserver: boolean
    orientationNeedsCalibration?: boolean
  }) => {
    commitViewerRouteState(nextState)
    setStartupState(
      resolveStartupState({
        orientationStatus: orientation,
        cameraStatus: nextState.camera,
        hasObserver,
        orientationNeedsCalibration,
        orientationAbsolute,
      }),
    )

    if (orientation === 'denied' || orientation === 'unavailable') {
      setMotionRetryError(
        orientation === 'denied'
          ? getMotionDeniedMessage(browserFamily)
          : getMotionUnavailableMessage(browserFamily),
      )
    }
  }

  const requestOrientationRetry = async () => {
    try {
      return await requestOrientationPermission()
    } catch {
      setMotionRetryError('Unable to retry motion permission right now.')
      return null
    }
  }

  const normalizeOrientationPromptStatus = (
    orientation: PermissionStatusValue,
  ): PermissionStatusValue => (
    orientation === 'granted' || orientation === 'unavailable'
      ? 'unknown'
      : orientation
  )

  const resetOrientationSessionState = (baselineAbsolute: boolean) => {
    previousOrientationSampleTimestampRef.current = null
    previousOrientationSelectionRef.current = {
      source: null,
      absolute: false,
    }
    setOrientationSampleRateHz(null)
    setOrientationUpgradedFromRelative(false)
    setOrientationNeedsCalibration(false)
    setLatestOrientationSample(null)
    setOrientationSource(null)
    setOrientationAbsolute(baselineAbsolute)
  }

  const handleRetryPermissions = () => {
    setRetryError(null)
    setAstronomyFailureBanner(null)
    setManualObserverError(null)
    setMotionRetryError(null)
    setCalibrationBanner(null)

    startTransition(async () => {
      if (state.entry !== 'live') {
        return
      }

      if (!secureLiveArContext) {
        setStartupState('unsupported')
        return
      }

      setStartupState('requesting')
      clearOrientationStartupTimeout()
      resetOrientationSessionState(false)
      markViewerOnboardingCompleted()
      setViewerSettings((current) => ({
        ...current,
        onboardingCompleted: true,
      }))
      setLiveObserver(null)
      setObserverSource(null)
      setLiveLocationError(null)

      try {
        const orientation = await requestOrientationRetry()
        let camera: PermissionStatusValue = 'unknown'

        try {
          await openLiveCamera(viewerSettings.selectedCameraDeviceId)
          camera = 'granted'
        } catch {
          camera = 'denied'
        }

        const observerResult = await requestInitialObserver()
        const normalizedOrientation =
          orientation === null ? null : normalizeOrientationPromptStatus(orientation)
        const resolvedOrientation = normalizedOrientation ?? state.orientation
        const nextState: ViewerRouteState = {
          ...state,
          orientation: resolvedOrientation,
          camera,
          location: observerResult.locationStatus,
        }

        setSelectedObjectId(null)
        setMotionAffordanceSamples([])
        setSceneTimeMs(getCurrentTimestampMs())
        if (orientation === null) {
          commitViewerRouteState(nextState)
          setStartupState(
            resolveStartupState({
              orientationStatus: nextState.orientation,
              cameraStatus: camera,
              hasObserver: observerResult.hasObserver,
              orientationNeedsCalibration: false,
              orientationAbsolute,
            }),
          )
          return
        }

        applyOrientationRetryResult({
          orientation: resolvedOrientation,
          nextState,
          hasObserver: observerResult.hasObserver,
          orientationNeedsCalibration: false,
        })
      } catch {
        setStartupState('error')
        setRetryError('SkyLens could not complete startup. Try again or switch to demo mode.')
      }
    })
  }

  const handleManualObserverSubmit = () => {
    setManualObserverError(null)

    const parsed = parseManualObserverDraft(manualObserverDraft)

    if (!parsed) {
      setManualObserverError('Enter valid latitude, longitude, and altitude values.')
      return
    }

    applyManualObserver(parsed)
    commitViewerRouteState({
      ...state,
      location: 'denied',
    })
  }

  const handleRetryLocation = () => {
    setManualObserverError(null)
    setLiveLocationError(null)

    startTransition(async () => {
      if (state.entry !== 'live') {
        return
      }

      const observerResult = await requestInitialObserver()
      const nextState: ViewerRouteState = {
        ...state,
        location: observerResult.locationStatus,
      }

      commitViewerRouteState(nextState)
      setStartupState(
        resolveStartupState({
          orientationStatus: state.orientation,
          cameraStatus: state.camera,
          hasObserver: observerResult.hasObserver,
          orientationNeedsCalibration:
            startupState === 'sensor-relative-needs-calibration',
        }),
      )
    })
  }

  const handleRetryMotionPermission = () => {
    setMotionRetryError(null)

    startTransition(async () => {
      const orientation = await requestOrientationRetry()

      if (orientation === null || state.entry !== 'live') {
        return
      }

      const normalizedOrientation = normalizeOrientationPromptStatus(orientation)

      applyOrientationRetryResult({
        orientation: normalizedOrientation,
        nextState: {
          ...state,
          orientation: normalizedOrientation,
        },
        hasObserver: observer !== null,
      })
    })
  }

  const handleRetryCameraPermission = () => {
    setRetryError(null)
    setAstronomyFailureBanner(null)
    setCalibrationBanner(null)

    startTransition(async () => {
      if (state.entry !== 'live') {
        return
      }

      let camera: PermissionStatusValue = 'unknown'

      try {
        await openLiveCamera(viewerSettings.selectedCameraDeviceId)
        camera = 'granted'
      } catch {
        camera = 'denied'
      }

      commitViewerRouteState({
        ...state,
        camera,
      })
      setStartupState(
        resolveStartupState({
          orientationStatus: state.orientation,
          cameraStatus: camera,
          hasObserver: observer !== null,
          orientationNeedsCalibration:
            startupState === 'sensor-relative-needs-calibration',
          orientationAbsolute,
        }),
      )
    })
  }

  const handlePermissionRecoveryAction = () => {
    switch (permissionRecoveryAction.kind) {
      case 'motion-only':
        handleRetryMotionPermission()
        break
      case 'camera-only':
        handleRetryCameraPermission()
        break
      default:
        handleRetryPermissions()
        break
    }
  }

  const handleEnterDemoMode = () => {
    const demoRoute = createDemoViewerRoute(demoScenario.id)
    markViewerOnboardingCompleted()
    setViewerSettings((current) => ({
      ...current,
      onboardingCompleted: true,
    }))
    setSelectedObjectId(null)
    setMotionAffordanceSamples([])
    setCalibrationBanner(null)
    setManualPoseState(
      createManualPoseState({
        pitchDeg: demoScenario.initialPitchDeg,
      }),
    )
    setSceneTimeMs(demoScenario.observer.timestampMs)
    setStartupState('sensor-absolute')
    commitViewerRouteState(demoRoute.state)
  }

  const handleSelectDemoScenario = (scenarioId: DemoScenarioId) => {
    const nextScenario = getDemoScenario(scenarioId)
    const nextState = {
      ...createDemoViewerRoute(scenarioId).state,
    }

    setSelectedObjectId(null)
    setMotionAffordanceSamples([])
    setManualPoseState(
      createManualPoseState({
        pitchDeg: nextScenario.initialPitchDeg,
      }),
    )
    setSceneTimeMs(nextScenario.observer.timestampMs)
    setStartupState('sensor-absolute')
    commitViewerRouteState(nextState)
  }

  const handleStageRef = useCallback((node: HTMLDivElement | null) => {
    setStageElement(node)

    if (!node) {
      return
    }

    setViewport(getViewportFromBounds(node.getBoundingClientRect()))
  }, [])

  const handleVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoElementRef.current = node
  }, [])

  useEffect(() => {
    sceneTimeMsRef.current = sceneTimeMs
  }, [sceneTimeMs])

  useEffect(() => {
    const sceneClock = resolveSceneClock({
      prefersReducedMotion,
      motionQuality: viewerSettings.motionQuality,
    })
    const wallClockStartMs = getCurrentTimestampMs()
    const demoSceneStartTimeMs = sceneTimeMsRef.current
    const readNextSceneTimeMs = () =>
      state.entry === 'demo'
        ? demoSceneStartTimeMs + (getCurrentTimestampMs() - wallClockStartMs)
        : getCurrentTimestampMs()
    const commitSceneTime = () => {
      const nextSceneTimeMs = readNextSceneTimeMs()

      setSceneTimeMs((current) => (current === nextSceneTimeMs ? current : nextSceneTimeMs))
    }

    commitSceneTime()

    if (sceneClock.mode === 'coarse') {
      const intervalId = window.setInterval(commitSceneTime, sceneClock.intervalMs)

      return () => {
        window.clearInterval(intervalId)
      }
    }

    let animationFrameId: number | null = null
    let lastCommittedFrameMs = Number.NEGATIVE_INFINITY

    const tick = (frameMs: number) => {
      if (frameMs - lastCommittedFrameMs >= sceneClock.intervalMs) {
        lastCommittedFrameMs = frameMs
        commitSceneTime()
      }

      animationFrameId = window.requestAnimationFrame(tick)
    }

    animationFrameId = window.requestAnimationFrame(tick)

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId)
      }
    }
  }, [
    demoScenario.observer.timestampMs,
    prefersReducedMotion,
    state.entry,
    viewerSettings.motionQuality,
  ])

  useEffect(() => {
    if (!sceneSnapshot.error || state.entry === 'demo') {
      return
    }

    const demoRoute = createDemoViewerRoute('tokyo-iss')
    const timeoutId = window.setTimeout(() => {
      setAstronomyFailureBanner(
        'Live astronomy is unavailable. SkyLens switched to the demo sky instead of leaving a partial live viewer active.',
      )
      setSelectedObjectId(null)
      setMotionAffordanceSamples([])
      setManualPoseState(
        createManualPoseState({
          pitchDeg: getDemoScenario('tokyo-iss').initialPitchDeg,
        }),
      )
      setSceneTimeMs(getDemoScenario('tokyo-iss').observer.timestampMs)
      setStartupState('sensor-absolute')
      commitViewerRouteState(demoRoute.state)
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [router, sceneSnapshot.error, state.entry])

  useEffect(() => {
    writeViewerSettings(viewerSettings)
  }, [viewerSettings])

  useEffect(() => {
    if (!scopeModeActive) {
      scopeCatalogRequestTrackerRef.current.invalidate()
      return
    }

    const generation = scopeCatalogRequestTrackerRef.current.begin()
    let cancelled = false

    void (async () => {
      try {
        const manifest = await loadScopeManifest()
        const [namesTable, bandIndex] = await Promise.all([
          loadScopeNamesTable(manifest),
          loadScopeBandIndex(manifest, scopeActiveBand.bandDir),
        ])

        if (cancelled || !scopeCatalogRequestTrackerRef.current.isCurrent(generation)) {
          return
        }

        setScopeNamesTable(namesTable)
        setScopeBandIndexState({
          bandDir: scopeActiveBand.bandDir,
          index: bandIndex,
        })
      } catch {
        if (cancelled || !scopeCatalogRequestTrackerRef.current.isCurrent(generation)) {
          return
        }

        setScopeBandIndexState(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [scopeActiveBand.bandDir, scopeModeActive])

  useEffect(() => {
    if (
      !scopeDeepStarsEnabled ||
      activeScopeBandIndex === null ||
      scopeSelectedTileKey.length === 0
    ) {
      scopeTileRequestTrackerRef.current.invalidate()
      setScopeLoadedDeepStars([])
      return
    }

    const generation = scopeTileRequestTrackerRef.current.begin()
    let cancelled = false

    setScopeLoadedDeepStars([])

    void (async () => {
      try {
        const tileFiles = scopeSelectedTileKey.split('|').filter((value) => value.length > 0)
        const tiles = await Promise.all(
          tileFiles.map(async (tileFile) => {
            const rows = await loadScopeTileRows(scopeActiveBand.bandDir, tileFile)

            return rows.map((row, rowIndex) => ({
              ...row,
              id: `${scopeActiveBand.bandDir}:${getScopeTileId({ file: tileFile })}:${rowIndex}`,
              displayName:
                row.nameId > 0 ? scopeNamesTable[String(row.nameId)] : undefined,
            }))
          }),
        )

        if (cancelled || !scopeTileRequestTrackerRef.current.isCurrent(generation)) {
          return
        }

        setScopeLoadedDeepStars(tiles.flat())
      } catch {
        if (cancelled || !scopeTileRequestTrackerRef.current.isCurrent(generation)) {
          return
        }

        setScopeLoadedDeepStars([])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    activeScopeBandIndex,
    scopeActiveBand.bandDir,
    scopeDeepStarsEnabled,
    scopeNamesTable,
    scopeSelectedTileKey,
  ])

  useEffect(() => {
    if (
      hoveredObjectId !== null &&
      !projectedObjects.some(
        (object) => object.id === hoveredObjectId && object.projection.visible,
      )
    ) {
      setHoveredObjectId(null)
    }
  }, [hoveredObjectId, projectedObjects])

  useEffect(() => {
    liveObserverRef.current = liveObserver
  }, [liveObserver])

  useEffect(() => {
    let cancelled = false

    queueMicrotask(() => {
      if (cancelled) {
        return
      }

      setManualObserverDraft(createManualObserverDraft(viewerSettings.manualObserver))
    })

    return () => {
      cancelled = true
    }
  }, [viewerSettings.manualObserver])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotionPreference = () => {
      setPrefersReducedMotion(mediaQuery.matches)
    }

    updateMotionPreference()

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateMotionPreference)
    } else {
      mediaQuery.addListener(updateMotionPreference)
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', updateMotionPreference)
      } else {
        mediaQuery.removeListener(updateMotionPreference)
      }
    }
  }, [])

  useEffect(() => {
    let disposed = false

    const refreshHealth = async () => {
      try {
        const payload = await fetchHealthStatus()

        if (!disposed) {
          setHealthStatus(payload)
        }
      } catch {
        if (!disposed) {
          setHealthStatus(null)
        }
      }
    }

    void refreshHealth()
    const intervalId = window.setInterval(() => {
      void refreshHealth()
    }, 30_000)

    return () => {
      disposed = true
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const syncVisibility = () => {
      setDocumentVisible(document.visibilityState === 'visible')
    }

    syncVisibility()
    document.addEventListener('visibilitychange', syncVisibility)

    return () => {
      document.removeEventListener('visibilitychange', syncVisibility)
    }
  }, [])

  useEffect(() => {
    if (state.entry !== 'demo') {
      return
    }

    aircraftTrackerRef.current.reset()
    setAircraftRevision((current) => current + 1)
  }, [demoScenario, state.entry])

  useEffect(() => {
    if (state.entry !== 'demo') {
      return
    }

    const snapshot = getDemoAircraftSnapshotAtTime(demoScenario, demoAircraftSeedTimeMs)

    aircraftTrackerRef.current.ingest(snapshot)
    aircraftTrackerRef.current.prune(demoAircraftSeedTimeMs)
    setAircraftAvailability(snapshot.availability)
    latestAircraftSnapshotTimeSRef.current = snapshot.snapshotTimeS
    setLatestAircraftSnapshotTimeS(snapshot.snapshotTimeS)
    setAircraftRevision((current) => current + 1)
  }, [demoAircraftSeedTimeMs, demoScenario, state.entry])

  useEffect(() => {
    if (state.entry === 'demo') {
      return
    }

    aircraftTrackerRef.current.reset()
    setAircraftAvailability('available')
    latestAircraftSnapshotTimeSRef.current = null
    setLatestAircraftSnapshotTimeS(null)
    setAircraftRevision((current) => current + 1)
  }, [state.entry])

  useEffect(() => {
    if (
      prefersReducedMotion ||
      !activeMotionAffordanceObjectId ||
      !shouldRenderMotionAffordance ||
      !activeMotionAffordanceVisible ||
      !activeMotionAffordanceInViewport ||
      activeMotionAffordanceX === null ||
      activeMotionAffordanceY === null
    ) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setMotionAffordanceSamples((current) => {
        const nextSamples = current.filter(
          (sample) => sample.id === activeMotionAffordanceObjectId,
        )

        return [
          ...nextSamples,
          {
            id: activeMotionAffordanceObjectId,
            x: activeMotionAffordanceX,
            y: activeMotionAffordanceY,
          },
        ].slice(-MOTION_AFFORDANCE_SAMPLE_LIMITS[viewerSettings.motionQuality])
      })
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    activeMotionAffordanceInViewport,
    activeMotionAffordanceObjectId,
    activeMotionAffordanceVisible,
    activeMotionAffordanceX,
    activeMotionAffordanceY,
    prefersReducedMotion,
    sceneTimeMs,
    shouldRenderMotionAffordance,
    viewerSettings.motionQuality,
  ])

  useEffect(() => {
    if (!shouldFetchAircraft || !observer || typeof window === 'undefined') {
      return
    }

    let disposed = false
    let timeoutId: number | null = null
    let abortController: AbortController | null = null
    let requestTimeoutId: number | null = null
    let lastSnapshotTimeS = latestAircraftSnapshotTimeSRef.current

    const scheduleNextPoll = (snapshotTimeS?: number | null) => {
      if (disposed) {
        return
      }

      const delayMs = getAircraftPollDelayMs({
        motionQuality: viewerSettings.motionQuality,
        snapshotTimeS,
        nowMs: getCurrentTimestampMs(),
      })

      timeoutId = window.setTimeout(() => {
        void refreshAircraft()
      }, delayMs)
    }

    const refreshAircraft = async () => {
      abortController?.abort()
      if (requestTimeoutId !== null) {
        window.clearTimeout(requestTimeoutId)
        requestTimeoutId = null
      }
      const requestController = new AbortController()
      let didTimeout = false
      abortController = requestController
      requestTimeoutId = window.setTimeout(() => {
        didTimeout = true
        requestController.abort()
      }, AIRCRAFT_REQUEST_TIMEOUT_MS)

      try {
        const nextSnapshot = await fetchAircraftSnapshot(
          observer,
          ((input: RequestInfo | URL, init?: RequestInit) =>
            fetch(input, {
              ...init,
              signal: requestController.signal,
            })) as typeof fetch,
        )

        if (disposed) {
          return
        }

        aircraftTrackerRef.current.ingest(nextSnapshot)
        aircraftTrackerRef.current.prune(getCurrentTimestampMs())
        setAircraftAvailability(nextSnapshot.availability)
        latestAircraftSnapshotTimeSRef.current = nextSnapshot.snapshotTimeS
        setLatestAircraftSnapshotTimeS(nextSnapshot.snapshotTimeS)
        lastSnapshotTimeS = nextSnapshot.snapshotTimeS
        setAircraftRevision((current) => current + 1)
        scheduleNextPoll(nextSnapshot.snapshotTimeS)
      } catch {
        if (disposed || (requestController.signal.aborted && !didTimeout)) {
          return
        }

        setAircraftAvailability('degraded')
        aircraftTrackerRef.current.prune(getCurrentTimestampMs())
        scheduleNextPoll(lastSnapshotTimeS)
      } finally {
        if (requestTimeoutId !== null) {
          window.clearTimeout(requestTimeoutId)
          requestTimeoutId = null
        }
      }
    }

    void refreshAircraft()

    return () => {
      disposed = true
      abortController?.abort()
      if (requestTimeoutId !== null) {
        window.clearTimeout(requestTimeoutId)
        requestTimeoutId = null
      }

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [
    observer,
    shouldFetchAircraft,
    viewerSettings.motionQuality,
  ])

  useEffect(() => {
    if (!hasLiveSessionStarted || state.entry === 'demo') {
      return
    }

    let disposed = false

    const refreshCatalog = async () => {
      try {
        const nextCatalog = await fetchSatelliteCatalog()

        if (!disposed) {
          setSatelliteCatalog(nextCatalog)
        }
      } catch {
        if (!disposed) {
          setSatelliteCatalog((current) => current)
        }
      }
    }

    void refreshCatalog()

    const intervalId = window.setInterval(() => {
      void refreshCatalog()
    }, 6 * 60 * 60 * 1000)

    return () => {
      disposed = true
      window.clearInterval(intervalId)
    }
  }, [hasLiveSessionStarted, state.entry])

  useEffect(() => {
    if (state.entry !== 'live' || typeof window === 'undefined') {
      return
    }

    if (!secureLiveArContext) {
      let cancelled = false

      queueMicrotask(() => {
        if (cancelled) {
          return
        }

        setStartupState('unsupported')
      })

      return () => {
        cancelled = true
      }
    }
  }, [secureLiveArContext, state.entry])

  useEffect(() => {
    if (!stageElement) {
      return
    }

    const updateViewport = () => {
      const nextViewport = getViewportFromBounds(stageElement.getBoundingClientRect())

      setViewport((current) =>
        current.width === nextViewport.width && current.height === nextViewport.height
          ? current
          : nextViewport,
      )
    }

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            updateViewport()
          })

    updateViewport()
    resizeObserver?.observe(stageElement)
    window.addEventListener('resize', updateViewport)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateViewport)
    }
  }, [stageElement])

  useEffect(() => {
    if (
      state.entry !== 'live' ||
      startupState === 'ready-to-request' ||
      state.location !== 'granted' ||
      liveObserver !== null
    ) {
      return
    }

    let disposed = false

    requestStartupObserverState()
      .then((nextObserver) => {
        if (disposed) {
          return
        }

        setLiveObserver(nextObserver)
        setObserverSource('geo')
        setLiveLocationError(null)
      })
      .catch(() => {
        if (disposed) {
          return
        }

        if (viewerSettings.manualObserver) {
          applyManualObserver(viewerSettings.manualObserver)
          return
        }

        setLiveLocationError(
          'Location did not resolve in time. Enter latitude, longitude, and altitude manually or retry geolocation.',
        )
        setStartupState(
          resolveStartupState({
            orientationStatus: state.orientation,
            cameraStatus: state.camera,
            hasObserver: false,
          }),
        )
      })

    return () => {
      disposed = true
    }
  }, [liveObserver, startupState, state, viewerSettings.manualObserver])

  useEffect(() => {
    const videoElement = videoElementRef.current

    if (
      state.entry !== 'live' ||
      startupState === 'ready-to-request' ||
      state.camera !== 'granted' ||
      !videoElement ||
      cameraStreamRef.current
    ) {
      return
    }

    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) {
        return
      }

      void openLiveCamera(viewerSettings.selectedCameraDeviceId).catch(() => undefined)
    })

    return () => {
      cancelled = true
    }
  }, [startupState, state, viewerSettings.selectedCameraDeviceId])

  useEffect(() => {
    if (
      !hasLiveSessionStarted ||
      state.location !== 'granted' ||
      observerSource !== 'geo' ||
      !liveObserverRef.current
    ) {
      return
    }

    let disposed = false
    const tracker = startObserverTracking(
      (nextObserver) => {
        setLiveObserver(nextObserver)
        setLiveLocationError(null)
      },
      {
        initialObserver: liveObserverRef.current,
        onError: () => {
          if (!disposed) {
            setLiveLocationError(
              'SkyLens keeps your last accepted observer until the next fix moves more than 25 meters or 15 seconds have elapsed.',
            )
          }
        },
      },
    )

    return () => {
      disposed = true
      tracker.stop()
    }
  }, [hasLiveSessionStarted, observerSource, state.location])

  useEffect(() => {
    if (!hasLiveSessionStarted) {
      return
    }

    let cancelled = false
    let animationFrameId: number | null = null
    let videoFrameRequestId: number | null = null
    const frameVideo = videoElementRef.current as HTMLVideoElement | null
    const callbackVideo = frameVideo as (HTMLVideoElement & {
      requestVideoFrameCallback?: (
        callback: (
          now: number,
          metadata: { width?: number; height?: number },
        ) => void,
      ) => number
      cancelVideoFrameCallback?: (handle: number) => void
    }) | null

    const updateSize = (width?: number, height?: number) => {
      setRenderFrameToken((current) => current + 1)

      if (!frameVideo) {
        return
      }

      const nextWidth = Math.round(width ?? frameVideo.videoWidth ?? 0)
      const nextHeight = Math.round(height ?? frameVideo.videoHeight ?? 0)

      if (nextWidth <= 0 || nextHeight <= 0) {
        return
      }

      setCameraSourceSize((current) =>
        current?.width === nextWidth && current?.height === nextHeight
          ? current
          : {
              width: nextWidth,
              height: nextHeight,
            },
      )
    }

    const scheduleAnimationFrame = () => {
      animationFrameId = window.requestAnimationFrame(() => {
        if (cancelled) {
          return
        }

        updateSize()
        scheduleAnimationFrame()
      })
    }

    if (
      cameraStreamActive &&
      callbackVideo &&
      typeof callbackVideo.requestVideoFrameCallback === 'function'
    ) {
      const handleFrame = (_now: number, metadata: { width?: number; height?: number }) => {
        if (cancelled) {
          return
        }

        updateSize(metadata.width, metadata.height)
        videoFrameRequestId = callbackVideo.requestVideoFrameCallback?.(handleFrame) ?? null
      }

      videoFrameRequestId = callbackVideo.requestVideoFrameCallback(handleFrame)
    } else {
      scheduleAnimationFrame()
    }

    updateSize()

    return () => {
      cancelled = true

      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId)
      }

      if (
        videoFrameRequestId !== null &&
        callbackVideo &&
        typeof callbackVideo.cancelVideoFrameCallback === 'function'
      ) {
        callbackVideo.cancelVideoFrameCallback(videoFrameRequestId)
      }
    }
  }, [cameraStreamActive, hasLiveSessionStarted])

  useEffect(() => {
    const videoElement = videoElementRef.current

    if (
      state.entry !== 'live' ||
      state.camera !== 'granted' ||
      !hasLiveSessionStarted ||
      !videoElement
    ) {
      return
    }

    if (!cameraStreamRef.current) {
      return
    }

    const preferredDeviceId = viewerSettings.selectedCameraDeviceId ?? null

    if (lastOpenedCameraPreferenceRef.current === preferredDeviceId) {
      return
    }

    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) {
        return
      }

      void openLiveCamera(preferredDeviceId).catch(() => {
        commitViewerRouteState({
          ...state,
          camera: 'denied',
        })
        setStartupState(
          resolveStartupState({
            orientationStatus: state.orientation,
            cameraStatus: 'denied',
            hasObserver: observer !== null,
            orientationNeedsCalibration: startupState === 'sensor-relative-needs-calibration',
          }),
        )
      })
    })

    return () => {
      cancelled = true
    }
  }, [
    hasLiveSessionStarted,
    observer,
    startupState,
    state,
    viewerSettings.selectedCameraDeviceId,
  ])

  useEffect(() => {
    const videoElement = videoElementRef.current

    if (state.entry === 'live' && state.camera === 'granted') {
      return
    }

    if (videoElement) {
      videoElement.srcObject = null
    }

    stopMediaStream(cameraStreamRef.current)
    cameraStreamRef.current = null
    lastOpenedCameraPreferenceRef.current = null
    let cancelled = false

    queueMicrotask(() => {
      if (cancelled) {
        return
      }

      setLiveCameraStreamActive(false)
      setCameraSourceSize(null)
    })

    return () => {
      cancelled = true
    }
  }, [state.camera, state.entry])

  useEffect(() => {
    return () => {
      const videoElement = videoElementRef.current

      if (videoElement) {
        videoElement.srcObject = null
      }

      stopMediaStream(cameraStreamRef.current)
      cameraStreamRef.current = null
      lastOpenedCameraPreferenceRef.current = null
      setLiveCameraStreamActive(false)
    }
  }, [])

  useEffect(() => {
    viewerRouteStateRef.current = state
  }, [state])

  useEffect(() => {
    orientationControllerRef.current?.stop()
    orientationControllerRef.current = null
    poorSinceRef.current = null

    if (!hasLiveSessionStarted || manualMode) {
      clearOrientationStartupTimeout()
      setCalibrationBanner(null)
      resetOrientationSessionState(
        viewerRouteStateRef.current.orientation === 'granted',
      )
      return
    }

    const controller = subscribeToOrientationPose(
      ({
        pose,
        sample,
        orientationSource: nextOrientationSource,
        orientationAbsolute,
        orientationNeedsCalibration,
        poseCalibration,
      }) => {
        setSensorCameraPose(pose)
        setOrientationSource(nextOrientationSource)
        setOrientationAbsolute(orientationAbsolute)
        setOrientationNeedsCalibration(orientationNeedsCalibration)
        setLatestOrientationSample(sample)
        clearOrientationStartupTimeout()
        if (previousOrientationSampleTimestampRef.current !== null) {
          const sampleIntervalMs = sample.timestampMs - previousOrientationSampleTimestampRef.current

          if (sampleIntervalMs > 0) {
            setOrientationSampleRateHz(1_000 / sampleIntervalMs)
          }
        }
        previousOrientationSampleTimestampRef.current = sample.timestampMs
        const previousSelection = previousOrientationSelectionRef.current
        const upgradedFromRelative =
          orientationAbsolute &&
          (previousSelection.source === 'relative-sensor' ||
            previousSelection.source === 'deviceorientation-relative' ||
            (!previousSelection.absolute && previousSelection.source !== null))
        setOrientationUpgradedFromRelative((current) =>
          orientationAbsolute ? current || upgradedFromRelative : false,
        )
        previousOrientationSelectionRef.current = {
          source: nextOrientationSource,
          absolute: orientationAbsolute,
        }
        const currentRouteState = viewerRouteStateRef.current

        if (currentRouteState.orientation !== 'granted') {
          commitViewerRouteState({
            ...currentRouteState,
            orientation: 'granted',
          })
        }
        setStartupState(
          resolveStartupState({
            orientationStatus: 'granted',
            cameraStatus: currentRouteState.camera,
            hasObserver: liveObserverRef.current !== null,
            orientationNeedsCalibration,
            orientationAbsolute,
          }),
        )

        if (pose.alignmentHealth === 'poor') {
          if (poorSinceRef.current === null) {
            poorSinceRef.current = sample.timestampMs
          }

          if (sample.timestampMs - poorSinceRef.current >= 3_000) {
            setShowAlignmentGuidance(true)
          }

          return
        }

        poorSinceRef.current = null
        setShowAlignmentGuidance(false)
        setCalibrationBanner(
          orientationNeedsCalibration
            ? 'Relative motion is active. Center the suggested target and align before trusting labels.'
            : poseCalibration.calibrated
              ? 'Calibration is active.'
              : null,
        )
      },
      {
        initialCalibration: viewerSettings.poseCalibration,
      },
    )

    orientationControllerRef.current = controller

    return () => {
      controller.stop()

      if (orientationControllerRef.current === controller) {
        orientationControllerRef.current = null
      }

      clearOrientationStartupTimeout()
      poorSinceRef.current = null
      setCalibrationBanner(null)
      previousOrientationSampleTimestampRef.current = null
      previousOrientationSelectionRef.current = {
        source: null,
        absolute: false,
      }
    }
  }, [
    clearOrientationStartupTimeout,
    commitViewerRouteState,
    hasLiveSessionStarted,
    manualMode,
  ])

  useEffect(() => {
    clearOrientationStartupTimeout()

    if (
      state.entry !== 'live' ||
      startupState !== 'awaiting-orientation' ||
      state.orientation !== 'unknown'
    ) {
      return
    }

    orientationStartupTimeoutRef.current = window.setTimeout(() => {
      const currentRouteState = viewerRouteStateRef.current
      const nextOrientationStatus = resolveOrientationTimeoutStatus()

      setMotionRetryError(getMotionStartupTimeoutMessage(browserFamily, nextOrientationStatus))
      commitViewerRouteState({
        ...currentRouteState,
        orientation: nextOrientationStatus,
      })
      setStartupState(
        resolveStartupState({
          orientationStatus: nextOrientationStatus,
          cameraStatus: currentRouteState.camera,
          hasObserver: liveObserverRef.current !== null,
          orientationNeedsCalibration: false,
          orientationAbsolute: false,
        }),
      )
    }, ORIENTATION_READY_TIMEOUT_MS)

    return clearOrientationStartupTimeout
  }, [
    browserFamily,
    clearOrientationStartupTimeout,
    commitViewerRouteState,
    startupState,
    state.entry,
    state.orientation,
  ])

  useEffect(() => {
    orientationControllerRef.current?.setCalibration?.(viewerSettings.poseCalibration)
  }, [viewerSettings.poseCalibration])

  useEffect(() => {
    if (!showAlignmentGuidance || manualMode) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setShowAlignmentGuidance(false)
    }, 6_000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [manualMode, showAlignmentGuidance])

  useEffect(() => {
    if (!manualMode) {
      return
    }

    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) {
        return
      }

      setHoveredObjectId(null)
      setIsAlignmentPanelOpen(false)
      setIsMobileAlignmentFocusActive(false)
    })

    return () => {
      cancelled = true
    }
  }, [manualMode])

  useEffect(() => {
    if (!isMobileAlignmentFocusActive) {
      return
    }

    let cancelled = false

    if (state.entry !== 'live' || manualMode || !cameraStreamActive) {
      queueMicrotask(() => {
        if (cancelled) {
          return
        }

        setIsMobileAlignmentFocusActive(false)
      })

      return () => {
        cancelled = true
      }
    }

    queueMicrotask(() => {
      if (cancelled) {
        return
      }

      setIsMobileOverlayOpen(false)
    })

    return () => {
      cancelled = true
    }
  }, [
    cameraStreamActive,
    isMobileAlignmentFocusActive,
    manualMode,
    state.entry,
  ])

  useEffect(() => {
    if (!isDesktopSettingsSheetOpen && !isAlignmentPanelOpen) {
      return
    }

    setIsDesktopViewerPanelOpen(false)
  }, [isAlignmentPanelOpen, isDesktopSettingsSheetOpen])

  useLayoutEffect(() => {
    if (!isMobileOverlayOpen || isMobileAlignmentFocusActive) {
      return
    }

    mobileViewerOverlayCloseButtonRef.current?.focus()
  }, [isMobileAlignmentFocusActive, isMobileOverlayOpen])

  useLayoutEffect(() => {
    if (isMobileOverlayOpen) {
      return
    }

    const restoreFocus = pendingMobileViewerFocusRestoreRef.current

    if (!restoreFocus) {
      return
    }

    pendingMobileViewerFocusRestoreRef.current = null
    focusAfterDismiss(restoreFocus())
  }, [isMobileOverlayOpen])

  useLayoutEffect(() => {
    if (!shouldShowAlignmentInstructions) {
      return
    }

    mobileAlignmentOverlayCloseButtonRef.current?.focus()
  }, [shouldShowAlignmentInstructions])

  useLayoutEffect(() => {
    if (shouldShowAlignmentInstructions || isMobileAlignmentFocusActive) {
      return
    }

    const restoreFocus = pendingAlignmentFocusRestoreRef.current

    if (!restoreFocus) {
      return
    }

    pendingAlignmentFocusRestoreRef.current = null
    focusAfterDismiss(restoreFocus())
  }, [isMobileAlignmentFocusActive, shouldShowAlignmentInstructions])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    if (!shouldLockViewerScroll) {
      return
    }

    const root = document.documentElement
    const body = document.body
    const previousRootOverflow = root.style.overflow
    const previousRootOverscrollBehavior = root.style.overscrollBehavior
    const previousBodyOverflow = body.style.overflow
    const previousBodyOverscrollBehavior = body.style.overscrollBehavior

    root.style.overflow = 'hidden'
    root.style.overscrollBehavior = 'none'
    body.style.overflow = 'hidden'
    body.style.overscrollBehavior = 'none'

    return () => {
      root.style.overflow = previousRootOverflow
      root.style.overscrollBehavior = previousRootOverscrollBehavior
      body.style.overflow = previousBodyOverflow
      body.style.overscrollBehavior = previousBodyOverscrollBehavior
    }
  }, [shouldLockViewerScroll])

  const updatePoseCalibration = (nextCalibration: PoseCalibration) => {
    setCalibrationBanner(null)
    setShowAlignmentGuidance(false)
    setViewerSettings((current) => ({
      ...current,
      poseCalibration: nextCalibration,
    }))
  }

  const recenter = () => {
    setShowAlignmentGuidance(false)

    if (manualMode) {
      setManualPoseState(recenterManualPose())
    }
  }

  const fixAlignment = () => {
    const activeOpener = getActiveFocusableElement()
    const activeSurface = activeOpener?.getAttribute('data-focus-surface')

    openAlignmentExperience({
      opener:
        activeSurface === 'mobile-settings-trigger' || activeSurface === 'desktop-settings-trigger'
          ? activeOpener
          : null,
      surface:
        isMobileSettingsSheetOpen || activeSurface === 'mobile-settings-trigger'
          ? 'mobile'
          : 'desktop',
    })
  }

  const alignCalibrationTarget = () => {
    if (manualMode || !latestOrientationSample) {
      return
    }

    const target = calibrationTarget

    if (!target) {
      setCalibrationBanner('No calibration target is available right now.')
      return
    }

    const rawBasis = getCameraBasisVectors(latestOrientationSample.rawQuaternion)
    const targetForwardWorld = normalizeVec3(
      horizontalToWorldVector(target.azimuthDeg, target.elevationDeg),
    )
    let right = normalizeVec3(crossVec3(targetForwardWorld, WORLD_UP))

    if (Math.hypot(...right) < 1e-6) {
      const projectedRight = subtractProjectedComponent(rawBasis.right, targetForwardWorld)
      right =
        Math.hypot(...projectedRight) < 1e-6 ? rawBasis.right : normalizeVec3(projectedRight)
    }

    const up = normalizeVec3(crossVec3(right, targetForwardWorld))
    const targetQuaternion = createQuaternionFromBasis(right, [-up[0], -up[1], -up[2]], targetForwardWorld)
    const nextCalibration = createPoseCalibrationFromReferencePose(
      latestOrientationSample.rawQuaternion,
      {
        targetQuaternion,
        source: latestOrientationSample.source,
        timestampMs: getCurrentTimestampMs(),
      },
    )

    updatePoseCalibration(nextCalibration)
    setIsAlignmentPanelOpen(false)
    setIsMobileAlignmentFocusActive(false)
    setLastAppliedCalibrationTarget(target)
    setCalibrationBanner(`Aligned to ${target.label}.`)
  }

  const resetCalibration = () => {
    updatePoseCalibration(createIdentityPoseCalibration())
    setLastAppliedCalibrationTarget(null)
    setCalibrationBanner('Calibration reset to the raw sensor pose.')
  }

  const fineAdjustCalibration = (adjustment: {
    axis: 'yaw' | 'pitch'
    deltaDeg: number
  }) => {
    if (manualMode) {
      return
    }

    const axis =
      adjustment.axis === 'yaw'
        ? WORLD_UP
        : getCameraBasisVectors(sensorCameraPose.quaternion).right
    const deltaQuaternion = createAxisAngleQuaternion(axis, adjustment.deltaDeg)
    const nextCalibration = createPoseCalibration({
      ...viewerSettings.poseCalibration,
      calibrated: true,
      sourceAtCalibration:
        orientationSource ?? viewerSettings.poseCalibration.sourceAtCalibration,
      lastCalibratedAtMs: getCurrentTimestampMs(),
      offsetQuaternion: multiplyQuaternions(
        deltaQuaternion,
        viewerSettings.poseCalibration.offsetQuaternion,
      ),
    })

    updatePoseCalibration(nextCalibration)
  }

  const mobileAlignmentPanelProps = {
    targetLabel: calibrationTarget.label,
    status: alignmentTutorial.status,
    supportingNotice: alignmentTutorial.supportingNotice,
    primaryStep: alignmentTutorial.primaryStep,
    selectedTarget: alignmentTargetPreference,
    availability: calibrationTargetResolution.availability,
    onSelectTarget: handleAlignmentTargetPreferenceChange,
    onResetCalibration: resetCalibration,
    onFineAdjustCalibration: fineAdjustCalibration,
    canResetCalibration,
    onClose: closeAlignmentExperience,
    onStartAlignment: startAlignmentFocus,
    canStartAlignment: canAlignCalibration,
    showStartAlignmentAction: usesCameraStageAlignmentFocus,
  }

  const settingsSheetProps = {
    onEnterDemoMode: handleEnterDemoMode,
    onDemoScenarioSelect: handleSelectDemoScenario,
    onFixAlignment: fixAlignment,
    onResetCalibration: resetCalibration,
    onFineAdjustCalibration: fineAdjustCalibration,
    onRecenter: recenter,
    canFixAlignment,
    canRecenter: manualMode,
    alignmentTargetPreference,
    alignmentTargetAvailability: calibrationTargetResolution.availability,
    alignmentTargetFallbackLabel: calibrationTargetResolution.preferredTargetUnavailable
      ? calibrationTarget.label
      : null,
    onAlignmentTargetPreferenceChange: handleAlignmentTargetPreferenceChange,
    verticalFovAdjustmentDeg: viewerSettings.verticalFovAdjustmentDeg,
    showScopeControls: scopeControlsAvailable,
    scopeModeEnabled: viewerSettings.scopeModeEnabled,
    scopeLensDiameterPct: viewerSettings.scopeLensDiameterPct,
    transparencyPct: viewerSettings.scopeOptics.transparencyPct,
    markerScale: viewerSettings.markerScale,
    cameraDevices,
    selectedCameraDeviceId: viewerSettings.selectedCameraDeviceId,
    layers: enabledLayers,
    layerAvailabilityLabels: {
      aircraft: getAircraftAvailabilityMessage(activeAircraftAvailability) ?? undefined,
      satellites: getSatelliteLayerStatusLabel(healthStatus),
    },
    likelyVisibleOnly,
    labelDisplayMode: viewerSettings.labelDisplayMode,
    motionQuality: viewerSettings.motionQuality,
    demoScenarioId: state.entry === 'demo' ? demoScenario.id : undefined,
    demoScenarioOptions: state.entry === 'demo' ? demoScenarioOptions : [],
    onLayerToggle: (layer: EnabledLayer, enabled: boolean) => {
      setViewerSettings((current) => ({
        ...current,
        enabledLayers: {
          ...current.enabledLayers,
          [layer]: enabled,
        },
      }))
    },
    onLikelyVisibleOnlyChange: (enabled: boolean) => {
      setViewerSettings((current) => ({
        ...current,
        likelyVisibleOnly: enabled,
      }))
    },
    onLabelDisplayModeChange: (labelDisplayMode: 'center_only' | 'on_objects' | 'top_list') => {
      setViewerSettings((current) => ({
        ...current,
        labelDisplayMode,
      }))
    },
    onMotionQualityChange: (motionQuality: MotionQuality) => {
      setViewerSettings((current) => ({
        ...current,
        motionQuality,
      }))
    },
    onVerticalFovAdjustmentChange: (value: number) => {
      setViewerSettings((current) => ({
        ...current,
        verticalFovAdjustmentDeg: value,
      }))
    },
    onScopeModeEnabledChange: (enabled: boolean) => {
      setViewerSettings((current) => ({
        ...current,
        scopeModeEnabled: enabled,
      }))
    },
    onScopeLensDiameterPctChange: (value: number) => {
      setViewerSettings((current) => ({
        ...current,
        scopeLensDiameterPct: normalizeScopeLensDiameterPct(value),
      }))
    },
    onTransparencyChange: (value: number) => {
      setViewerSettings((current) => ({
        ...current,
        scopeOptics: {
          ...current.scopeOptics,
          transparencyPct: value,
        },
      }))
    },
    onMarkerScaleChange: (value: number) => {
      setViewerSettings((current) => ({
        ...current,
        markerScale: value,
      }))
    },
    onSelectedCameraDeviceChange: (deviceId: string) => {
      setViewerSettings((current) => ({
        ...current,
        selectedCameraDeviceId: deviceId || null,
      }))
    },
  }
  const desktopSettingsSheetProps = {
    ...settingsSheetProps,
    onOpenChange: setIsDesktopSettingsSheetOpen,
    triggerSurfaceId: 'desktop-settings-trigger',
  }
  const mobileSettingsSheetProps = {
    ...settingsSheetProps,
    onOpenChange: setIsMobileSettingsSheetOpen,
    triggerSurfaceId: 'mobile-settings-trigger',
  }
  const manualObserverPanel =
    state.entry !== 'demo' &&
    startupState !== 'ready-to-request' &&
    startupState !== 'requesting' &&
    observerSource !== 'geo' ? (
      <ManualObserverPanel
        draft={manualObserverDraft}
        error={manualObserverError}
        onDraftChange={(field, value) => {
          setManualObserverDraft((current) => ({
            ...current,
            [field]: value,
          }))
        }}
        onRetryLocation={handleRetryLocation}
        onSubmit={handleManualObserverSubmit}
        isPending={isPending}
      />
    ) : null
  const sharedMotionRecoveryBanner =
    state.entry !== 'demo' &&
    (state.orientation === 'denied' || state.orientation === 'unavailable')
      ? {
          body: 'Motion is not enabled. Sky elements will not appear in the right location until motion is enabled.',
          actionLabel: isPending
            ? permissionRecoveryAction.pendingLabel
            : permissionRecoveryAction.label,
          actionDisabled: isPending,
          footer: motionRetryError ?? getMotionRecoveryBody(browserFamily),
        }
      : null
  const sharedBannerFeed = resolveViewerBannerFeed({
    astronomyFailureBanner,
    demoScenario:
      state.entry === 'demo'
        ? {
            label: demoScenario.label,
            description: demoScenario.description,
          }
        : null,
    cameraStatus:
      state.entry !== 'demo' &&
      startupState !== 'ready-to-request' &&
      startupState !== 'requesting'
        ? state.camera
        : null,
    cameraRetryAvailable:
      state.entry !== 'demo' &&
      startupState !== 'ready-to-request' &&
      startupState !== 'requesting',
    motionRecovery: sharedMotionRecoveryBanner,
    locationError,
    locationRetryAvailable:
      state.entry !== 'demo' &&
      startupState !== 'ready-to-request' &&
      startupState !== 'requesting',
    cameraError,
    startupState,
    calibrationTargetLabel: calibrationTarget.label,
    calibrationBanner,
    showAlignmentGuidance,
    alignmentActionAvailable:
      state.entry === 'live' &&
      !manualMode &&
      !isMobileAlignmentFocusActive &&
      canFixAlignment,
    manualMode,
  })
  const desktopCameraActionDisabled =
    isPending ||
    (state.camera === 'granted' && cameraStreamActive) ||
    state.entry === 'demo'
  const desktopMotionActionDisabled =
    isPending || state.entry === 'demo' || state.orientation === 'granted'
  const canOpenDesktopAlignment =
    state.entry === 'live' &&
    !manualMode &&
    !isMobileAlignmentFocusActive &&
    canFixAlignment
  const desktopAlignActionStatus = manualMode
    ? 'Motion required'
    : alignmentBadgeValue(state, cameraPose, startupState)
  const handleSharedBannerAction = (
    actionId?: ViewerBannerActionId,
    context?: {
      opener?: HTMLElement | null
      surface?: ViewerSurface
    },
  ) => {
    switch (actionId) {
      case 'open-alignment':
        openAlignmentExperience(context)
        break
      case 'recover-motion':
        handlePermissionRecoveryAction()
        break
      case 'retry-camera':
        handleRetryCameraPermission()
        break
      case 'retry-location':
        handleRetryLocation()
        break
      default:
        break
    }
  }
  const desktopStatusSummary = renderedActiveSummaryObject
    ? {
        eyebrow: 'Current focus',
        title: renderedActiveSummaryObject.label,
        body: formatSkyObjectSublabel(renderedActiveSummaryObject),
        rows: getDetailRows(renderedActiveSummaryObject).slice(0, 2),
      }
    : {
        eyebrow: 'Current status',
        title: sharedBannerFeed.primary?.title ?? experience.title,
        body:
          sharedBannerFeed.primary?.body ??
          (state.entry === 'demo'
            ? 'Demo mode is active. Open the viewer only when you need deeper object details or diagnostics.'
            : describeCalibrationStatus({
                startupState,
                cameraPose,
                poseCalibration: viewerSettings.poseCalibration,
                calibrationTarget,
                appliedCalibrationTarget: lastAppliedCalibrationTarget,
              })),
        rows: [
          {
            label: 'Alignment',
            value: alignmentBadgeValue(state, cameraPose, startupState),
          },
          {
            label: 'Camera',
            value: cameraStatusValue,
          },
        ],
      }
  const sharedPrimaryBanner = sharedBannerFeed.primary
  const desktopPrimaryAction =
    sharedPrimaryBanner?.actionLabel && sharedPrimaryBanner.actionId
    ? {
        kind: sharedPrimaryBanner.actionId,
        eyebrow: 'Next action',
        title: sharedPrimaryBanner.title,
        body: sharedPrimaryBanner.body,
        label: sharedPrimaryBanner.actionLabel,
        onClick:
          sharedPrimaryBanner.actionId === 'open-alignment'
            ? ((event) =>
                handleSharedBannerAction(sharedPrimaryBanner.actionId, {
                  opener: event.currentTarget,
                  surface: 'desktop',
                })) satisfies MouseEventHandler<HTMLButtonElement>
            : () => handleSharedBannerAction(sharedPrimaryBanner.actionId),
        disabled: sharedPrimaryBanner.actionDisabled,
        tone: sharedPrimaryBanner.critical
          ? 'critical'
          : sharedPrimaryBanner.tone === 'info'
            ? 'info'
            : 'default',
      }
    : canOpenDesktopAlignment
      ? {
          kind: 'open-alignment',
          eyebrow: 'Next action',
          title: alignmentTutorial.primaryStep.title,
          body: alignmentTutorial.primaryStep.body,
          label: alignmentTutorial.primaryStep.ctaLabel ?? 'Open alignment',
          onClick: ((event) =>
            openAlignmentExperience({
              opener: event.currentTarget,
              surface: 'desktop',
            })) satisfies MouseEventHandler<HTMLButtonElement>,
          disabled: false,
          tone: 'success',
        }
      : !isDesktopViewerPanelOpen
        ? {
            kind: 'open-viewer',
            eyebrow: 'Next action',
            title: 'Open the viewer details',
            body: 'Inspect the current crosshair object, selected target, and fallback state without covering the stage.',
            label: 'Open viewer',
            onClick: () => setIsDesktopViewerPanelOpen(true),
            disabled: false,
            tone: 'default',
          }
        : !desktopCameraActionDisabled
          ? {
              kind: 'retry-camera',
              eyebrow: 'Next action',
              title: 'Enable the live camera feed',
              body: 'Retry the rear camera so the viewer can move beyond the fallback sky background.',
              label: 'Enable camera',
              onClick: handleDesktopCameraAction,
              disabled: false,
              tone: 'default',
            }
          : !desktopMotionActionDisabled
            ? {
                kind: 'recover-motion',
                eyebrow: 'Next action',
                title: 'Enable motion tracking',
                body: 'Retry motion so the viewer can lock labels instead of staying in manual pan.',
                label: 'Enable motion',
                onClick: handleDesktopMotionAction,
                disabled: false,
                tone: 'default',
              }
            : null

  const handleStagePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!manualMode) {
      return
    }

    if (
      event.target instanceof HTMLElement &&
      event.target.closest('button') &&
      event.target !== event.currentTarget
    ) {
      return
    }

    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleStagePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const activeDrag = dragRef.current

    if (!manualMode || !activeDrag || activeDrag.pointerId !== event.pointerId) {
      return
    }

    const deltaX = event.clientX - activeDrag.clientX
    const deltaY = event.clientY - activeDrag.clientY

    if (Math.abs(deltaX) > 0 || Math.abs(deltaY) > 0) {
      dragRef.current = {
        ...activeDrag,
        clientX: event.clientX,
        clientY: event.clientY,
        moved: activeDrag.moved || Math.abs(deltaX) + Math.abs(deltaY) > 2,
      }
      setManualPoseState((current) => applyManualPoseDrag(current, deltaX, deltaY))
    }
  }

  const handleStagePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const activeDrag = dragRef.current

    if (!manualMode || !activeDrag || activeDrag.pointerId !== event.pointerId) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (!activeDrag.moved) {
      const now = getCurrentTimestampMs()

      if (now - lastTapAtRef.current <= 280) {
        setManualPoseState(recenterManualPose())
        lastTapAtRef.current = 0
      } else {
        lastTapAtRef.current = now
      }
    }

    dragRef.current = null
  }

  const handleStagePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null
    }
  }

  const handleStageKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!manualMode) {
      return
    }

    if (event.key === 'r' || event.key === 'R' || event.key === 'Home') {
      event.preventDefault()
      recenter()
      return
    }

    const deltasByKey: Partial<Record<string, { x: number; y: number }>> = {
      ArrowLeft: { x: -28, y: 0 },
      ArrowRight: { x: 28, y: 0 },
      ArrowUp: { x: 0, y: -28 },
      ArrowDown: { x: 0, y: 28 },
    }
    const delta = deltasByKey[event.key]

    if (!delta) {
      return
    }

    event.preventDefault()
    setManualPoseState((current) => applyManualPoseDrag(current, delta.x, delta.y))
  }

  function handleDesktopCameraAction() {
    if (state.entry === 'demo' || state.camera === 'granted') {
      return
    }

    if (permissionRecoveryAction.kind === 'camera-and-motion') {
      handleRetryPermissions()
      return
    }

    handleRetryCameraPermission()
  }

  function handleDesktopMotionAction() {
    if (state.entry === 'demo' || state.orientation === 'granted') {
      return
    }

    if (permissionRecoveryAction.kind === 'camera-and-motion') {
      handleRetryPermissions()
      return
    }

    handleRetryMotionPermission()
  }

  return (
    <main
      className={`relative min-h-screen text-sky-50 ${
        shouldLockViewerScroll ? 'overflow-hidden' : 'overflow-x-hidden'
      }`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_28%)]" />
      <div
        className={
          showGradientBackground
            ? 'gradient-fallback absolute inset-0'
            : 'absolute inset-0 bg-[linear-gradient(180deg,rgba(3,7,13,0.08),rgba(3,7,13,0.42)),radial-gradient(circle_at_top,rgba(54,110,140,0.16),transparent_35%)]'
        }
      />
      <div
        ref={handleStageRef}
        className="absolute inset-0 touch-none"
        data-frame-token={renderFrameToken}
        tabIndex={manualMode ? 0 : -1}
        aria-label="Sky viewer stage"
        onPointerDown={handleStagePointerDown}
        onPointerMove={handleStagePointerMove}
        onPointerUp={handleStagePointerUp}
        onPointerCancel={handleStagePointerCancel}
        onKeyDown={handleStageKeyDown}
      >
        {shouldMountVideoElement ? (
          <video
            ref={handleVideoRef}
            className={`absolute inset-0 h-full w-full object-cover ${
              prefersReducedMotion ? '' : 'transition-opacity'
            } ${
              cameraStreamActive ? 'opacity-100' : 'opacity-0'
            }`}
            autoPlay
            muted
            playsInline
          />
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,27,40,0.1),rgba(12,27,40,0.55))]" />
        <div className="sky-grid opacity-60" />
        {showGradientBackground ? (
          <div className="absolute inset-x-0 top-24 flex justify-center px-4">
            <div className="rounded-full border border-sky-100/10 bg-slate-950/45 px-4 py-2 text-xs uppercase tracking-[0.16em] text-sky-100/75">
              {state.entry === 'demo'
                ? 'Demo backdrop active'
                : cameraStreamActive
                  ? 'Rear camera active'
                  : 'Rear camera unavailable'}
            </div>
          </div>
        ) : null}
        {isMobileAlignmentFocusActive ? (
          <div
            className="pointer-events-none absolute inset-x-0 top-24 z-20 flex justify-center px-4"
            data-testid="alignment-focus-instruction"
          >
            <div className="rounded-full border border-emerald-300/20 bg-slate-950/58 px-4 py-2 text-center text-xs font-medium uppercase tracking-[0.16em] text-emerald-100/80 shadow-[0_16px_36px_rgba(3,7,13,0.24)] backdrop-blur">
              {alignmentFocusPrompt}
            </div>
          </div>
        ) : null}
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {focusedAircraftTrails.map((trail) => (
            <polyline
              key={trail.id}
              data-testid="aircraft-trail"
              data-object-id={trail.id}
              points={trail.points.join(' ')}
              fill="none"
              stroke="rgba(56, 189, 248, 0.5)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {renderMotionAffordance(activeMotionAffordance, activeMotionAffordanceKind)}
          {renderedLineSegments.map((segment, index) => (
            <line
              key={`${segment.constellationId}-${index}`}
              x1={segment.start.x}
              y1={segment.start.y}
              x2={segment.end.x}
              y2={segment.end.y}
              stroke="rgba(186, 230, 253, 0.42)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          ))}
        </svg>
        {viewerSettings.labelDisplayMode === 'top_list' && renderedTopListObjects.length > 0 ? (
          <div className="pointer-events-none absolute inset-x-4 top-24 z-20 flex justify-center px-2">
            <div
              className="flex max-w-4xl flex-wrap justify-center gap-2 rounded-[1.5rem] border border-sky-100/10 bg-slate-950/58 px-3 py-3 shadow-[0_16px_36px_rgba(3,7,13,0.24)] backdrop-blur"
              data-testid="sky-object-top-list"
            >
              {renderedTopListObjects.map((object) => (
                <div
                  key={object.id}
                  data-testid="sky-object-top-list-item"
                className={`rounded-full border px-3 py-1 text-xs ${
                    object.id === selectedObject?.id || object.id === wideSceneCenterLockedObject?.id
                      ? 'border-amber-200/60 bg-amber-200/16 text-amber-50'
                      : 'border-sky-100/10 bg-white/5 text-sky-50'
                  }`}
                >
                  {object.label}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {renderedMarkerObjects.map((object) => {
          const markerSizePx = getMarkerSizePx(
            object,
            viewerSettings.verticalFovAdjustmentDeg,
            viewerSettings.markerScale,
          )

          return (
            <button
              key={object.id}
              type="button"
              onClick={() => {
                setSelectedObjectId((current) => (current === object.id ? null : object.id))
                setIsDesktopViewerPanelOpen(true)
              }}
              onPointerEnter={() => {
                setHoveredObjectId(object.id)
              }}
              onPointerLeave={() => {
                setHoveredObjectId((current) => (current === object.id ? null : current))
              }}
              aria-label={`${object.label} ${formatSkyObjectSublabel(object)}`}
              aria-pressed={selectedObject?.id === object.id}
              data-testid="sky-object-marker"
              data-object-id={object.id}
              className={`absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full ${
                prefersReducedMotion ? '' : 'transition'
              }`}
              style={{
                left: `${object.projection.x}px`,
                top: `${object.projection.y}px`,
                opacity: getObjectMotionOpacity(object),
              }}
            >
              <span className="sr-only">
                {object.label} {formatSkyObjectSublabel(object)}
              </span>
              <span
                className={`block ${getMarkerVisualClassName(object, {
                  centerLockedObjectId: wideSceneCenterLockedObject?.id ?? null,
                  selectedObjectId,
                })}`}
                style={{
                  width: `${markerSizePx}px`,
                  height: `${markerSizePx}px`,
                }}
              />
            </button>
          )
        })}
        {renderedOnObjectLabels.map((object) => (
          <div
            key={object.object.id}
            data-testid="sky-object-label"
            data-object-id={object.object.id}
            className={`pointer-events-none absolute rounded-2xl border px-3 py-2 text-left text-xs shadow-[0_12px_30px_rgba(3,7,13,0.22)] ${
              object.object.id === selectedObject?.id || object.object.id === wideSceneCenterLockedObject?.id
                ? 'border-amber-200/70 bg-slate-950/82 text-amber-50'
                : 'border-sky-100/18 bg-slate-950/72 text-sky-50'
            }`}
            style={{
              left: `${object.rect.left}px`,
              top: `${object.rect.top}px`,
              width: `${object.rect.width}px`,
              height: `${object.rect.height}px`,
              opacity: getObjectMotionOpacity(object.object),
            }}
          >
            <span className="block truncate font-semibold">{object.object.label}</span>
            <span className="block truncate text-[11px] text-sky-100/75">
              {formatSkyObjectSublabel(object.object)}
            </span>
          </div>
        ))}
        {hasMounted && scopeModeActive ? (
          <ScopeLensOverlay
            diameterPx={scopeLensDiameterPx}
            lensVisualScale={scopeLensVisualScale}
            showGradientBackground={showGradientBackground}
            cameraStream={cameraStreamRef.current}
            cameraStreamActive={cameraStreamActive}
            stars={scopeStarCanvasPoints}
            objects={scopeLensObjects}
          />
        ) : null}
        <div
          className={`absolute inset-0 flex items-center justify-center ${
            isMobileAlignmentFocusActive ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        >
          {isMobileAlignmentFocusActive ? (
            <button
              type="button"
              onClick={alignCalibrationTarget}
              disabled={!canAlignCalibration}
              aria-label={`Align to ${calibrationTarget.label} using the center crosshair`}
              data-testid="alignment-crosshair-button"
              className="relative flex h-16 w-16 items-center justify-center rounded-full disabled:cursor-not-allowed"
            >
              <span className="sr-only">{alignmentFocusPrompt}</span>
              <span className="relative h-16 w-16 rounded-full border border-emerald-300/35 bg-emerald-300/6">
                <span className="absolute inset-x-1/2 top-2 h-12 w-px -translate-x-1/2 bg-emerald-200/55" />
                <span className="absolute inset-y-1/2 left-2 h-px w-12 -translate-y-1/2 bg-emerald-200/55" />
              </span>
            </button>
          ) : (
            <div className="relative h-16 w-16 rounded-full border border-sky-100/40">
              <div className="absolute inset-x-1/2 top-2 h-12 w-px -translate-x-1/2 bg-sky-50/80" />
              <div className="absolute inset-y-1/2 left-2 h-px w-12 -translate-y-1/2 bg-sky-50/80" />
            </div>
          )}
        </div>
        {viewerSettings.labelDisplayMode === 'center_only' && renderedCenterLockedObject ? (
          <div className="pointer-events-none absolute inset-x-4 inset-y-1/2 z-20 flex -translate-y-[calc(50%_-_4.5rem)] justify-center">
            <div
              data-testid="center-lock-chip"
              className="rounded-full border border-amber-200/55 bg-slate-950/78 px-4 py-2 text-center shadow-[0_12px_30px_rgba(3,7,13,0.24)]"
            >
              <p className="text-sm font-semibold text-amber-50">
                {renderedCenterLockedObject.label}
              </p>
              <p className="text-[11px] uppercase tracking-[0.16em] text-amber-100/75">
                {formatSkyObjectSublabel(renderedCenterLockedObject)}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none relative z-10 flex min-h-screen flex-col justify-between px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
        <div className="flex flex-col gap-3">
          {sharedBannerFeed.primary ? (
            <section
              className="pointer-events-auto mx-auto hidden w-full max-w-4xl flex-col gap-2 sm:flex"
              data-testid="viewer-top-warning-stack"
            >
              <CompactTopBanner
                title={sharedBannerFeed.primary.title}
                body={sharedBannerFeed.primary.body}
                critical={sharedBannerFeed.primary.critical}
                tone={sharedBannerFeed.primary.tone}
                actionLabel={sharedBannerFeed.primary.actionLabel}
                onAction={
                  sharedBannerFeed.primary.actionId
                    ? (event) =>
                        handleSharedBannerAction(sharedBannerFeed.primary?.actionId, {
                          opener: event.currentTarget,
                          surface: 'desktop',
                        })
                    : undefined
                }
                actionDisabled={sharedBannerFeed.primary.actionDisabled}
                footer={sharedBannerFeed.primary.footer}
              />
              {sharedBannerFeed.compactNotice ? (
                <CompactPersistentNotice
                  testId="desktop-compact-motion-warning"
                  title={sharedBannerFeed.compactNotice.title}
                  body={sharedBannerFeed.compactNotice.body}
                />
              ) : null}
              {sharedBannerFeed.overflow.length > 0 ? (
                <BannerOverflowDisclosure
                  banners={sharedBannerFeed.overflow}
                  variant="desktop"
                  onAction={handleSharedBannerAction}
                />
              ) : null}
            </section>
          ) : null}

          <header
            className="mx-auto hidden w-full max-w-5xl sm:block"
            data-testid="desktop-viewer-header"
          >
            <div className="pointer-events-auto shell-panel rounded-[1.6rem] px-4 py-4 sm:px-5">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)]">
                <section
                  className="rounded-[1.2rem] border border-sky-100/10 bg-white/5 px-4 py-4"
                  data-testid="desktop-active-object-summary"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-sky-200/55">
                        SkyLens
                      </p>
                      <p className="text-xs uppercase tracking-[0.2em] text-sky-200/60">
                        {desktopStatusSummary.eyebrow}
                      </p>
                      <p className="mt-2 text-base font-semibold text-white">
                        {desktopStatusSummary.title}
                      </p>
                    </div>
                    <div className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100/85">
                      {alignmentBadgeValue(state, cameraPose, startupState)}
                    </div>
                  </div>
                  {renderedActiveSummaryObject ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {renderObjectBadges(renderedActiveSummaryObject)}
                    </div>
                  ) : null}
                  <p className="mt-2 text-sm leading-6 text-sky-100/78">{desktopStatusSummary.body}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {desktopStatusSummary.rows.map((row) => (
                      <div
                        key={`${desktopStatusSummary.title}-${row.label}`}
                        className="rounded-full border border-sky-100/10 bg-slate-950/35 px-3 py-2"
                      >
                        <p className="text-[10px] uppercase tracking-[0.16em] text-sky-200/55">
                          {row.label}
                        </p>
                        <p className="mt-1 text-sm text-white">{row.value}</p>
                      </div>
                    ))}
                  </div>
                </section>
                <section
                  className="rounded-[1.2rem] border border-sky-100/10 bg-slate-950/38 px-4 py-4"
                  data-testid="desktop-next-action"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-sky-200/60">
                        {desktopPrimaryAction?.eyebrow ?? 'Viewer controls'}
                      </p>
                      <p className="mt-2 text-base font-semibold text-white">
                        {desktopPrimaryAction?.title ?? 'Viewer ready'}
                      </p>
                    </div>
                    <SettingsSheet {...desktopSettingsSheetProps} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-sky-100/78">
                    {desktopPrimaryAction?.body ??
                      'Use the compact controls below when you need deeper diagnostics, permissions recovery, or settings changes.'}
                  </p>
                  {desktopPrimaryAction ? (
                    <button
                      type="button"
                      onClick={desktopPrimaryAction.onClick}
                      disabled={desktopPrimaryAction.disabled}
                      data-testid={
                        desktopPrimaryAction.kind === 'open-viewer'
                          ? 'desktop-open-viewer-action'
                          : 'desktop-primary-next-action'
                      }
                      className={`mt-4 inline-flex min-h-11 items-center justify-center rounded-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
                        desktopPrimaryAction.tone === 'critical'
                          ? 'bg-rose-400/90 text-rose-950'
                          : desktopPrimaryAction.tone === 'info'
                            ? 'bg-sky-300 text-slate-950'
                            : desktopPrimaryAction.tone === 'success'
                              ? 'bg-emerald-300 text-slate-950'
                              : 'bg-amber-300 text-slate-950'
                      }`}
                    >
                      {desktopPrimaryAction.label}
                    </button>
                  ) : null}
                  <div
                    className="mt-4 flex flex-wrap items-center gap-2"
                    data-testid="desktop-viewer-actions"
                  >
                    {desktopPrimaryAction?.kind !== 'open-viewer' ? (
                      <DesktopActionButton
                        label={isDesktopViewerPanelOpen ? 'Hide viewer' : 'Open viewer'}
                        status={
                          isDesktopViewerPanelOpen
                            ? 'Viewer open'
                            : renderedActiveSummaryObject?.label ?? 'Details'
                        }
                        onClick={() =>
                          setIsDesktopViewerPanelOpen((current) => !current)
                        }
                        dataTestId="desktop-open-viewer-action"
                      />
                    ) : null}
                    {desktopPrimaryAction?.kind !== 'retry-camera' ? (
                      <DesktopActionButton
                        label="Enable camera"
                        status={cameraStatusValue}
                        onClick={handleDesktopCameraAction}
                        disabled={desktopCameraActionDisabled}
                        dataTestId="desktop-camera-action"
                      />
                    ) : null}
                    {desktopPrimaryAction?.kind !== 'recover-motion' ? (
                      <DesktopActionButton
                        label="Motion"
                        status={motionStatusValue}
                        onClick={handleDesktopMotionAction}
                        disabled={desktopMotionActionDisabled}
                        dataTestId="desktop-motion-action"
                      />
                    ) : null}
                    {scopeControlsAvailable ? (
                      <DesktopActionButton
                        label="Scope"
                        status={formatScopeActionStatus(
                          hydratedScopeEnabled,
                          hydratedScopeVerticalFovDeg,
                        )}
                        onClick={() =>
                          setViewerSettings((current) => ({
                            ...current,
                            scopeModeEnabled: !current.scopeModeEnabled,
                          }))
                        }
                        pressed={hydratedScopeEnabled}
                        dataTestId="desktop-scope-action"
                      />
                    ) : null}
                    {desktopPrimaryAction?.kind !== 'open-alignment' ? (
                      <DesktopActionButton
                        label="Align"
                        status={desktopAlignActionStatus}
                        onClick={(event) =>
                          openAlignmentExperience({
                            opener: event.currentTarget,
                            surface: 'desktop',
                          })
                        }
                        disabled={!canOpenDesktopAlignment}
                        dataTestId="desktop-align-action"
                      />
                    ) : null}
                  </div>
                  {scopeControlsAvailable && hydratedScopeEnabled ? (
                    <div
                      className="mt-4 grid gap-3 sm:grid-cols-2"
                      data-testid="desktop-scope-quick-controls"
                    >
                      <QuickRangeSlider
                        label="Scope aperture"
                        value={viewerSettings.scopeOptics.apertureMm}
                        suffix=" mm"
                        min={SCOPE_OPTICS_RANGES.apertureMm.min}
                        max={SCOPE_OPTICS_RANGES.apertureMm.max}
                        step={SCOPE_OPTICS_RANGES.apertureMm.step}
                        valueTestId="desktop-scope-aperture-value"
                        sliderTestId="desktop-scope-aperture-slider"
                        onChange={(value) =>
                          setViewerSettings((current) => ({
                            ...current,
                            scopeOptics: {
                              ...current.scopeOptics,
                              apertureMm: value,
                            },
                          }))
                        }
                      />
                      <QuickRangeSlider
                        label="Scope magnification"
                        value={viewerSettings.scopeOptics.magnificationX}
                        suffix="x"
                        min={SCOPE_OPTICS_RANGES.magnificationX.min}
                        max={SCOPE_OPTICS_RANGES.magnificationX.max}
                        step={SCOPE_OPTICS_RANGES.magnificationX.step}
                        valueTestId="desktop-scope-magnification-value"
                        sliderTestId="desktop-scope-magnification-slider"
                        onChange={(value) =>
                          setViewerSettings((current) => ({
                            ...current,
                            scopeOptics: {
                              ...current.scopeOptics,
                              magnificationX: value,
                            },
                          }))
                        }
                      />
                    </div>
                  ) : null}
                </section>
              </div>
            </div>
          </header>

          {shouldShowAlignmentInstructions ? (
            <section className="pointer-events-auto mx-auto hidden w-full max-w-5xl sm:block">
              <AlignmentInstructionsPanel
                targetLabel={calibrationTarget.label}
                status={alignmentTutorial.status}
                supportingNotice={alignmentTutorial.supportingNotice}
                primaryStep={alignmentTutorial.primaryStep}
                selectedTarget={alignmentTargetPreference}
                availability={calibrationTargetResolution.availability}
                onSelectTarget={handleAlignmentTargetPreferenceChange}
                onResetCalibration={resetCalibration}
                onFineAdjustCalibration={fineAdjustCalibration}
                canResetCalibration={canResetCalibration}
                onClose={closeAlignmentExperience}
                showStartAlignmentAction={false}
              />
            </section>
          ) : null}

          {isDesktopViewerPanelOpen ? (
            <section
              className="mx-auto hidden w-full max-w-5xl flex-col gap-3 sm:flex"
              data-testid="desktop-viewer-panel"
            >
              {experience.mode === 'blocked' && state.entry !== 'demo' ? (
                <section className="pointer-events-auto shell-panel rounded-[2rem] p-6">
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-200/70">
                    {blockingEyebrow(state, startupState)}
                  </p>
                  <h1
                    className="mt-2 text-2xl font-semibold text-white"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {blockingCopy.title}
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-sky-100/78">
                    {blockingCopy.body}
                  </p>
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    {startupState !== 'unsupported' ? (
                      <button
                        type="button"
                        onClick={handleRetryPermissions}
                        disabled={isPending}
                        className="rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-wait disabled:bg-amber-100"
                      >
                        {isPending
                          ? 'Starting AR...'
                          : startupState === 'ready-to-request'
                            ? 'Start AR'
                            : 'Retry startup'}
                      </button>
                    ) : null}
                    <Link
                      href={createDemoViewerRoute().href}
                      className="rounded-full border border-sky-100/20 px-5 py-3 text-sm font-semibold text-sky-50"
                    >
                      Try demo mode
                    </Link>
                  </div>
                  {retryError ? (
                    <p className="mt-3 text-sm text-amber-200" role="alert">
                      {retryError}
                    </p>
                  ) : null}
                  {startupState === 'unsupported' ? (
                    <p className="mt-3 text-sm text-amber-200">
                      Live AR requires HTTPS or `localhost`, plus camera, geolocation, and motion
                      sensor permissions delegated to this page.
                    </p>
                  ) : null}
                </section>
              ) : (
                <>
                  <section className="pointer-events-auto shell-panel rounded-[1.75rem] p-5">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-sky-200/60">
                          Viewer snapshot
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {renderedActiveSummaryObject
                            ? renderedActiveSummaryObject.label
                            : experience.title}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-sky-100/80">
                          {renderedActiveSummaryObject
                            ? `${renderedActiveSummaryObject.label} is flowing through the normalized ${renderedActiveSummaryObject.type} object contract. Center-lock still uses angular distance from the reticle, not pixel distance.`
                            : `${experience.body} ${visibilityDiagnosticsNote}`}
                        </p>
                      </div>
                      <div className="rounded-[1.25rem] border border-sky-100/10 bg-white/5 px-4 py-3 text-sm text-sky-100/75">
                        <p>Location {locationStatusValue}</p>
                        <p>Camera {cameraStatusValue}</p>
                        <p>Motion {motionStatusValue}</p>
                        <p>Sensor {sensorStatusValue}</p>
                        <p>Yaw {Math.round(cameraPose.yawDeg)}°</p>
                        <p>Pitch {Math.round(cameraPose.pitchDeg)}°</p>
                        <p>
                          FOV {getEffectiveVerticalFovDeg(viewerSettings.verticalFovAdjustmentDeg)}°
                          {' '}vertical
                        </p>
                        <p>Target {calibrationTarget.label}</p>
                        {cameraFrameLayout ? (
                          <p>
                            Frame {cameraFrameLayout.sourceWidth}×{cameraFrameLayout.sourceHeight}
                          </p>
                        ) : null}
                        <p>Visible markers {renderedMarkerObjects.length}</p>
                      </div>
                    </div>
                  </section>
                  <section className="pointer-events-auto shell-panel rounded-[1.75rem] p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-sky-200/60">
                      Crosshair object
                    </p>
                    {renderedCenterLockedObject ? (
                      <div className="mt-3 flex flex-col gap-3 text-sm leading-6 text-sky-50/85">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-base font-semibold text-white">
                              {renderedCenterLockedObject.label}
                            </p>
                            {renderObjectBadges(renderedCenterLockedObject)}
                          </div>
                          <p className="text-sky-100/75">
                            {formatSkyObjectSublabel(renderedCenterLockedObject)}
                          </p>
                        </div>
                        <p className="text-sky-100/70">
                          Angular distance {renderedCenterLockedObject.projection.angularDistanceDeg.toFixed(1)}
                          °
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {getDetailRows(renderedCenterLockedObject).map((row) => (
                            <div
                              key={`${renderedCenterLockedObject.id}-${row.label}`}
                              className="rounded-2xl border border-sky-100/10 bg-white/5 px-4 py-3"
                            >
                              <p className="text-[11px] uppercase tracking-[0.18em] text-sky-200/55">
                                {row.label}
                              </p>
                              <p className="mt-1 text-sm text-white">{row.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm leading-6 text-sky-100/80">
                        Move until an object snaps here.
                      </p>
                    )}
                  </section>
                  {renderedSelectedDetailObject ? (
                    <section className="pointer-events-auto shell-panel rounded-[1.75rem] p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-sky-200/60">
                            {detailObjectHeading}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <p className="text-base font-semibold text-white">
                              {renderedSelectedDetailObject.label}
                            </p>
                            {renderObjectBadges(renderedSelectedDetailObject)}
                          </div>
                          <p className="text-sm text-sky-100/75">
                            {formatSkyObjectSublabel(renderedSelectedDetailObject)}
                          </p>
                        </div>
                        {selectedObject ? (
                          <button
                            type="button"
                            onClick={() => setSelectedObjectId(null)}
                            className="rounded-full border border-sky-100/15 px-3 py-1 text-xs text-sky-50"
                          >
                            Close
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {getDetailRows(renderedSelectedDetailObject).map((row) => (
                          <div
                            key={`${renderedSelectedDetailObject.id}-${row.label}`}
                            className="rounded-2xl border border-sky-100/10 bg-white/5 px-4 py-3"
                          >
                            <p className="text-[11px] uppercase tracking-[0.18em] text-sky-200/55">
                              {row.label}
                            </p>
                            <p className="mt-1 text-sm text-white">{row.value}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}
                  {manualObserverPanel}
                  <DevelopmentOrientationDiagnostics
                    sample={latestOrientationSample}
                    sampleAgeMs={orientationSampleAgeMs}
                    sampleRateHz={orientationSampleRateHz}
                    poseCalibration={viewerSettings.poseCalibration}
                    orientationUpgradedFromRelative={orientationUpgradedFromRelative}
                  />
                  <section className="pointer-events-auto shell-panel rounded-[1.75rem] p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-sky-200/60">
                      Privacy reassurance
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {PRIVACY_REASSURANCE_COPY.map((copy) => (
                        <p
                          key={copy}
                          className="rounded-2xl border border-sky-100/10 bg-white/5 px-4 py-3 text-sm leading-6 text-sky-50/85"
                        >
                          {copy}
                        </p>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </section>
          ) : null}
        </div>
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:hidden">
        {shouldShowAlignmentInstructions ? (
          <CompactMobilePanelShell
            ref={mobileAlignmentOverlayPanelRef}
            shellTestId="mobile-alignment-overlay-shell"
            shellClassName="pointer-events-auto z-40"
            shellChildren={
              <button
                type="button"
                aria-label="Close alignment instructions"
                data-testid="mobile-alignment-overlay-backdrop"
                onClick={closeAlignmentExperience}
                className="absolute inset-0 bg-slate-950/45"
              />
            }
            panelTestId="mobile-alignment-overlay-panel"
            panelClassName="pointer-events-auto"
            panelProps={{
              role: 'dialog',
              'aria-modal': 'true',
              'aria-label': 'Alignment instructions',
              tabIndex: -1,
              onKeyDown: handleMobileAlignmentOverlayKeyDown,
            }}
            scrollRegionTestId="mobile-alignment-overlay-scroll-region"
          >
            <div className="grid gap-3 pb-1 pr-1" data-testid="alignment-instructions-panel">
              <AlignmentInstructionsContent
                {...mobileAlignmentPanelProps}
                compact
                closeButtonRef={mobileAlignmentOverlayCloseButtonRef}
              />
            </div>
          </CompactMobilePanelShell>
        ) : null}
        {isMobileOverlayOpen && !isMobileAlignmentFocusActive ? (
          <CompactMobilePanelShell
            ref={mobileViewerOverlayPanelRef}
            shellTestId="mobile-viewer-overlay-shell"
            shellClassName="pointer-events-auto z-30"
            shellChildren={
              <button
                type="button"
                aria-label="Close viewer overlay"
                data-testid="mobile-viewer-overlay-backdrop"
                onClick={closeMobileViewerOverlay}
                className="absolute inset-0 bg-slate-950/45"
              />
            }
            panelTestId="mobile-viewer-overlay"
            panelProps={{
              id: 'mobile-viewer-overlay',
              role: 'dialog',
              'aria-modal': 'true',
              'aria-label': 'Viewer details',
              tabIndex: -1,
              onClick: (event) => event.stopPropagation(),
              onKeyDown: handleMobileViewerOverlayKeyDown,
            }}
            header={
              <div className="mb-3 flex items-start justify-between gap-3">
                <div
                  className="min-w-0 rounded-[1.25rem] border border-sky-100/10 bg-white/5 px-4 py-3"
                  data-testid="mobile-viewer-header"
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.2em] text-sky-200/65">
                        SkyLens
                      </p>
                      <p className="truncate text-sm text-sky-50/90">{experience.title}</p>
                    </div>
                    <div className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100/85">
                      {alignmentBadgeValue(state, cameraPose, startupState)}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-start gap-2">
                  <div>
                    <SettingsSheet {...mobileSettingsSheetProps} />
                  </div>
                  <button
                    ref={mobileViewerOverlayCloseButtonRef}
                    type="button"
                    onClick={closeMobileViewerOverlay}
                    className="min-h-11 rounded-full border border-sky-100/15 px-3 py-1 text-xs text-sky-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            }
            scrollRegionTestId={
              shouldUseCompactNonScrollingOverlay
                ? 'mobile-viewer-overlay-compact-content'
                : 'mobile-viewer-overlay-scroll-region'
            }
          >
            <div className={`grid gap-3 ${shouldUseCompactNonScrollingOverlay ? 'pb-1 pr-1' : ''}`}>
              <div className="flex flex-wrap gap-2">
                <StatusBadge label="Location" value={locationStatusValue} />
                <StatusBadge label="Camera" value={cameraStatusValue} />
                <StatusBadge label="Motion" value={motionStatusValue} />
                <StatusBadge label="Sensor" value={sensorStatusValue} />
              </div>
              {sharedBannerFeed.primary ? (
                <div className="grid gap-2">
                  <FallbackBanner
                    title={sharedBannerFeed.primary.title}
                    body={sharedBannerFeed.primary.body}
                    critical={sharedBannerFeed.primary.critical}
                    tone={sharedBannerFeed.primary.tone}
                    actionLabel={sharedBannerFeed.primary.actionLabel}
                    onAction={
                      sharedBannerFeed.primary.actionId
                        ? () =>
                            handleSharedBannerAction(sharedBannerFeed.primary!.actionId, {
                              surface: 'mobile',
                            })
                        : undefined
                    }
                    actionDisabled={sharedBannerFeed.primary.actionDisabled}
                    footer={sharedBannerFeed.primary.footer}
                  />
                  {sharedBannerFeed.compactNotice ? (
                    <CompactPersistentNotice
                      testId="mobile-compact-motion-warning"
                      title={sharedBannerFeed.compactNotice.title}
                      body={sharedBannerFeed.compactNotice.body}
                    />
                  ) : null}
                  {sharedBannerFeed.overflow.length > 0 ? (
                    <BannerOverflowDisclosure
                      banners={sharedBannerFeed.overflow}
                      variant="mobile"
                      onAction={handleSharedBannerAction}
                    />
                  ) : null}
                </div>
              ) : null}
              {shouldUseCompactNonScrollingOverlay ? (
                <>
                  <DevelopmentOrientationDiagnostics
                    sample={latestOrientationSample}
                    sampleAgeMs={orientationSampleAgeMs}
                    sampleRateHz={orientationSampleRateHz}
                    poseCalibration={viewerSettings.poseCalibration}
                    orientationUpgradedFromRelative={orientationUpgradedFromRelative}
                  />
                  <section className="rounded-[1.25rem] border border-sky-100/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-sky-200/60">
                      Viewer snapshot
                    </p>
                    <div className="mt-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-white">
                          {renderedActiveSummaryObject
                            ? renderedActiveSummaryObject.label
                            : experience.title}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-sky-100/80">
                          {renderedCenterLockedObject
                            ? `${renderedCenterLockedObject.label} is nearest the center crosshair.`
                            : visibilityDiagnosticsNote}
                        </p>
                      </div>
                      <div className="rounded-full border border-sky-100/10 bg-slate-950/35 px-3 py-1 text-xs text-sky-100/75">
                        Target {calibrationTarget.label}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-sky-100/75">
                      <div className="rounded-2xl border border-sky-100/10 bg-slate-950/35 px-4 py-3">
                        Yaw {Math.round(cameraPose.yawDeg)}°
                      </div>
                      <div className="rounded-2xl border border-sky-100/10 bg-slate-950/35 px-4 py-3">
                        Pitch {Math.round(cameraPose.pitchDeg)}°
                      </div>
                      <div className="rounded-2xl border border-sky-100/10 bg-slate-950/35 px-4 py-3">
                        FOV {getEffectiveVerticalFovDeg(viewerSettings.verticalFovAdjustmentDeg)}°
                      </div>
                      <div className="rounded-2xl border border-sky-100/10 bg-slate-950/35 px-4 py-3">
                        Visible markers {renderedMarkerObjects.length}
                      </div>
                    </div>
                  </section>
                </>
              ) : (
                <>
                  {experience.mode === 'blocked' && state.entry !== 'demo' ? (
                    <section className="rounded-[1.25rem] border border-sky-100/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-amber-200/70">
                        {blockingEyebrow(state, startupState)}
                      </p>
                      <h2 className="mt-2 text-lg font-semibold text-white">
                        {blockingCopy.title}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-sky-100/80">{blockingCopy.body}</p>
                      <div className="mt-4 flex flex-col gap-2">
                        {startupState !== 'unsupported' ? (
                          <button
                            type="button"
                            onClick={handleRetryPermissions}
                            disabled={isPending}
                            className="rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-wait disabled:bg-amber-100"
                          >
                            {isPending
                              ? 'Starting AR...'
                              : startupState === 'ready-to-request'
                                ? 'Start AR'
                                : 'Retry startup'}
                          </button>
                        ) : null}
                        <Link
                          href={createDemoViewerRoute().href}
                          className="rounded-full border border-sky-100/20 px-4 py-2 text-center text-sm font-semibold text-sky-50"
                        >
                          Try demo mode
                        </Link>
                      </div>
                      {retryError ? (
                        <p className="mt-3 text-sm text-amber-200" role="alert">
                          {retryError}
                        </p>
                      ) : null}
                      {startupState === 'unsupported' ? (
                        <p className="mt-3 text-sm text-amber-200">
                          Live AR requires HTTPS or `localhost` plus delegated camera,
                          geolocation, and sensor permissions.
                        </p>
                      ) : null}
                    </section>
                  ) : (
                    <>
                      {manualObserverPanel}
                      <DevelopmentOrientationDiagnostics
                        sample={latestOrientationSample}
                        sampleAgeMs={orientationSampleAgeMs}
                        sampleRateHz={orientationSampleRateHz}
                        poseCalibration={viewerSettings.poseCalibration}
                        orientationUpgradedFromRelative={orientationUpgradedFromRelative}
                      />
                      <section className="rounded-[1.25rem] border border-sky-100/10 bg-white/5 p-4">
                        <div className="flex flex-col gap-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-sky-200/60">
                              Celestial layer
                            </p>
                            <h2 className="mt-2 text-lg font-semibold text-white">
                              {renderedActiveSummaryObject
                                ? renderedActiveSummaryObject.label
                                : experience.title}
                            </h2>
                            <p className="mt-2 text-sm leading-6 text-sky-100/80">
                              {renderedActiveSummaryObject
                                ? `${renderedActiveSummaryObject.label} is flowing through the normalized ${renderedActiveSummaryObject.type} object contract. Center-lock still uses angular distance from the reticle, not pixel distance.`
                                : `${experience.body} ${visibilityDiagnosticsNote}`}
                            </p>
                          </div>
                          <div className="rounded-[1rem] border border-sky-100/10 bg-slate-950/35 px-4 py-3 text-sm text-sky-100/75">
                            <p>Yaw {Math.round(cameraPose.yawDeg)}°</p>
                            <p>Pitch {Math.round(cameraPose.pitchDeg)}°</p>
                            <p>
                              FOV {getEffectiveVerticalFovDeg(viewerSettings.verticalFovAdjustmentDeg)}
                              ° vertical
                            </p>
                            <p>Sensor {sensorStatusValue}</p>
                            <p>Target {calibrationTarget.label}</p>
                            {cameraFrameLayout ? (
                              <p>
                                Frame {cameraFrameLayout.sourceWidth}×{cameraFrameLayout.sourceHeight}
                              </p>
                            ) : null}
                            <p>Visible markers {renderedMarkerObjects.length}</p>
                          </div>
                        </div>
                      </section>
                      <section className="rounded-[1.25rem] border border-sky-100/10 bg-white/5 p-4 text-sm text-sky-50/85">
                        {renderedCenterLockedObject ? (
                          <>
                            <p className="text-xs uppercase tracking-[0.2em] text-sky-200/60">
                              Center object
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              <p className="text-base font-semibold text-white">
                                {renderedCenterLockedObject.label}
                              </p>
                              {renderObjectBadges(renderedCenterLockedObject)}
                            </div>
                            <p className="text-sky-100/75">
                              {formatSkyObjectSublabel(renderedCenterLockedObject)}
                            </p>
                            <p className="mt-2 text-sky-100/70">
                              Angular distance{' '}
                              {renderedCenterLockedObject.projection.angularDistanceDeg.toFixed(1)}°
                            </p>
                          </>
                        ) : (
                          <p className="text-sm leading-6 text-sky-100/80">
                            Move until an object snaps here.
                          </p>
                        )}
                      </section>
                      {renderedSelectedDetailObject ? (
                        <section className="rounded-[1.25rem] border border-sky-100/10 bg-white/5 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.2em] text-sky-200/60">
                                Selected object
                              </p>
                              <div className="mt-2 flex items-center gap-2">
                                <p className="text-base font-semibold text-white">
                                  {renderedSelectedDetailObject.label}
                                </p>
                                {renderObjectBadges(renderedSelectedDetailObject)}
                              </div>
                              <p className="text-sm text-sky-100/75">
                                {formatSkyObjectSublabel(renderedSelectedDetailObject)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedObjectId(null)}
                              className="rounded-full border border-sky-100/15 px-3 py-1 text-xs text-sky-50"
                            >
                              Close
                            </button>
                          </div>
                          <div className="mt-3 grid gap-2">
                            {getDetailRows(renderedSelectedDetailObject).map((row) => (
                              <div
                                key={`${renderedSelectedDetailObject.id}-${row.label}`}
                                className="rounded-2xl border border-sky-100/10 bg-slate-950/35 px-4 py-3"
                              >
                                <p className="text-[11px] uppercase tracking-[0.18em] text-sky-200/55">
                                  {row.label}
                                </p>
                                <p className="mt-1 text-sm text-white">{row.value}</p>
                              </div>
                            ))}
                          </div>
                        </section>
                      ) : null}
                    </>
                  )}
                  <section className="rounded-[1.25rem] border border-sky-100/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-sky-200/60">
                      Privacy reassurance
                    </p>
                    <div className="mt-3 grid gap-3">
                      {PRIVACY_REASSURANCE_COPY.map((copy) => (
                        <p
                          key={copy}
                          className="rounded-2xl border border-sky-100/10 bg-slate-950/35 px-4 py-3 text-sm leading-6 text-sky-50/85"
                        >
                          {copy}
                        </p>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </div>
          </CompactMobilePanelShell>
        ) : (
          <>
            <div className="grid justify-center gap-3" data-testid="mobile-viewer-quick-actions">
              {!isMobileAlignmentFocusActive && hydratedScopeEnabled ? (
                <div
                  className="grid gap-3"
                  data-testid="mobile-scope-quick-controls"
                >
                  <QuickRangeSlider
                    label="Scope aperture"
                    value={viewerSettings.scopeOptics.apertureMm}
                    suffix=" mm"
                    min={SCOPE_OPTICS_RANGES.apertureMm.min}
                    max={SCOPE_OPTICS_RANGES.apertureMm.max}
                    step={SCOPE_OPTICS_RANGES.apertureMm.step}
                    valueTestId="mobile-scope-aperture-value"
                    sliderTestId="mobile-scope-aperture-slider"
                    onChange={(value) =>
                      setViewerSettings((current) => ({
                        ...current,
                        scopeOptics: {
                          ...current.scopeOptics,
                          apertureMm: value,
                        },
                      }))
                    }
                  />
                  <QuickRangeSlider
                    label="Scope magnification"
                    value={viewerSettings.scopeOptics.magnificationX}
                    suffix="x"
                    min={SCOPE_OPTICS_RANGES.magnificationX.min}
                    max={SCOPE_OPTICS_RANGES.magnificationX.max}
                    step={SCOPE_OPTICS_RANGES.magnificationX.step}
                    valueTestId="mobile-scope-magnification-value"
                    sliderTestId="mobile-scope-magnification-slider"
                    onChange={(value) =>
                      setViewerSettings((current) => ({
                        ...current,
                        scopeOptics: {
                          ...current.scopeOptics,
                          magnificationX: value,
                        },
                      }))
                    }
                  />
                </div>
              ) : null}
              <div className="pointer-events-auto flex flex-wrap justify-center gap-2">
                {!isMobileAlignmentFocusActive ? (
                  <button
                    ref={mobileViewerOverlayTriggerRef}
                    type="button"
                    onClick={openMobileViewerOverlay}
                    aria-controls="mobile-viewer-overlay"
                    aria-expanded={isMobileOverlayOpen}
                    data-testid="mobile-viewer-overlay-trigger"
                    className="min-h-11 rounded-full border border-sky-100/15 bg-slate-950/70 px-5 py-3 text-sm font-semibold text-sky-50 shadow-[0_12px_30px_rgba(3,7,13,0.32)]"
                  >
                    Open viewer
                  </button>
                ) : null}
                {showMobilePermissionAction && !isMobileAlignmentFocusActive ? (
                  <button
                    type="button"
                    onClick={handlePermissionRecoveryAction}
                    disabled={isPending}
                    data-testid="mobile-permission-action"
                    className="min-h-11 rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_12px_30px_rgba(251,191,36,0.22)] disabled:cursor-wait disabled:bg-amber-100"
                  >
                    {isPending
                      ? permissionRecoveryAction.pendingLabel
                      : permissionRecoveryAction.label}
                  </button>
                ) : null}
                {showMobileAlignAction ? (
                  <button
                    ref={mobileAlignActionRef}
                    type="button"
                    onClick={() =>
                      openAlignmentExperience({
                        opener: mobileAlignActionRef.current,
                        surface: 'mobile',
                      })
                    }
                    data-testid="mobile-align-action"
                    className="min-h-11 rounded-full border border-sky-100/15 bg-slate-950/80 px-5 py-3 text-sm font-semibold text-sky-50 shadow-[0_12px_30px_rgba(3,7,13,0.32)]"
                  >
                    Align
                  </button>
                ) : null}
                {showMobileScopeAction ? (
                  <button
                    type="button"
                    onClick={() =>
                      setViewerSettings((current) => ({
                        ...current,
                        scopeModeEnabled: !current.scopeModeEnabled,
                      }))
                    }
                    aria-pressed={hydratedScopeEnabled}
                    data-testid="mobile-scope-action"
                    className={`min-h-11 rounded-full border px-5 py-3 text-sm font-semibold shadow-[0_12px_30px_rgba(3,7,13,0.32)] ${
                      hydratedScopeEnabled
                        ? 'border-amber-200/45 bg-amber-200/18 text-amber-50'
                        : 'border-sky-100/15 bg-slate-950/80 text-sky-50'
                    }`}
                  >
                    {hydratedScopeEnabled
                      ? `Scope on · ${formatScopeFovValue(hydratedScopeVerticalFovDeg)}`
                      : `Scope off · ${formatScopeFovValue(hydratedScopeVerticalFovDeg)}`}
                  </button>
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

function isMotionAffordanceEligible(object: SummarySkyObject | null) {
  if (!object) {
    return false
  }

  return object.type === 'aircraft' || object.type === 'satellite'
}

function getMotionAffordanceKind(motionQuality: MotionQuality) {
  return motionQuality === 'low' ? 'vector' : 'trail'
}

function getAircraftPollDelayMs({
  motionQuality,
  snapshotTimeS,
  nowMs,
}: {
  motionQuality: MotionQuality
  snapshotTimeS?: number | null
  nowMs: number
}) {
  const intervalMs = POLL_INTERVAL_MS_BY_QUALITY[motionQuality]

  if (motionQuality !== 'high' || typeof snapshotTimeS !== 'number') {
    return intervalMs
  }

  const nextBucketMs = (snapshotTimeS + 10) * 1_000 + 250

  if (nextBucketMs <= nowMs) {
    return intervalMs
  }

  return Math.max(250, nextBucketMs - nowMs)
}

function renderMotionAffordance(
  samples: MotionAffordanceSample[],
  kind: 'vector' | 'trail' | null,
) {
  if (samples.length < 2 || !kind) {
    return null
  }

  if (kind === 'vector') {
    const start = samples[0]
    const end = samples[samples.length - 1]

    return (
      <line
        data-testid="motion-affordance-vector"
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke="rgba(125, 211, 252, 0.72)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    )
  }

  return (
    <polyline
      data-testid="motion-affordance-trail"
      points={samples.map((sample) => `${sample.x},${sample.y}`).join(' ')}
      fill="none"
      stroke="rgba(251, 191, 36, 0.58)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}

function getMarkerVisualClassName(
  object: SkyObject,
  {
    centerLockedObjectId,
    selectedObjectId,
  }: {
    centerLockedObjectId: string | null
    selectedObjectId: string | null
  },
) {
  const isFocused = object.id === centerLockedObjectId || object.id === selectedObjectId
  const motionStateClassName = getMovingObjectMarkerStateClassName(object)

  if (isFocused) {
    return `rounded-full border border-amber-100/80 bg-amber-200/35 shadow-[0_0_0_4px_rgba(251,191,36,0.14),0_0_18px_rgba(251,191,36,0.4)] ${motionStateClassName}`
  }

  switch (object.type) {
    case 'sun':
      return 'rounded-full border border-amber-100/75 bg-amber-200/55 shadow-[0_0_16px_rgba(251,191,36,0.42)]'
    case 'moon':
      return 'rounded-full border border-slate-100/70 bg-slate-100/65 shadow-[0_0_14px_rgba(226,232,240,0.24)]'
    case 'planet':
      return 'rounded-full border border-emerald-100/65 bg-emerald-200/45 shadow-[0_0_14px_rgba(110,231,183,0.24)]'
    case 'star':
      return 'rotate-45 border border-sky-100/80 bg-sky-50/80 shadow-[0_0_12px_rgba(186,230,253,0.22)]'
    case 'constellation':
      return 'rounded-sm border border-sky-100/65 bg-sky-100/18 shadow-[0_0_10px_rgba(186,230,253,0.16)]'
    case 'satellite':
      return object.metadata.isIss === true
        ? `rounded-[0.4rem] border border-violet-100/70 bg-violet-200/42 shadow-[0_0_14px_rgba(196,181,253,0.28)] ${motionStateClassName}`
        : `rounded-[0.35rem] border border-sky-100/70 bg-sky-200/38 shadow-[0_0_12px_rgba(125,211,252,0.2)] ${motionStateClassName}`
    case 'aircraft':
      return `rounded-[0.35rem] border border-cyan-100/70 bg-cyan-200/38 shadow-[0_0_12px_rgba(103,232,249,0.22)] ${motionStateClassName}`
    default:
      return 'rounded-full border border-sky-100/70 bg-sky-100/30'
  }
}

function getMovingObjectMarkerStateClassName(object: SkyObject) {
  switch (getMovingObjectMotionState(object)) {
    case 'estimated':
      return 'ring-1 ring-cyan-100/35'
    case 'stale':
      return 'border-dashed ring-1 ring-slate-50/20'
    default:
      return ''
  }
}

function getMarkerSizePx(
  object: SkyObject,
  verticalFovAdjustmentDeg: number,
  markerScale: number,
) {
  return getMarkerSizePxForEffectiveVerticalFovDeg(
    object,
    getEffectiveVerticalFovDeg(verticalFovAdjustmentDeg),
    markerScale,
  )
}

function getScopeMarkerSizePx(
  object: SkyObject,
  {
    lensDiameterPx,
    scopeVerticalFovDeg,
    markerScale,
  }: {
    lensDiameterPx: number
    scopeVerticalFovDeg: number
    markerScale: number
  },
) {
  const scopeRender = getScopeRenderProfile(object)

  if (object.type === 'star' && scopeRender) {
    return Math.max(1, Math.round(scopeRender.haloPx * markerScale))
  }

  if (isScopeExtendedObject(object)) {
    return getScopeExtendedObjectSizePx(object, {
      lensDiameterPx,
      scopeVerticalFovDeg,
      markerScale,
    })
  }

  return getMarkerSizePxForEffectiveVerticalFovDeg(
    object,
    scopeVerticalFovDeg,
    markerScale,
  )
}

function getScopeMarkerOpacity(object: SkyObject, scopeOptics: ScopeOptics) {
  const scopeRender = getScopeRenderProfile(object)

  if (object.type === 'star' && scopeRender) {
    return clampNumber(scopeRender.intensity, 0.18, 1)
  }

  if (isScopeExtendedObject(object)) {
    return getScopeExtendedObjectOpacity(object, scopeOptics)
  }

  return 1
}

function getScopeDeepStarImportance(magnitude: number, hasDisplayName: boolean) {
  const baseImportance = clampNumber((12 - magnitude) * 4.5, 8, 54)

  return hasDisplayName ? baseImportance + 10 : baseImportance
}

function getMarkerSizePxForEffectiveVerticalFovDeg(
  object: SkyObject,
  effectiveFovDeg: number,
  markerScale: number,
) {
  const fovScale = clampNumber(50 / effectiveFovDeg, 0.82, 1.24)

  if (object.type === 'star') {
    const magnitudeBoost = getMagnitudeBoost(object.magnitude)
    const legacyScaleOneSizePx = Math.max(6, Math.round((6 + magnitudeBoost * 0.75) * fovScale))
    const relaxedScaleOneSizePx = Math.max(1, Math.round((1 + magnitudeBoost * 0.75) * fovScale))
    const scaleOneSizePx =
      legacyScaleOneSizePx > 6 ? legacyScaleOneSizePx : relaxedScaleOneSizePx

    return Math.max(1, Math.round(scaleOneSizePx * markerScale))
  }

  let sizePx = 0

  switch (object.type) {
    case 'sun':
      sizePx = 18
      break
    case 'moon':
      sizePx = 16
      break
    case 'planet':
      sizePx = 8 + getMagnitudeBoost(object.magnitude)
      break
    case 'satellite':
      sizePx = 6 + getRangeBoost(object.rangeKm)
      if (object.metadata.isIss === true) {
        sizePx += 2
      }
      break
    case 'aircraft':
      sizePx = 7 + getRangeBoost(object.rangeKm)
      break
    case 'constellation':
      sizePx = 9
      break
    default:
      sizePx = 7
      break
  }

  const scaleOneSizePx = Math.max(6, Math.round(sizePx * fovScale))

  return Math.max(1, Math.round(scaleOneSizePx * markerScale))
}

function getScopeLensDiameterPx(
  viewport: {
    width: number
    height: number
  },
  scopeLensDiameterPct: number,
) {
  const safeWidth = Number.isFinite(viewport.width) ? viewport.width : DEFAULT_VIEWPORT.width
  const safeHeight = Number.isFinite(viewport.height) ? viewport.height : DEFAULT_VIEWPORT.height
  const normalizedScopeLensDiameterPct = normalizeScopeLensDiameterPct(scopeLensDiameterPct)
  const requestedDiameterPx = safeHeight * (normalizedScopeLensDiameterPct / 100)
  const viewportSafeMaxPx = Math.max(
    1,
    Math.min(
      safeWidth - SCOPE_LENS_VIEWPORT_MARGIN_PX,
      safeHeight - SCOPE_LENS_VIEWPORT_MARGIN_PX,
      SCOPE_LENS_DIAMETER_PX_RANGE.max,
    ),
  )
  const viewportSafeMinPx = Math.min(SCOPE_LENS_DIAMETER_PX_RANGE.min, viewportSafeMaxPx)
  const supportedRangeMinDiameterPx =
    safeHeight * (SCOPE_LENS_DIAMETER_PCT_RANGE.min / 100)

  if (
    supportedRangeMinDiameterPx > viewportSafeMaxPx &&
    viewportSafeMaxPx > viewportSafeMinPx
  ) {
    const normalizedPercentWithinRange =
      (normalizedScopeLensDiameterPct - SCOPE_LENS_DIAMETER_PCT_RANGE.min) /
      (SCOPE_LENS_DIAMETER_PCT_RANGE.max - SCOPE_LENS_DIAMETER_PCT_RANGE.min)

    return clampNumber(
      viewportSafeMinPx +
        normalizedPercentWithinRange * (viewportSafeMaxPx - viewportSafeMinPx),
      viewportSafeMinPx,
      viewportSafeMaxPx,
    )
  }

  return clampNumber(requestedDiameterPx, viewportSafeMinPx, viewportSafeMaxPx)
}

function getScopeDeepStarDisplayIntensity(intensity: unknown, apertureMm: unknown) {
  const safeIntensity = typeof intensity === 'number' && Number.isFinite(intensity) ? intensity : 0.5
  const apertureFactor = clampNumber(
    (normalizeScopeOpticsValue('apertureMm', apertureMm) -
      DEEP_STAR_ATTENUATION_APERTURE_MM_RANGE.min) /
      (DEEP_STAR_ATTENUATION_APERTURE_MM_RANGE.max -
        DEEP_STAR_ATTENUATION_APERTURE_MM_RANGE.min),
    0,
    1,
  )
  const deepStarAttenuation = 0.45 + 0.55 * apertureFactor

  return clampNumber(safeIntensity * deepStarAttenuation, 0.08, 1)
}

function getScopeRenderProfile(object: SkyObject): ScopeRenderProfile | null {
  const candidate = object.metadata.scopeRender

  if (!candidate || typeof candidate !== 'object') {
    return null
  }

  const {
    effectiveLimitMag,
    relativeFlux,
    transmission,
    opticsGain,
    intensity,
    corePx,
    haloPx,
  } = candidate as Partial<ScopeRenderProfile>

  if (
    !isFiniteScopeRenderValue(effectiveLimitMag) ||
    !isFiniteScopeRenderValue(relativeFlux) ||
    !isFiniteScopeRenderValue(transmission) ||
    !isFiniteScopeRenderValue(opticsGain) ||
    !isFiniteScopeRenderValue(intensity) ||
    !isFiniteScopeRenderValue(corePx) ||
    !isFiniteScopeRenderValue(haloPx)
  ) {
    return null
  }

  return {
    effectiveLimitMag,
    relativeFlux,
    transmission,
    opticsGain,
    intensity,
    corePx,
    haloPx,
  }
}

function isFiniteScopeRenderValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isScopeExtendedObject(object: SkyObject): object is SkyObject & {
  type: 'sun' | 'moon' | 'planet'
} {
  return object.type === 'sun' || object.type === 'moon' || object.type === 'planet'
}

function isScopeBrightObject(object: SkyObject) {
  return (
    object.type === 'sun' ||
    object.type === 'moon' ||
    object.type === 'planet' ||
    object.type === 'star'
  )
}

function getScopeExtendedObjectSizePx(
  object: SkyObject & {
    type: 'sun' | 'moon' | 'planet'
  },
  {
    lensDiameterPx,
    scopeVerticalFovDeg,
    markerScale,
  }: {
    lensDiameterPx: number
    scopeVerticalFovDeg: number
    markerScale: number
  },
) {
  const baselineAngularDiameterDeg = getScopeExtendedObjectBaselineAngularDiameterDeg(object)
  const projectedDiameterPx =
    lensDiameterPx * (baselineAngularDiameterDeg / Math.max(scopeVerticalFovDeg, 0.1))
  const markerScaleFactor = 0.85 + clampNumber(markerScale, 1, 4) * 0.15
  const scaledDiameterPx = projectedDiameterPx * markerScaleFactor

  switch (object.type) {
    case 'sun':
      return Math.round(
        clampNumber(scaledDiameterPx, 22, lensDiameterPx * 0.78),
      )
    case 'moon':
      return Math.round(
        clampNumber(scaledDiameterPx, 20, lensDiameterPx * 0.72),
      )
    case 'planet':
      return Math.round(
        clampNumber(scaledDiameterPx, 5, Math.min(34, lensDiameterPx * 0.22)),
      )
  }
}

function getScopeExtendedObjectOpacity(
  object: SkyObject & {
    type: 'sun' | 'moon' | 'planet'
  },
  scopeOptics: ScopeOptics,
) {
  const normalizedOptics = normalizeScopeOptics(scopeOptics)
  const apertureFactor = clampNumber(
    (normalizedOptics.apertureMm - SCOPE_OPTICS_RANGES.apertureMm.min) /
      (240 - SCOPE_OPTICS_RANGES.apertureMm.min),
    0,
    1,
  )
  const magnificationFactor = clampNumber(
    (normalizedOptics.magnificationX - SCOPE_OPTICS_RANGES.magnificationX.min) /
      (160 - SCOPE_OPTICS_RANGES.magnificationX.min),
    0,
    1,
  )

  switch (object.type) {
    case 'sun':
      return clampNumber(0.78 + apertureFactor * 0.16 - magnificationFactor * 0.08, 0.72, 0.94)
    case 'moon':
      return clampNumber(0.7 + apertureFactor * 0.18 - magnificationFactor * 0.1, 0.62, 0.92)
    case 'planet':
      return clampNumber(0.46 + apertureFactor * 0.24 - magnificationFactor * 0.14, 0.34, 0.82)
  }
}

function getScopeExtendedObjectBaselineAngularDiameterDeg(
  object: SkyObject & {
    type: 'sun' | 'moon' | 'planet'
  },
) {
  if (object.type === 'planet') {
    return (
      SCOPE_EXTENDED_OBJECT_BASELINE_ANGULAR_DIAMETER_DEG_BY_ID[
        object.id as keyof typeof SCOPE_EXTENDED_OBJECT_BASELINE_ANGULAR_DIAMETER_DEG_BY_ID
      ] ?? DEFAULT_SCOPE_PLANET_BASELINE_ANGULAR_DIAMETER_DEG
    )
  }

  return SCOPE_EXTENDED_OBJECT_BASELINE_ANGULAR_DIAMETER_DEG_BY_ID[object.type]
}

function getMagnitudeBoost(magnitude?: number) {
  if (typeof magnitude !== 'number' || !Number.isFinite(magnitude)) {
    return 0
  }

  return clampNumber((4 - magnitude) * 0.8, 0, 4)
}

function getRangeBoost(rangeKm?: number) {
  if (typeof rangeKm !== 'number' || !Number.isFinite(rangeKm)) {
    return 0
  }

  return clampNumber((120 - Math.min(rangeKm, 120)) / 24, 0, 4)
}

function getSatelliteLayerStatusLabel(healthStatus: HealthApiResponse | null) {
  switch (healthStatus?.tleCache.status) {
    case 'stale':
      return 'Using stale satellite cache'
    case 'expired':
      return 'Satellite cache expired'
    default:
      return undefined
  }
}

function subscribeToHydrationReady(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const timeoutId = window.setTimeout(onStoreChange, 0)

  return () => {
    window.clearTimeout(timeoutId)
  }
}

function getHydratedSnapshot() {
  return true
}

function getServerHydrationSnapshot() {
  return false
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function formatMarkerScaleValue(value: number) {
  return `${value.toFixed(1)}x`
}

function resolveCalibrationTarget(
  objects: readonly SkyObject[],
  preferredTarget: AlignmentTargetPreference,
): CalibrationTargetResolution {
  const { sunTarget, moonTarget, planetTarget, starTarget } =
    resolveVisibleCalibrationTargetCandidates(objects)
  const northTarget: CalibrationTarget = {
    id: 'north-marker',
    label: 'North marker',
    description: 'Use north on the horizon when no sky body is suitable.',
    azimuthDeg: 0,
    elevationDeg: 0,
    sourceType: 'north-marker',
  }
  const autoTarget = sunTarget ?? moonTarget ?? planetTarget ?? starTarget ?? northTarget
  const requestedTarget = preferredTarget === 'moon' ? moonTarget : sunTarget

  return {
    availability: {
      sun: sunTarget !== null,
      moon: moonTarget !== null,
    },
    autoTarget,
    target: requestedTarget ?? autoTarget,
    preferredTarget,
    preferredTargetUnavailable: requestedTarget === null,
  }
}

function resolveDefaultAlignmentTargetPreference(
  objects: readonly SkyObject[],
  sunAltitudeDeg: number,
): AlignmentTargetPreference {
  const { sunTarget, moonTarget } = resolveVisibleCalibrationTargetCandidates(objects)

  if (sunTarget && moonTarget) {
    return sunTarget.elevationDeg >= moonTarget.elevationDeg ? 'sun' : 'moon'
  }

  if (sunTarget) {
    return 'sun'
  }

  if (moonTarget) {
    return 'moon'
  }

  return sunAltitudeDeg < 0 ? 'moon' : 'sun'
}

function resolveVisibleCalibrationTargetCandidates(
  objects: readonly SkyObject[],
): VisibleCalibrationTargetCandidates {
  const visibleCelestialTargets = objects.filter((object) => {
    if (
      object.type !== 'sun' &&
      object.type !== 'moon' &&
      object.type !== 'planet' &&
      object.type !== 'star'
    ) {
      return false
    }

    return !isCelestialDaylightLabelSuppressed(object)
  })

  const sun = visibleCelestialTargets.find((object) => object.type === 'sun')
  const moon = visibleCelestialTargets.find((object) => object.type === 'moon')
  const brightestPlanet = [...visibleCelestialTargets]
    .filter((object) => object.type === 'planet')
    .sort(compareCalibrationBrightness)[0]
  const brightestStar = [...visibleCelestialTargets]
    .filter((object) => object.type === 'star')
    .sort(compareCalibrationBrightness)[0]

  return {
    sunTarget: sun ? createCalibrationTarget(sun, 'sun') : null,
    moonTarget: moon ? createCalibrationTarget(moon, 'moon') : null,
    planetTarget: brightestPlanet ? createCalibrationTarget(brightestPlanet, 'planet') : null,
    starTarget: brightestStar ? createCalibrationTarget(brightestStar, 'star') : null,
  }
}

function createCalibrationTarget(
  object: SkyObject,
  sourceType: CalibrationTarget['sourceType'],
): CalibrationTarget {
  switch (sourceType) {
    case 'sun':
      return {
        id: object.id,
        label: object.label,
        description: 'Center the Sun in the reticle, then align.',
        azimuthDeg: object.azimuthDeg,
        elevationDeg: object.elevationDeg,
        sourceType,
      }
    case 'moon':
      return {
        id: object.id,
        label: object.label,
        description: 'Center the Moon in the reticle, then align.',
        azimuthDeg: object.azimuthDeg,
        elevationDeg: object.elevationDeg,
        sourceType,
      }
    case 'planet':
      return {
        id: object.id,
        label: object.label,
        description: 'Center the brightest visible planet in the reticle, then align.',
        azimuthDeg: object.azimuthDeg,
        elevationDeg: object.elevationDeg,
        sourceType,
      }
    case 'star':
      return {
        id: object.id,
        label: object.label,
        description: 'Center the brightest visible star in the reticle, then align.',
        azimuthDeg: object.azimuthDeg,
        elevationDeg: object.elevationDeg,
        sourceType,
      }
    default:
      return {
        id: object.id,
        label: object.label,
        description: 'Use north on the horizon when no sky body is suitable.',
        azimuthDeg: object.azimuthDeg,
        elevationDeg: object.elevationDeg,
        sourceType,
      }
  }
}

function compareCalibrationBrightness(left: SkyObject, right: SkyObject) {
  const leftMagnitude = left.magnitude ?? Number.POSITIVE_INFINITY
  const rightMagnitude = right.magnitude ?? Number.POSITIVE_INFINITY

  if (leftMagnitude !== rightMagnitude) {
    return leftMagnitude - rightMagnitude
  }

  if (right.importance !== left.importance) {
    return right.importance - left.importance
  }

  return right.elevationDeg - left.elevationDeg
}

function describeCalibrationStatus({
  startupState,
  cameraPose,
  poseCalibration,
  calibrationTarget,
  appliedCalibrationTarget,
}: {
  startupState: StartupState
  cameraPose: CameraPose
  poseCalibration: PoseCalibration
  calibrationTarget: CalibrationTarget
  appliedCalibrationTarget: CalibrationTarget | null
}) {
  if (cameraPose.mode === 'manual') {
    return 'Manual pan is active.'
  }

  if (startupState === 'sensor-relative-needs-calibration') {
    return `Relative sensors need ${calibrationTarget.label} before labels can lock.`
  }

  if (poseCalibration.calibrated) {
    return `Aligned using ${(appliedCalibrationTarget ?? calibrationTarget).label}.`
  }

  return 'Absolute sensors are active, but manual alignment is still available.'
}

function getSensorStatusValue({
  startupState,
  orientationSource,
  orientationAbsolute,
  cameraPose,
  latestOrientationSample,
  poseCalibration,
  orientationUpgradedFromRelative,
}: {
  startupState: StartupState
  orientationSource: OrientationSource | null
  orientationAbsolute: boolean
  cameraPose: CameraPose
  latestOrientationSample: OrientationSample | null
  poseCalibration: PoseCalibration
  orientationUpgradedFromRelative: boolean
}) {
  if (cameraPose.mode === 'manual') {
    return 'Manual'
  }

  if (startupState === 'awaiting-orientation') {
    return 'Waiting'
  }

  if (startupState === 'sensor-relative-needs-calibration') {
    return latestOrientationSample?.compassBacked ? 'Compass relative' : 'Calibrate'
  }

  if (orientationUpgradedFromRelative) {
    return 'Upgraded'
  }

  if (latestOrientationSample?.compassBacked && orientationAbsolute) {
    return 'Compass validated'
  }

  if (latestOrientationSample?.compassBacked) {
    return 'Compass-backed'
  }

  if (poseCalibration.calibrated) {
    return 'Calibrated'
  }

  if (orientationSource === 'absolute-sensor') {
    return 'Absolute sensor'
  }

  if (orientationSource === 'deviceorientation-absolute' || orientationAbsolute) {
    return 'Absolute'
  }

  if (orientationSource === 'deviceorientation-relative') {
    return 'Relative'
  }

  return 'Pending'
}

function subtractProjectedComponent(
  vector: [number, number, number],
  normal: [number, number, number],
): [number, number, number] {
  const scale = dotVec3(vector, normal)
  return [
    vector[0] - normal[0] * scale,
    vector[1] - normal[1] * scale,
    vector[2] - normal[2] * scale,
  ]
}

function quaternionsApproximatelyEqual(
  left: [number, number, number, number],
  right: [number, number, number, number],
) {
  const sameSignDistance = Math.hypot(
    left[0] - right[0],
    left[1] - right[1],
    left[2] - right[2],
    left[3] - right[3],
  )
  const flippedSignDistance = Math.hypot(
    left[0] + right[0],
    left[1] + right[1],
    left[2] + right[2],
    left[3] + right[3],
  )

  return Math.min(sameSignDistance, flippedSignDistance) < 1e-6
}

function DesktopActionButton({
  label,
  status,
  onClick,
  disabled = false,
  pressed,
  dataTestId,
}: {
  label: string
  status: string
  onClick: MouseEventHandler<HTMLButtonElement>
  disabled?: boolean
  pressed?: boolean
  dataTestId?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      data-testid={dataTestId}
      className="min-h-11 rounded-full border border-sky-100/12 bg-slate-950/45 px-4 py-2 text-left text-sky-50 shadow-[0_10px_24px_rgba(3,7,13,0.2)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="block text-sm font-semibold">{label}</span>
      <span className="mt-1 block text-[11px] uppercase tracking-[0.16em] text-sky-200/60">
        {status}
      </span>
    </button>
  )
}

function QuickRangeSlider({
  label,
  value,
  suffix,
  min,
  max,
  step,
  valueTestId,
  sliderTestId,
  onChange,
}: {
  label: string
  value: number
  suffix: string
  min: number
  max: number
  step: number
  valueTestId: string
  sliderTestId: string
  onChange: (value: number) => void
}) {
  return (
    <label className="pointer-events-auto grid gap-2 rounded-[1.25rem] border border-sky-100/15 bg-slate-950/70 px-4 py-3 text-sm text-sky-50 shadow-[0_12px_30px_rgba(3,7,13,0.32)]">
      <span className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <span
          className="text-xs uppercase tracking-[0.16em] text-sky-200/65"
          data-testid={valueTestId}
        >
          {formatQuickRangeValue(value, suffix)}
        </span>
      </span>
      <input
        aria-label={label}
        data-testid={sliderTestId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function formatScopeActionStatus(enabled: boolean, verticalFovDeg: number) {
  return `${enabled ? 'On' : 'Off'} ${formatScopeFovValue(verticalFovDeg)}`
}

function formatScopeFovValue(verticalFovDeg: number) {
  return `${Number.isInteger(verticalFovDeg) ? verticalFovDeg : verticalFovDeg.toFixed(1)}° lens`
}

function formatQuickRangeValue(value: number, suffix: string) {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`
}

function CompactTopBanner({
  title,
  body,
  critical = false,
  tone,
  actionLabel,
  onAction,
  actionDisabled = false,
  footer,
}: Omit<ViewerBannerItem, 'id' | 'actionId'> & {
  onAction?: MouseEventHandler<HTMLButtonElement>
}) {
  const className = critical
    ? 'border-rose-300/20 bg-rose-500/12 text-rose-50'
    : tone === 'info'
      ? 'border-sky-200/15 bg-sky-300/10 text-sky-50'
      : 'border-amber-200/15 bg-amber-300/10 text-amber-50'
  const bodyClassName = critical
    ? 'text-rose-100/80'
    : tone === 'info'
      ? 'text-sky-100/78'
      : 'text-amber-50/80'

  return (
    <section
      className={`rounded-[1rem] border px-4 py-2.5 text-sm shadow-[0_10px_24px_rgba(3,7,13,0.14)] ${className}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          <p className={`mt-1 leading-5 ${bodyClassName}`}>{body}</p>
          {footer ? (
            <p className={`mt-2 text-xs ${bodyClassName}`} role="alert">
              {footer}
            </p>
          ) : null}
        </div>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            disabled={actionDisabled}
            className="min-h-11 shrink-0 rounded-full border border-current/20 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </section>
  )
}

function BannerOverflowDisclosure({
  banners,
  variant,
  onAction,
}: {
  banners: ViewerBannerItem[]
  variant: 'desktop' | 'mobile'
  onAction: (
    actionId?: ViewerBannerActionId,
    context?: {
      opener?: HTMLElement | null
      surface?: ViewerSurface
    },
  ) => void
}) {
  return (
    <details
      className={`rounded-[1.1rem] border border-sky-100/10 bg-slate-950/35 px-4 py-3 ${
        variant === 'desktop' ? 'text-sm text-sky-50/85' : 'text-sm text-sky-50/85'
      }`}
    >
      <summary className="cursor-pointer list-none text-xs uppercase tracking-[0.18em] text-sky-200/60">
        More updates ({banners.length})
      </summary>
      <div className="mt-3 grid gap-2">
        {banners.map((banner) =>
          variant === 'desktop' ? (
            <CompactTopBanner
              key={banner.id}
              title={banner.title}
              body={banner.body}
              critical={banner.critical}
              tone={banner.tone}
              actionLabel={banner.actionLabel}
              onAction={
                banner.actionId
                  ? (event) =>
                      onAction(banner.actionId, {
                        opener: event.currentTarget,
                        surface: 'desktop',
                      })
                  : undefined
              }
              actionDisabled={banner.actionDisabled}
              footer={banner.footer}
            />
          ) : (
            <FallbackBanner
              key={banner.id}
              title={banner.title}
              body={banner.body}
              critical={banner.critical}
              tone={banner.tone}
              actionLabel={banner.actionLabel}
              onAction={
                banner.actionId
                  ? () =>
                      onAction(banner.actionId, {
                        surface: 'mobile',
                      })
                  : undefined
              }
              actionDisabled={banner.actionDisabled}
              footer={banner.footer}
            />
          ),
        )}
      </div>
    </details>
  )
}

function StatusBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-sky-100/10 bg-slate-950/55 px-3 py-2 text-xs uppercase tracking-[0.16em] text-sky-100/80">
      {label}: {value}
    </div>
  )
}

function CompactPersistentNotice({
  testId,
  title,
  body,
}: {
  testId: string
  title: string
  body: string
}) {
  return (
    <section
      className="rounded-full border border-amber-200/15 bg-slate-950/48 px-3 py-2 text-[11px] text-amber-50/88 shadow-[0_10px_24px_rgba(3,7,13,0.14)]"
      data-testid={testId}
      role="status"
    >
      <span className="font-semibold">{title}</span> <span>{body}</span>
    </section>
  )
}

function getViewportFromBounds(bounds: Pick<DOMRect, 'width' | 'height'>) {
  const width = Math.round(bounds.width)
  const height = Math.round(bounds.height)

  if (width <= 0 || height <= 0) {
    return DEFAULT_VIEWPORT
  }

  return {
    width,
    height,
  }
}

function FallbackBanner({
  title,
  body,
  critical = false,
  tone,
  actionLabel,
  onAction,
  actionDisabled = false,
  footer,
}: {
  title: string
  body: string
  critical?: boolean
  tone?: 'info'
  actionLabel?: string
  onAction?: () => void
  actionDisabled?: boolean
  footer?: string | null
}) {
  const className = critical
    ? 'border border-rose-300/25 bg-rose-500/14 text-rose-50'
    : tone === 'info'
      ? 'border border-sky-200/15 bg-sky-300/10 text-sky-50'
      : 'border border-amber-200/15 bg-amber-300/10 text-amber-50'
  const bodyClassName = critical
    ? 'text-rose-100/80'
    : tone === 'info'
      ? 'text-sky-100/78'
      : 'text-amber-50/80'

  return (
    <section className={`rounded-[1.5rem] px-4 py-3 text-sm ${className}`}>
      <div className="flex flex-col gap-2">
        <div>
          <p className="font-semibold">{title}</p>
          <p className={`mt-1 ${bodyClassName}`}>{body}</p>
          {footer ? (
            <p className={`mt-2 text-xs ${bodyClassName}`} role="alert">
              {footer}
            </p>
          ) : null}
        </div>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            disabled={actionDisabled}
            className="min-h-11 self-start rounded-full border border-current/20 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </section>
  )
}

function DevelopmentOrientationDiagnostics({
  sample,
  sampleAgeMs,
  sampleRateHz,
  poseCalibration,
  orientationUpgradedFromRelative,
}: {
  sample: OrientationSample | null
  sampleAgeMs: number | null
  sampleRateHz: number | null
  poseCalibration: PoseCalibration
  orientationUpgradedFromRelative: boolean
}) {
  if (process.env.NODE_ENV === 'production') {
    return null
  }

  const rows = [
    ['Selected source', sample?.source ?? 'pending'],
    ['Provider kind', sample?.rawSample.providerKind ?? 'pending'],
    ['Absolute', formatDiagnosticsBoolean(sample?.absolute)],
    ['Compass-backed', formatDiagnosticsBoolean(sample?.compassBacked)],
    ['Sample rate', sampleRateHz === null ? 'pending' : `${sampleRateHz.toFixed(1)} Hz`],
    ['Last sample age', sampleAgeMs === null ? 'pending' : `${Math.round(sampleAgeMs)} ms`],
    ['Screen angle', `${getScreenOrientationCorrectionDeg()}°`],
    ['Compass heading', formatDiagnosticsDegrees(sample?.reportedCompassHeadingDeg)],
    ['Compass accuracy', formatDiagnosticsDegrees(sample?.compassAccuracyDeg)],
    ['Calibration active', formatDiagnosticsBoolean(poseCalibration.calibrated)],
    ['Upgraded', formatDiagnosticsBoolean(orientationUpgradedFromRelative)],
  ] as const

  return (
    <section
      className="rounded-[1.25rem] border border-sky-100/10 bg-slate-950/55 p-4 text-sm"
      data-testid="orientation-diagnostics"
    >
      <p className="text-xs uppercase tracking-[0.2em] text-sky-200/60">Orientation diagnostics</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-sky-100/10 bg-white/5 px-3 py-2"
          >
            <p className="text-[10px] uppercase tracking-[0.16em] text-sky-200/60">{label}</p>
            <p className="mt-1 text-sm text-sky-50">{value}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function formatDiagnosticsBoolean(value: boolean | undefined) {
  if (typeof value !== 'boolean') {
    return 'pending'
  }

  return value ? 'yes' : 'no'
}

function formatDiagnosticsDegrees(value: number | undefined) {
  return typeof value === 'number' ? `${value.toFixed(1)}°` : 'n/a'
}

function getBrowserFamily(): BrowserFamily {
  if (typeof navigator === 'undefined') {
    return 'other'
  }

  const userAgent = navigator.userAgent
  const isAndroid = /Android/i.test(userAgent)
  const isSafari = /Safari/i.test(userAgent) && !/CriOS|Chrome|FxiOS|Firefox|SamsungBrowser/i.test(userAgent)

  if (/iPhone|iPad|iPod/i.test(userAgent) && isSafari) {
    return 'ios-safari'
  }

  if (isAndroid && /SamsungBrowser/i.test(userAgent)) {
    return 'samsung-internet'
  }

  if (isAndroid && /Firefox/i.test(userAgent)) {
    return 'firefox-android'
  }

  if (isAndroid && /Chrome|CriOS/i.test(userAgent)) {
    return 'chrome-android'
  }

  return 'other'
}

function getMotionRecoveryBody(browserFamily: BrowserFamily) {
  switch (browserFamily) {
    case 'ios-safari':
      return 'On iPhone Safari, enable motion in iOS Settings → Safari → Motion & Orientation Access, then return and retry.'
    case 'chrome-android':
      return 'On Chrome for Android, confirm site motion sensors are allowed for this origin, then retry from the viewer.'
    case 'firefox-android':
      return 'On Firefox for Android, motion can stay on a relative event path. Retry here, then align before trusting labels if relative mode comes back.'
    case 'samsung-internet':
      return 'On Samsung Internet, retry motion here and confirm site sensor permissions. Chromium-like behavior can vary by Samsung Internet version.'
    default:
      return 'Retry motion from this viewer and confirm this browser allows accelerometer, gyroscope, and magnetometer access for the page.'
  }
}

function getMotionDeniedMessage(browserFamily: BrowserFamily) {
  switch (browserFamily) {
    case 'ios-safari':
      return 'Motion access is still denied. Check iOS Settings → Safari → Motion & Orientation Access, then retry.'
    case 'chrome-android':
      return 'Motion access is still denied. Check this site’s motion sensor permission in Chrome for Android, then retry.'
    case 'firefox-android':
      return 'Motion access is still denied. Firefox for Android can require a relative fallback, so retry and align if sensors return.'
    case 'samsung-internet':
      return 'Motion access is still denied. Check Samsung Internet site permissions, then retry because sensor behavior can vary by version.'
    default:
      return 'Motion access is still denied. Check this browser’s site sensor permissions, then retry.'
  }
}

function getMotionUnavailableMessage(browserFamily: BrowserFamily) {
  switch (browserFamily) {
    case 'firefox-android':
      return 'Motion sensors are unavailable right now. Firefox for Android can fall back to relative events when they are exposed, so retry and align if that path returns.'
    case 'samsung-internet':
      return 'Motion sensors are unavailable right now. Samsung Internet can vary by version and device, so retry and fall back to manual pan if needed.'
    default:
      return 'Motion sensors are unavailable on this device/browser right now.'
  }
}

function getMotionStartupTimeoutMessage(
  browserFamily: BrowserFamily,
  orientationStatus: Extract<PermissionStatusValue, 'denied' | 'unavailable'>,
) {
  return orientationStatus === 'denied'
    ? getMotionDeniedMessage(browserFamily)
    : getMotionUnavailableMessage(browserFamily)
}

function resolveOrientationTimeoutStatus(): Extract<
  PermissionStatusValue,
  'denied' | 'unavailable'
> {
  const capabilities = getOrientationCapabilities()

  return capabilities.hasEvents ||
    capabilities.hasAbsoluteSensor ||
    capabilities.hasRelativeSensor
    ? 'denied'
    : 'unavailable'
}

function getInitialReducedMotionPreference() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function resolveSceneClock({
  prefersReducedMotion,
  motionQuality,
}: {
  prefersReducedMotion: boolean
  motionQuality: MotionQuality
}) {
  if (
    prefersReducedMotion ||
    motionQuality === 'low' ||
    typeof window === 'undefined' ||
    typeof window.requestAnimationFrame !== 'function'
  ) {
    return {
      mode: 'coarse' as const,
      intervalMs: SCENE_CLOCK_COARSE_INTERVAL_MS,
    }
  }

  return {
    mode: 'animated' as const,
    intervalMs: SCENE_CLOCK_FRAME_INTERVAL_MS[motionQuality],
  }
}

type AlignmentInstructionsProps = {
  targetLabel: string
  status: string
  supportingNotice: AlignmentTutorialNotice | null
  primaryStep: AlignmentTutorialPrimaryStep
  selectedTarget: AlignmentTargetPreference
  availability: {
    sun: boolean
    moon: boolean
  }
  onSelectTarget: (target: AlignmentTargetPreference) => void
  onResetCalibration: () => void
  onFineAdjustCalibration: (adjustment: {
    axis: 'yaw' | 'pitch'
    deltaDeg: number
  }) => void
  canResetCalibration: boolean
  onClose: () => void
  onStartAlignment?: () => void
  canStartAlignment?: boolean
  showStartAlignmentAction?: boolean
  compact?: boolean
  closeButtonRef?: RefObject<HTMLButtonElement | null>
}

function getActiveFocusableElement() {
  if (!(document.activeElement instanceof HTMLElement)) {
    return null
  }

  return canRestoreFocusTarget(document.activeElement) ? document.activeElement : null
}

function isElementVisible(element: HTMLElement) {
  if (
    element.hasAttribute('hidden') ||
    element.closest('[hidden]') ||
    element.hasAttribute('inert') ||
    element.closest('[inert]') ||
    element.getAttribute('aria-hidden') === 'true' ||
    element.closest('[aria-hidden="true"]')
  ) {
    return false
  }

  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    const style = window.getComputedStyle(element)

    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
      return false
    }
  }

  return true
}

function canRestoreFocusTarget(target: HTMLElement | null | undefined): target is HTMLElement {
  return Boolean(target && target.isConnected && isElementVisible(target) && isFocusableElement(target))
}

function isFocusableElement(element: HTMLElement) {
  if (!element.isConnected || element.hasAttribute('disabled') || !isElementVisible(element)) {
    return false
  }

  return element.matches(FOCUSABLE_SELECTOR) || element.tabIndex >= 0
}

function resolveFocusRestoreTarget(...targets: Array<HTMLElement | null | undefined>) {
  return targets.find((target) => canRestoreFocusTarget(target)) ?? null
}

function getFocusableElements(root: HTMLElement) {
  return Array.from(
    root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => isFocusableElement(element))
}

function trapFocusWithinPanel(
  event: ReactKeyboardEvent<HTMLElement>,
  panel: HTMLElement | null,
) {
  if (event.key !== 'Tab' || !panel) {
    return
  }

  const focusableElements = getFocusableElements(panel)

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

function focusAfterDismiss(target: HTMLElement | null) {
  if (!target) {
    return
  }

  target.focus()

  if (document.activeElement === target || typeof window === 'undefined') {
    return
  }

  window.setTimeout(() => {
    if (canRestoreFocusTarget(target)) {
      target.focus()
    }
  }, 0)
}

function AlignmentInstructionsPanel({
  compact = false,
  ...props
}: AlignmentInstructionsProps) {
  return (
    <section
      className={`rounded-[1.5rem] border border-sky-100/10 bg-slate-950/55 ${
        compact ? 'p-4' : 'p-5'
      }`}
      data-testid="alignment-instructions-panel"
    >
      <AlignmentInstructionsContent
        {...props}
        compact={compact}
      />
    </section>
  )
}

function AlignmentInstructionsContent({
  targetLabel,
  status,
  supportingNotice,
  primaryStep,
  selectedTarget,
  availability,
  onSelectTarget,
  onResetCalibration,
  onFineAdjustCalibration,
  canResetCalibration,
  onClose,
  onStartAlignment,
  canStartAlignment = false,
  showStartAlignmentAction = false,
  compact = false,
  closeButtonRef,
}: AlignmentInstructionsProps) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-sky-200/60">Alignment</p>
          <p className="mt-2 text-sm text-white">Current target {targetLabel}</p>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-full border border-sky-100/15 px-3 py-1 text-xs text-sky-50"
        >
          Close
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <AlignmentTargetButton
          label="Sun"
          target="sun"
          selected={selectedTarget === 'sun'}
          available={availability.sun}
          onSelect={onSelectTarget}
        />
        <AlignmentTargetButton
          label="Moon"
          target="moon"
          selected={selectedTarget === 'moon'}
          available={availability.moon}
          onSelect={onSelectTarget}
        />
      </div>
      <div className="mt-3 rounded-2xl border border-sky-100/10 bg-white/5 px-4 py-3 text-sm leading-6 text-sky-100/80">
        {status}
      </div>
      {supportingNotice ? (
        <p
          className={`mt-3 rounded-2xl border px-4 py-3 text-sm leading-6 ${
            supportingNotice.tone === 'warning'
              ? 'border-amber-200/15 bg-amber-300/10 text-amber-50/85'
              : 'border-sky-100/10 bg-white/5 text-sky-100/80'
          }`}
        >
          {supportingNotice.text}
        </p>
      ) : null}
      <div
        className="mt-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/10 px-4 py-3 text-sm leading-6 text-emerald-50/90"
        data-testid="alignment-next-action"
      >
        <p className="font-semibold text-white">{primaryStep.title}</p>
        <p className="mt-1">{primaryStep.body}</p>
      </div>
      {showStartAlignmentAction && primaryStep.ctaLabel ? (
        <div className={`mt-3 ${compact ? '' : 'sm:max-w-xs'}`}>
          <button
            type="button"
            onClick={onStartAlignment}
            disabled={!canStartAlignment}
            data-testid="alignment-start-action"
            className="min-h-11 rounded-2xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-emerald-100"
          >
            {primaryStep.ctaLabel}
          </button>
        </div>
      ) : null}
      <section className="mt-4 rounded-2xl border border-sky-100/10 bg-slate-950/30 px-4 py-3">
        <p className="text-xs uppercase tracking-[0.18em] text-sky-200/55">Calibration tools</p>
        <div className={`mt-3 ${compact ? '' : 'sm:max-w-xs'}`}>
          <button
            type="button"
            onClick={onResetCalibration}
            disabled={!canResetCalibration}
            className="min-h-11 w-full rounded-2xl border border-sky-100/10 bg-slate-950/35 px-4 py-3 text-sm text-sky-50 disabled:cursor-not-allowed disabled:text-sky-100/45"
          >
            Reset calibration
          </button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {ALIGNMENT_FINE_ADJUST_CONTROLS.map((control) => (
            <button
              key={control.label}
              type="button"
              onClick={() =>
                onFineAdjustCalibration({
                  axis: control.axis,
                  deltaDeg: control.deltaDeg,
                })
              }
              className="min-h-11 rounded-2xl border border-sky-100/10 bg-white/5 px-4 py-3 text-sm text-sky-50"
            >
              {control.label}
            </button>
          ))}
        </div>
      </section>
    </>
  )
}

function AlignmentTargetButton({
  label,
  target,
  selected,
  onSelect,
}: {
  label: 'Sun' | 'Moon'
  target: AlignmentTargetPreference
  selected: boolean
  available: boolean
  onSelect: (target: AlignmentTargetPreference) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(target)}
      aria-pressed={selected}
      aria-label={`Use ${label} for alignment`}
      className={`flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm ${
        selected
          ? 'border-amber-200/45 bg-amber-200/12 text-amber-50'
          : 'border-sky-100/10 bg-white/5 text-sky-50'
      }`}
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

function buildSceneSnapshot({
  observer,
  timeMs,
  enabledLayers,
  likelyVisibleOnly,
  scopeModeEnabled,
  scopeOptics,
  focusedObjectId,
  aircraftTracker,
  aircraftRevision: _aircraftRevision,
  satelliteCatalog,
}: {
  observer: ObserverState
  timeMs: number
  enabledLayers: Record<EnabledLayer, boolean>
  likelyVisibleOnly: boolean
  scopeModeEnabled: boolean
  scopeOptics: ScopeOptics
  focusedObjectId: string | null
  aircraftTracker: AircraftTracker | null
  aircraftRevision: number
  satelliteCatalog: TleApiResponse | null
}): SceneSnapshot {
  void _aircraftRevision

  try {
    const celestial = normalizeCelestialObjects({
      observer,
      timeMs,
      enabledLayers,
      likelyVisibleOnly,
      focusedObjectId,
    })
    const stars = normalizeVisibleStars({
      observer,
      timeMs,
      enabledLayers,
      likelyVisibleOnly,
      sunAltitudeDeg: celestial.sunAltitudeDeg,
      scopeModeEnabled,
      scopeOptics,
    })
    let aircraft: SkyObject[] = []
    let satellites: SkyObject[] = []

    try {
      aircraft = resolveAircraftMotionObjects({
        tracker: aircraftTracker,
        timeMs,
        observer,
        enabledLayers,
      }).map(({ object }) => object)
    } catch {
      aircraft = []
    }

    try {
      satellites = resolveSatelliteMotionObjects({
        catalog: satelliteCatalog,
        observer,
        timeMs,
        enabledLayers,
        likelyVisibleOnly,
        sunAltitudeDeg: celestial.sunAltitudeDeg,
      }).map(({ object }) => object)
    } catch {
      satellites = []
    }

    return {
      objects: [
        ...aircraft,
        ...celestial.objects,
        ...satellites,
        ...stars.map((entry) => entry.object),
      ],
      visibleStars: stars,
      sunAltitudeDeg: celestial.sunAltitudeDeg,
      error: null,
    }
  } catch (error) {
    return {
      ...EMPTY_SCENE_SNAPSHOT,
      error: error instanceof Error ? error.message : 'Unknown astronomy failure.',
    }
  }
}

function formatSkyObjectSublabel(object: SkyObject) {
  switch (object.type) {
    case 'aircraft':
    case 'satellite': {
      const baseLabel = object.type === 'aircraft' ? 'Aircraft' : 'Satellite'
      const motionLabel = getMovingObjectMotionLabel(object)

      return motionLabel ? `${baseLabel} ${motionLabel}` : baseLabel
    }
    case 'sun':
      return 'Sun'
    case 'moon':
      return 'Moon'
    case 'planet':
      return 'Planet'
    case 'star':
      return 'Star'
    case 'constellation':
      return 'Major star pattern'
    default:
      return object.sublabel ?? object.type
  }
}

function getDetailRows(object: SkyObject) {
  const detail = object.metadata.detail as Record<string, unknown> | undefined

  switch (object.type) {
    case 'aircraft': {
      const aircraftDetail = detail as Partial<AircraftDetailMetadata> | undefined

      return [
        { label: 'Type', value: String(aircraftDetail?.typeLabel ?? 'Aircraft') },
        {
          label: 'Altitude',
          value: `${Math.round(aircraftDetail?.altitudeFeet ?? 0).toLocaleString()} ft / ${Math.round(aircraftDetail?.altitudeMeters ?? 0).toLocaleString()} m`,
        },
        ...(aircraftDetail?.trackCardinal
          ? [{ label: 'Track', value: aircraftDetail.trackCardinal }]
          : []),
        ...(typeof aircraftDetail?.speedKph === 'number'
          ? [{ label: 'Speed', value: `${Math.round(aircraftDetail.speedKph)} km/h` }]
          : []),
        { label: 'Range', value: `${(object.rangeKm ?? aircraftDetail?.rangeKm ?? 0).toFixed(1)} km` },
        ...(aircraftDetail?.originCountry
          ? [{ label: 'Origin country', value: aircraftDetail.originCountry }]
          : []),
      ]
    }
    case 'satellite': {
      const satelliteDetail = detail as Partial<SatelliteDetailMetadata> | undefined

      return [
        { label: 'Type', value: String(satelliteDetail?.typeLabel ?? 'Satellite') },
        { label: 'NORAD ID', value: String(satelliteDetail?.noradId ?? object.id) },
        {
          label: 'Elevation',
          value: formatDegrees(satelliteDetail?.elevationDeg ?? object.elevationDeg),
        },
        {
          label: 'Azimuth',
          value: formatDegrees(satelliteDetail?.azimuthDeg ?? object.azimuthDeg),
        },
        ...(typeof satelliteDetail?.rangeKm === 'number'
          ? [{ label: 'Range', value: `${satelliteDetail.rangeKm.toFixed(1)} km` }]
          : []),
      ]
    }
    case 'sun':
    case 'moon':
    case 'planet':
      return [
        { label: 'Type', value: String(detail?.typeLabel ?? object.type) },
        { label: 'Elevation', value: formatDegrees(detail?.elevationDeg ?? object.elevationDeg) },
        { label: 'Azimuth', value: formatDegrees(detail?.azimuthDeg ?? object.azimuthDeg) },
        ...(detail?.constellationName
          ? [{ label: 'Constellation', value: String(detail.constellationName) }]
          : []),
        ...(typeof detail?.magnitude === 'number'
          ? [{ label: 'Magnitude', value: Number(detail.magnitude).toFixed(2) }]
          : []),
      ]
    case 'star':
      return [
        { label: 'Type', value: String(detail?.typeLabel ?? 'Star') },
        { label: 'Magnitude', value: Number(detail?.magnitude ?? object.magnitude ?? 0).toFixed(2) },
        { label: 'Elevation', value: formatDegrees(detail?.elevationDeg ?? object.elevationDeg) },
        ...(detail?.constellationName
          ? [{ label: 'Constellation', value: String(detail.constellationName) }]
          : []),
      ]
    case 'constellation':
      return [
        { label: 'Type', value: String(detail?.typeLabel ?? 'Constellation') },
        { label: 'Pattern', value: String(detail?.summaryText ?? 'Major star pattern') },
      ]
    default:
      return []
  }
}

function renderObjectBadges(object: SkyObject) {
  const motionBadge = getMovingObjectMotionBadge(object)
  const badges: ReactElement[] = []

  if (motionBadge) {
    badges.push(
      <span
        key={`motion-${motionBadge.label}`}
        data-testid="object-badge"
        data-badge-id={`motion-${motionBadge.label.toLowerCase()}`}
        className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${motionBadge.className}`}
      >
        {motionBadge.label}
      </span>,
    )
  }

  if (object.metadata.isIss === true) {
    badges.push(
      <span
        key="iss"
        data-testid="object-badge"
        data-badge-id="iss"
        className="rounded-full border border-amber-200/45 bg-amber-200/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-50"
      >
        ISS
      </span>,
    )
  }

  if (badges.length === 0) {
    return null
  }

  return badges
}

function getMovingObjectMotionLabel(object: SkyObject) {
  if (object.type !== 'aircraft' && object.type !== 'satellite') {
    return null
  }

  switch (getMovingObjectMotionState(object)) {
    case 'estimated':
      return 'Estimated'
    case 'stale':
      return 'Stale'
    default:
      return null
  }
}

function getMovingObjectMotionBadge(object: SkyObject) {
  if (object.type !== 'aircraft' && object.type !== 'satellite') {
    return null
  }

  switch (getMovingObjectMotionState(object)) {
    case 'estimated':
      return {
        label: 'Estimated',
        className: 'border-cyan-100/40 bg-cyan-200/12 text-cyan-50',
      }
    case 'stale':
      return {
        label: 'Stale',
        className: 'border-slate-100/25 bg-slate-100/10 text-slate-100',
      }
    default:
      return null
  }
}

function getMovingObjectMotionState(object: SkyObject): MovingObjectMotionState | null {
  if (object.type !== 'aircraft' && object.type !== 'satellite') {
    return null
  }

  const motionState = object.metadata.motionState

  switch (motionState) {
    case 'estimated':
    case 'stale':
    case 'propagated':
      return motionState
    default:
      return null
  }
}

function getObjectMotionOpacity(object: SkyObject) {
  const motionOpacity = object.metadata.motionOpacity

  if (typeof motionOpacity !== 'number' || !Number.isFinite(motionOpacity)) {
    return 1
  }

  return clampNumber(motionOpacity, 0, 1)
}

function formatDegrees(value: unknown) {
  return `${Number(value ?? 0).toFixed(1)}°`
}

function badgeValue(status: PermissionStatusValue) {
  switch (status) {
    case 'granted':
      return 'Ready'
    case 'denied':
      return 'Denied'
    case 'unknown':
      return 'Pending'
    default:
      return 'Unavailable'
  }
}

function getObserverStatusValue(
  observer: ObserverState,
  observerSource: 'geo' | 'manual' | null,
) {
  if (observerSource === 'manual' || observer.source === 'manual') {
    return 'Manual observer'
  }

  return `Ready ±${Math.round(observer.accuracyMeters ?? 0)}m`
}

function getBlockingCopy(state: ViewerRouteState, startupState: StartupState) {
  if (startupState === 'unsupported') {
    return {
      title: 'Live AR requires a secure context.',
      body: 'Open SkyLens from HTTPS or localhost so camera, geolocation, and motion sensors are allowed to start in the viewer.',
    }
  }

  if (startupState === 'error') {
    return {
      title: 'SkyLens could not finish startup.',
      body: 'Retry from this viewer to request motion, start the rear camera, and recover location or manual observer state in the same live flow.',
    }
  }

  if (startupState === 'camera-only') {
    return {
      title: 'Observer location still needs input.',
      body: 'SkyLens can keep the viewer open, but it needs either a geolocation fix or your manual latitude, longitude, and altitude before it can place sky labels accurately.',
    }
  }

  if (startupState === 'requesting') {
    return {
      title: 'SkyLens is starting live AR.',
      body: 'The viewer is requesting motion access first, starting the rear camera second, and resolving location third so the live session stays in one activation path.',
    }
  }

  if (
    state.location === 'unknown' ||
    state.camera === 'unknown' ||
    state.orientation === 'unknown'
  ) {
    return {
      title: 'Start AR from this viewer.',
      body: 'The viewer owns the live startup flow now. Use Start AR here to request motion access, attach the rear camera inline, and then resolve location or manual observer fallback.',
    }
  }

  return {
    title: 'Observer location still needs input.',
    body: 'SkyLens keeps the viewer available, but geolocation did not resolve. Enter a manual observer or retry location without losing the live session.',
  }
}

function blockingEyebrow(state: ViewerRouteState, startupState: StartupState) {
  if (
    startupState === 'ready-to-request' ||
    startupState === 'requesting' ||
    state.location === 'unknown' ||
    state.camera === 'unknown' ||
    state.orientation === 'unknown'
  ) {
    return 'Start required'
  }

  if (startupState === 'unsupported') {
    return 'Secure context required'
  }

  return 'Observer required'
}

function getMotionBadgeValue(
  experienceMode: RuntimeExperience['mode'],
  state: ViewerRouteState,
  startupState: StartupState,
  orientationSource: OrientationSource | null,
  latestOrientationSample: OrientationSample | null,
) {
  if (
    (experienceMode === 'blocked' && startupState === 'requesting') ||
    startupState === 'awaiting-orientation'
  ) {
    return 'Pending'
  }

  if (experienceMode === 'blocked') {
    return badgeValue(state.orientation)
  }

  if (experienceMode === 'manual-pan') {
    return 'Manual pan'
  }

  if (state.orientation !== 'granted') {
    return badgeValue(state.orientation)
  }

  if (!latestOrientationSample) {
    return experienceMode === 'non-camera' || startupState === 'camera-only'
      ? 'Settling'
      : 'Pending'
  }

  switch (orientationSource) {
    case 'absolute-sensor':
      return 'Absolute sensor'
    case 'relative-sensor':
      return 'Relative sensor'
    case 'deviceorientation-absolute':
      return 'Absolute event'
    case 'deviceorientation-relative':
      return 'Relative event'
    default:
      return 'Manual'
  }
}

function createDefaultSensorCameraPose(): CameraPose {
  return {
    yawDeg: 0,
    pitchDeg: 0,
    rollDeg: 0,
    quaternion: createCameraQuaternion(0, 0, 0),
    alignmentHealth: 'fair',
    mode: 'sensor',
  }
}

function alignmentBadgeValue(
  state: ViewerRouteState,
  cameraPose: CameraPose,
  startupState: StartupState,
) {
  if (state.entry === 'demo') {
    return 'Demo controls'
  }

  if (startupState === 'ready-to-request' || startupState === 'requesting') {
    return 'Pending start'
  }

  if (startupState === 'unsupported') {
    return 'HTTPS required'
  }

  if (startupState === 'camera-only') {
    return 'Observer needed'
  }

  if (cameraPose.mode === 'manual') {
    return 'Manual pan'
  }

  if (startupState === 'sensor-relative-needs-calibration') {
    return 'Align first'
  }

  if (cameraPose.alignmentHealth === 'good') {
    return 'Alignment good'
  }

  if (cameraPose.alignmentHealth === 'poor') {
    return 'Alignment poor'
  }

  return 'Alignment fair'
}

export function getPermissionRecoveryAction(state: ViewerRouteState) {
  if (state.camera !== 'granted' && state.orientation !== 'granted') {
    return {
      kind: 'camera-and-motion' as const,
      label: 'Enable camera and motion',
      pendingLabel: 'Starting AR...',
    }
  }

  if (state.camera !== 'granted') {
    return {
      kind: 'camera-only' as const,
      label: 'Enable camera',
      pendingLabel: 'Starting AR...',
    }
  }

  if (state.orientation !== 'granted') {
    return {
      kind: 'motion-only' as const,
      label: 'Enable motion',
      pendingLabel: 'Retrying motion...',
    }
  }

  return {
    kind: 'none' as const,
    label: 'Enable AR',
    pendingLabel: 'Starting AR...',
  }
}

function describeRuntimeExperience({
  state,
  startupState,
  hasObserver,
}: {
  state: ViewerRouteState
  startupState: StartupState
  hasObserver: boolean
}): RuntimeExperience {
  if (state.entry === 'demo') {
    return {
      mode: 'demo',
      title: 'Demo viewer',
      body: 'The live overlay shell is running against a non-camera demo backdrop so SkyLens stays presentable after denial or on desktop.',
    }
  }

  if (
    startupState === 'unsupported' ||
    startupState === 'ready-to-request' ||
    startupState === 'requesting' ||
    startupState === 'error'
  ) {
    return {
      mode: 'blocked',
      title: getBlockingCopy(state, startupState).title,
      body: getBlockingCopy(state, startupState).body,
    }
  }

  if (startupState === 'awaiting-orientation') {
    return {
      mode: state.camera === 'granted' ? 'live' : 'non-camera',
      title: 'Waiting for motion',
      body: 'SkyLens requested motion access and is waiting for the first usable sample before it marks orientation ready.',
    }
  }

  if (startupState === 'camera-only' || !hasObserver) {
    return {
      mode: state.orientation !== 'granted' ? 'manual-pan' : 'live',
      title: 'Manual observer needed',
      body: 'Enter a manual observer or retry location. Camera and motion can stay live while SkyLens waits for a usable observer.',
    }
  }

  if (state.orientation !== 'granted' || startupState === 'manual') {
    return {
      mode: 'manual-pan',
      title: 'Manual pan fallback',
      body: 'SkyLens is keeping the viewer active with manual panning until motion access becomes available again.',
    }
  }

  if (state.camera !== 'granted') {
    return {
      mode: 'non-camera',
      title: 'Non-camera fallback',
      body: 'SkyLens is keeping the viewer active without the live camera feed and will render over a dark gradient background.',
    }
  }

  return {
    mode: 'live',
    title: 'Live viewer',
    body: 'Permissions are in place and the viewer shell is ready for the live overlay pipeline.',
  }
}

function resolveStartupState({
  orientationStatus,
  cameraStatus,
  hasObserver,
  orientationNeedsCalibration = false,
  orientationAbsolute = true,
}: {
  orientationStatus: PermissionStatusValue
  cameraStatus: PermissionStatusValue
  hasObserver: boolean
  orientationNeedsCalibration?: boolean
  orientationAbsolute?: boolean
}): StartupState {
  void cameraStatus

  if (orientationStatus === 'unknown') {
    return 'awaiting-orientation'
  }

  if (orientationStatus !== 'granted') {
    return 'manual'
  }

  if (orientationNeedsCalibration || !orientationAbsolute) {
    return 'sensor-relative-needs-calibration'
  }

  if (!hasObserver) {
    return 'camera-only'
  }

  return 'sensor-absolute'
}

function createManualObserverDraft(
  manualObserver: ManualObserverSettings | null,
): ManualObserverDraft {
  return {
    lat: manualObserver ? String(manualObserver.lat) : '',
    lon: manualObserver ? String(manualObserver.lon) : '',
    altMeters: manualObserver ? String(manualObserver.altMeters) : '0',
  }
}

function createObserverStateFromManualSettings(
  manualObserver: ManualObserverSettings | null,
): ObserverState | null {
  if (!manualObserver) {
    return null
  }

  return {
    lat: manualObserver.lat,
    lon: manualObserver.lon,
    altMeters: manualObserver.altMeters,
    accuracyMeters: undefined,
    timestampMs: getCurrentTimestampMs(),
    source: 'manual',
  }
}

function getCurrentTimestampMs() {
  return Date.now()
}

function parseManualObserverDraft(
  draft: ManualObserverDraft,
): ManualObserverSettings | null {
  const lat = Number(draft.lat)
  const lon = Number(draft.lon)
  const altMeters = Number(draft.altMeters)

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    !Number.isFinite(altMeters) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return null
  }

  return {
    lat,
    lon,
    altMeters,
  }
}

function ManualObserverPanel({
  draft,
  error,
  onDraftChange,
  onRetryLocation,
  onSubmit,
  isPending,
}: {
  draft: ManualObserverDraft
  error: string | null
  onDraftChange: (field: keyof ManualObserverDraft, value: string) => void
  onRetryLocation: () => void
  onSubmit: () => void
  isPending: boolean
}) {
  return (
    <section className="pointer-events-auto rounded-[1.5rem] border border-sky-100/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-amber-200/70">Manual observer</p>
      <p className="mt-2 text-sm leading-6 text-sky-100/80">
        Enter latitude, longitude, and altitude so SkyLens can keep projecting labels when
        geolocation is denied or times out.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm text-sky-50">
          <span>Latitude</span>
          <input
            aria-label="Latitude"
            type="number"
            inputMode="decimal"
            value={draft.lat}
            onChange={(event) => onDraftChange('lat', event.target.value)}
            className="rounded-xl border border-sky-100/15 bg-slate-950/50 px-3 py-2 text-sky-50"
          />
        </label>
        <label className="grid gap-1 text-sm text-sky-50">
          <span>Longitude</span>
          <input
            aria-label="Longitude"
            type="number"
            inputMode="decimal"
            value={draft.lon}
            onChange={(event) => onDraftChange('lon', event.target.value)}
            className="rounded-xl border border-sky-100/15 bg-slate-950/50 px-3 py-2 text-sky-50"
          />
        </label>
        <label className="grid gap-1 text-sm text-sky-50">
          <span>Altitude (m)</span>
          <input
            aria-label="Altitude"
            type="number"
            inputMode="decimal"
            value={draft.altMeters}
            onChange={(event) => onDraftChange('altMeters', event.target.value)}
            className="rounded-xl border border-sky-100/15 bg-slate-950/50 px-3 py-2 text-sky-50"
          />
        </label>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onSubmit}
          className="rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950"
        >
          Save observer
        </button>
        <button
          type="button"
          onClick={onRetryLocation}
          disabled={isPending}
          className="rounded-full border border-sky-100/20 px-4 py-2 text-sm font-semibold text-sky-50 disabled:cursor-wait disabled:opacity-70"
        >
          {isPending ? 'Retrying...' : 'Retry location'}
        </button>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-amber-200" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
