'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react'

import {
  fetchAircraftSnapshot,
  getAircraftAvailabilityMessage,
} from '../../lib/aircraft/client'
import type { AircraftApiResponse, AircraftAvailability } from '../../lib/aircraft/contracts'
import {
  getDemoScenario,
  listDemoScenarios,
  type DemoScenarioId,
} from '../../lib/demo/scenarios'
import {
  HealthApiResponseSchema,
  type HealthApiResponse,
} from '../../lib/health/contracts'
import {
  type EnabledLayer,
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
} from '../../lib/viewer/alignment-tutorial'
import {
  markViewerOnboardingCompleted,
  readViewerSettings,
  writeViewerSettings,
  type ManualObserverSettings,
  type MotionQuality,
} from '../../lib/viewer/settings'
import { SettingsSheet } from '../settings/settings-sheet'

type ViewerShellProps = {
  initialState: ViewerRouteState
}

type ProjectedSkyObject = SkyObject & {
  projection: ReturnType<typeof projectWorldPointToScreen>
}

type OnObjectLabel = RankedLabelPlacement<ProjectedSkyObject>
type MotionAffordanceSample = {
  id: string
  x: number
  y: number
}

type StartupState =
  | 'unsupported'
  | 'ready-to-request'
  | 'requesting'
  | 'camera-only'
  | 'sensor-relative-needs-calibration'
  | 'sensor-absolute'
  | 'manual'
  | 'error'

type RuntimeExperience = {
  mode: 'blocked' | 'live' | 'non-camera' | 'manual-pan' | 'demo' | 'camera-only'
  title: string
  body: string
}

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

type AircraftTemporalState = {
  currentSnapshot: AircraftApiResponse | null
  previousSnapshot: AircraftApiResponse | null
  transitionStartedAtMs: number | null
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
const SCENE_CLOCK_FRAME_INTERVAL_MS: Record<Exclude<MotionQuality, 'low'>, number> = {
  balanced: 1_000 / 15,
  high: 1_000 / 30,
}
const MOTION_AFFORDANCE_SAMPLE_LIMITS: Record<MotionQuality, number> = {
  low: 2,
  balanced: 8,
  high: 16,
}
const COMPACT_MOBILE_OVERLAY_MAX_HEIGHT =
  'calc(100dvh - (2rem + env(safe-area-inset-top) + env(safe-area-inset-bottom)))'
const COMPACT_ALIGNMENT_PANEL_MAX_HEIGHT =
  'calc(100dvh - (6.5rem + env(safe-area-inset-bottom)))'

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
  const [astronomyFailureBanner, setAstronomyFailureBanner] = useState<string | null>(null)
  const [aircraftTemporalState, setAircraftTemporalState] = useState<AircraftTemporalState>({
    currentSnapshot: null,
    previousSnapshot: null,
    transitionStartedAtMs: null,
  })
  const [aircraftAvailability, setAircraftAvailability] = useState<AircraftAvailability>(
    'available',
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
  const [manualAlignmentTargetPreference, setManualAlignmentTargetPreference] =
    useState<AlignmentTargetPreference | null>(null)
  const [hasManualAlignmentTargetOverride, setHasManualAlignmentTargetOverride] = useState(false)
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
  const [isAlignmentPanelOpen, setIsAlignmentPanelOpen] = useState(false)
  const [isMobileAlignmentFocusActive, setIsMobileAlignmentFocusActive] = useState(false)
  const [motionRetryError, setMotionRetryError] = useState<string | null>(null)
  const [manualObserverError, setManualObserverError] = useState<string | null>(null)
  const [manualObserverDraft, setManualObserverDraft] = useState<ManualObserverDraft>(() =>
    createManualObserverDraft(persistedViewerSettings.manualObserver),
  )
  const orientationControllerRef = useRef<ReturnType<typeof subscribeToOrientationPose> | null>(
    null,
  )
  const videoElementRef = useRef<HTMLVideoElement | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const cameraRequestIdRef = useRef(0)
  const lastOpenedCameraPreferenceRef = useRef<string | null>(null)
  const liveObserverRef = useRef<ObserverState | null>(persistedManualObserver)
  const sceneTimeMsRef = useRef(sceneTimeMs)
  const poorSinceRef = useRef<number | null>(null)
  const dragRef = useRef<{
    pointerId: number
    clientX: number
    clientY: number
    moved: boolean
  } | null>(null)
  const lastTapAtRef = useRef(0)
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
  const locationError = state.entry === 'demo' ? null : liveLocationError
  const manualMode =
    experience.mode === 'demo' || experience.mode === 'manual-pan'
  const cameraPose = manualMode
    ? createManualCameraPose(manualPoseState)
    : sensorCameraPose
  const shouldPollAircraft =
    state.entry !== 'demo' && hasLiveSessionStarted && observer !== null && enabledLayers.aircraft
  const activeAircraftSnapshot = shouldPollAircraft ? aircraftTemporalState.currentSnapshot : null
  const activeAircraftPreviousSnapshot =
    shouldPollAircraft ? aircraftTemporalState.previousSnapshot : null
  const activeAircraftTransitionStartedAtMs =
    shouldPollAircraft ? aircraftTemporalState.transitionStartedAtMs : null
  const demoAircraftSnapshot = state.entry === 'demo' ? demoScenario.aircraftSnapshot : null
  const activeAircraftData = demoAircraftSnapshot ?? activeAircraftSnapshot
  const activeAircraftAvailability =
    state.entry === 'demo'
      ? demoScenario.aircraftSnapshot.availability
      : shouldPollAircraft
        ? aircraftAvailability
        : 'available'
  const activeSatelliteCatalog =
    state.entry === 'demo' ? demoScenario.satelliteCatalog : satelliteCatalog
  const sceneSnapshot = observer
    ? buildSceneSnapshot({
        observer,
        timeMs: sceneTimeMs,
        enabledLayers,
        likelyVisibleOnly,
        focusedObjectId: selectedObjectId,
        aircraftSnapshot: activeAircraftData,
        aircraftPreviousSnapshot: state.entry === 'demo' ? null : activeAircraftPreviousSnapshot,
        aircraftTransitionStartedAtMs:
          state.entry === 'demo' ? null : activeAircraftTransitionStartedAtMs,
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
    cameraPose,
    startupState,
    orientationSource,
  )
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
    hasManualAlignmentTargetOverride && manualAlignmentTargetPreference
      ? manualAlignmentTargetPreference
      : defaultAlignmentTargetPreference
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
  const centerLockedCandidate = pickCenterLockedCandidate(
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
  const centerLockedObject =
    projectedObjects.find((object) => object.id === centerLockedCandidate?.id) ?? null
  const markerObjects = projectedObjects.filter(
    (object) =>
      object.projection.visible &&
      (!isCelestialDaylightLabelSuppressed(object) ||
        object.id === centerLockedObject?.id ||
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
          centerLockedObjectId: centerLockedObject?.id ?? null,
        })
      : []
  const topListObjects =
    viewerSettings.labelDisplayMode === 'top_list'
      ? [...markerLabelCandidates]
          .sort((left, right) =>
            compareLabelCandidates(left, right, {
              centerLockedObjectId: centerLockedObject?.id ?? null,
            }),
          )
          .map((candidate) => candidate.object)
      : []
  const selectedObject =
    projectedObjects.find((object) => object.id === selectedObjectId) ?? null
  const selectedDetailObject = selectedObject
  const activeSummaryObject = selectedObject ?? centerLockedObject
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
  const renderedLineSegments = hasMounted ? constellationScene.lineSegments : []
  const renderedMarkerObjects = hasMounted ? markerObjects : []
  const renderedOnObjectLabels = hasMounted ? onObjectLabels : []
  const renderedTopListObjects = hasMounted ? topListObjects : []
  const renderedCenterLockedObject = hasMounted ? centerLockedObject : null
  const renderedSelectedDetailObject = hasMounted ? selectedDetailObject : null
  const renderedActiveSummaryObject = hasMounted ? activeSummaryObject : null
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
    canResetCalibration,
    manualMode,
    preferredTargetUnavailable: calibrationTargetResolution.preferredTargetUnavailable,
  })
  const sensorStatusValue = getSensorStatusValue({
    startupState,
    orientationSource,
    orientationAbsolute,
    cameraPose,
  })
  const showMobilePermissionAction =
    state.entry === 'live' &&
    (state.camera !== 'granted' || state.orientation !== 'granted')
  const showMobileAlignAction = state.entry === 'live' && !isMobileAlignmentFocusActive
  const mobilePermissionActionLabel = getMobilePermissionActionLabel(state)
  const activeLiveCameraStage = state.entry === 'live' && cameraStreamActive
  const shouldLockViewerScroll = activeLiveCameraStage || isMobileAlignmentFocusActive
  const usesCameraStageAlignmentFocus =
    state.entry === 'live' && cameraStreamActive && !manualMode
  const shouldUseCompactNonScrollingOverlay = activeLiveCameraStage && !manualMode

  const handleAlignmentTargetPreferenceChange = useCallback(
    (target: AlignmentTargetPreference) => {
      setHasManualAlignmentTargetOverride(true)
      setManualAlignmentTargetPreference(target)
    },
    [],
  )

  const openAlignmentExperience = () => {
    setShowAlignmentGuidance(false)
    setIsMobileOverlayOpen(false)
    setIsAlignmentPanelOpen(true)
    setIsMobileAlignmentFocusActive(false)
  }

  const startAlignmentFocus = () => {
    if (!usesCameraStageAlignmentFocus || !canAlignCalibration) {
      return
    }

    setShowAlignmentGuidance(false)
    setIsMobileOverlayOpen(false)
    setIsAlignmentPanelOpen(false)
    setIsMobileAlignmentFocusActive(true)
  }

  const closeAlignmentExperience = () => {
    setIsAlignmentPanelOpen(false)
    setIsMobileAlignmentFocusActive(false)
  }

  const commitViewerRouteState = (nextState: ViewerRouteState) => {
    setState(nextState)
    router.replace(buildViewerHref(nextState))
  }

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
      markViewerOnboardingCompleted()
      setViewerSettings((current) => ({
        ...current,
        onboardingCompleted: true,
      }))
      setLiveObserver(null)
      setObserverSource(null)
      setLiveLocationError(null)

      try {
        const orientation = await requestOrientationPermission()
        let camera: PermissionStatusValue = 'unknown'

        try {
          await openLiveCamera(viewerSettings.selectedCameraDeviceId)
          camera = 'granted'
        } catch {
          camera = 'denied'
        }

        const observerResult = await requestInitialObserver()
        const nextState: ViewerRouteState = {
          ...state,
          orientation,
          camera,
          location: observerResult.locationStatus,
        }

        setSelectedObjectId(null)
        setMotionAffordanceSamples([])
        setSceneTimeMs(getCurrentTimestampMs())
        commitViewerRouteState(nextState)
        setStartupState(
          resolveStartupState({
            orientationStatus: orientation,
            cameraStatus: camera,
            hasObserver: observerResult.hasObserver,
            orientationNeedsCalibration: false,
          }),
        )
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
      try {
        const orientation = await requestOrientationPermission()

        if (state.entry === 'live') {
          const nextState: ViewerRouteState = {
            ...state,
            orientation,
          }

          commitViewerRouteState(nextState)
          setStartupState(
            resolveStartupState({
              orientationStatus: orientation,
              cameraStatus: state.camera,
              hasObserver: observer !== null,
              orientationNeedsCalibration: startupState === 'sensor-relative-needs-calibration',
            }),
          )
        }

        if (orientation !== 'granted') {
          setMotionRetryError(
            orientation === 'denied'
              ? 'Motion access is still denied. Check iOS Settings → Safari → Motion & Orientation Access, then retry.'
              : 'Motion sensors are unavailable on this device/browser right now.',
          )
        }
      } catch {
        setMotionRetryError('Unable to retry motion permission right now.')
      }
    })
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
        const response = await fetch('/api/health', {
          cache: 'no-store',
        })

        if (!response.ok) {
          return
        }

        const payload = HealthApiResponseSchema.parse(await response.json())

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
    if (!shouldPollAircraft || !observer) {
      return
    }

    let disposed = false

    const refreshAircraft = async () => {
      try {
        const nextSnapshot = await fetchAircraftSnapshot(observer)

        if (!disposed) {
          setAircraftTemporalState((current) => ({
            currentSnapshot: nextSnapshot,
            previousSnapshot: current.currentSnapshot,
            transitionStartedAtMs: getCurrentTimestampMs(),
          }))
          setAircraftAvailability(nextSnapshot.availability)
        }
      } catch {
        if (!disposed) {
          setAircraftAvailability('degraded')
        }
      }
    }

    void refreshAircraft()

    const intervalId = window.setInterval(() => {
      void refreshAircraft()
    }, 10_000)

    return () => {
      disposed = true
      window.clearInterval(intervalId)
    }
  }, [
    observer,
    shouldPollAircraft,
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
    orientationControllerRef.current?.stop()
    orientationControllerRef.current = null
    poorSinceRef.current = null

    if (!hasLiveSessionStarted || manualMode) {
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
        setStartupState(
          resolveStartupState({
            orientationStatus: 'granted',
            cameraStatus: state.camera,
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

      poorSinceRef.current = null
      setCalibrationBanner(null)
      setOrientationSource(null)
      setOrientationAbsolute(state.orientation === 'granted')
      setOrientationNeedsCalibration(false)
      setLatestOrientationSample(null)
    }
  }, [
    hasLiveSessionStarted,
    manualMode,
    state.camera,
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
    openAlignmentExperience()
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
    nextAction: alignmentTutorial.nextAction,
    notices: alignmentTutorial.notices,
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
    onSelectedCameraDeviceChange: (deviceId: string) => {
      setViewerSettings((current) => ({
        ...current,
        selectedCameraDeviceId: deviceId || null,
      }))
    },
  }
  const motionRecoveryPanel =
    state.entry !== 'demo' && state.orientation !== 'granted' ? (
      <section className="rounded-[1.25rem] border border-sky-100/10 bg-white/5 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-200/70">Motion recovery</p>
        <p className="mt-2 text-sm leading-6 text-sky-100/80">
          On iPhone Safari, enable motion in iOS Settings → Safari → Motion & Orientation
          Access, then return and retry.
        </p>
        <button
          type="button"
          onClick={handleRetryMotionPermission}
          disabled={isPending}
          className="mt-3 rounded-full border border-sky-100/20 px-4 py-2 text-sm font-semibold text-sky-50 disabled:cursor-wait disabled:opacity-70"
        >
          {isPending ? 'Retrying motion...' : 'Enable motion'}
        </button>
        {motionRetryError ? (
          <p className="mt-3 text-sm text-amber-200" role="alert">
            {motionRetryError}
          </p>
        ) : null}
      </section>
    ) : null
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
              {alignmentTutorial.focusPrompt}
            </div>
          </div>
        ) : null}
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
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
                    object.id === selectedObject?.id || object.id === centerLockedObject?.id
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
        {renderedMarkerObjects.map((object) => (
          <button
            key={object.id}
            type="button"
            onClick={() =>
              setSelectedObjectId((current) => (current === object.id ? null : object.id))
            }
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
                centerLockedObjectId: centerLockedObject?.id ?? null,
                selectedObjectId,
              })}`}
              style={{
                width: `${getMarkerSizePx(object, viewerSettings.verticalFovAdjustmentDeg)}px`,
                height: `${getMarkerSizePx(object, viewerSettings.verticalFovAdjustmentDeg)}px`,
              }}
            />
          </button>
        ))}
        {renderedOnObjectLabels.map((object) => (
          <div
            key={object.object.id}
            data-testid="sky-object-label"
            data-object-id={object.object.id}
            className={`pointer-events-none absolute rounded-2xl border px-3 py-2 text-left text-xs shadow-[0_12px_30px_rgba(3,7,13,0.22)] ${
              object.object.id === selectedObject?.id || object.object.id === centerLockedObject?.id
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
              <span className="sr-only">{alignmentTutorial.focusPrompt}</span>
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
        <header
          className="hidden items-start justify-between gap-3 sm:flex"
          data-testid="desktop-viewer-header"
        >
          <div className="pointer-events-auto shell-panel rounded-[1.5rem] px-4 py-3">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-sky-200/65">
                  SkyLens
                </p>
                <p className="text-sm text-sky-50/90">{experience.title}</p>
              </div>
              <div className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100/85">
                {alignmentBadgeValue(state, cameraPose, startupState)}
              </div>
            </div>
          </div>
          <div className="pointer-events-auto">
            <SettingsSheet {...settingsSheetProps} />
          </div>
        </header>

        <section
          className="mx-auto hidden w-full max-w-5xl flex-col gap-3 sm:flex"
          data-testid="desktop-viewer-content"
        >
          <div className="flex flex-wrap gap-2">
            <StatusBadge label="Location" value={locationStatusValue} />
            <StatusBadge label="Camera" value={cameraStatusValue} />
            <StatusBadge label="Motion" value={motionStatusValue} />
            <StatusBadge label="Sensor" value={sensorStatusValue} />
          </div>

          {astronomyFailureBanner ? (
            <FallbackBanner
              title="Astronomy fallback active."
              body={astronomyFailureBanner}
              critical
            />
          ) : null}
          {state.entry === 'demo' ? (
            <FallbackBanner
              title="Demo mode is active."
              body={`${demoScenario.label}. ${demoScenario.description}`}
            />
          ) : null}
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
              {state.camera !== 'granted' ? (
                <FallbackBanner
                  title="Camera access is off."
                  body="SkyLens switched to the dark gradient background while keeping the same pose and projection pipeline available."
                />
              ) : null}
              {state.orientation !== 'granted' ? (
                <FallbackBanner
                  title="Motion access is off."
                  body="Drag horizontally to pan, drag vertically to tilt, and double tap to recenter. Manual pan feeds the same normalized camera pose contract as live sensors."
                />
              ) : null}
              {motionRecoveryPanel}
              {locationError ? (
                <FallbackBanner
                  title="Live location is temporarily unavailable."
                  body={locationError}
                />
              ) : null}
              {manualObserverPanel}
              {cameraError ? (
                <FallbackBanner
                  title="Rear camera could not attach."
                  body={cameraError}
                />
              ) : null}
              {startupState === 'sensor-relative-needs-calibration' ? (
                <FallbackBanner
                  title="Relative sensor mode needs alignment."
                  body={`Center ${calibrationTarget.label} in the crosshair, then press the middle of the screen to align before trusting label placement.`}
                />
              ) : null}
              {calibrationBanner ? (
                <FallbackBanner
                  title="Calibration"
                  body={calibrationBanner}
                />
              ) : null}
              {showAlignmentGuidance && !manualMode ? (
                <FallbackBanner
                  title="Alignment looks off."
                  body={`Move phone in a figure eight or open Alignment to use ${calibrationTarget.label}.`}
                />
              ) : null}
              {shouldShowAlignmentInstructions ? (
                <AlignmentInstructionsPanel
                  targetLabel={calibrationTarget.label}
                  nextAction={alignmentTutorial.nextAction}
                  notices={alignmentTutorial.notices}
                  selectedTarget={alignmentTargetPreference}
                  availability={calibrationTargetResolution.availability}
                  onSelectTarget={handleAlignmentTargetPreferenceChange}
                  onResetCalibration={resetCalibration}
                  onFineAdjustCalibration={fineAdjustCalibration}
                  canResetCalibration={canResetCalibration}
                  onClose={closeAlignmentExperience}
                  showStartAlignmentAction={false}
                />
              ) : null}
              <section className="pointer-events-auto shell-panel rounded-[2rem] p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-sky-200/60">
                      Celestial layer
                    </p>
                    <h1
                      className="mt-2 text-2xl font-semibold text-white"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {renderedActiveSummaryObject
                        ? renderedActiveSummaryObject.label
                        : experience.title}
                    </h1>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-sky-100/80">
                      {renderedActiveSummaryObject
                        ? `${renderedActiveSummaryObject.label} is flowing through the normalized ${renderedActiveSummaryObject.type} object contract. Center-lock still uses angular distance from the reticle, not pixel distance.`
                        : `${experience.body} ${visibilityDiagnosticsNote}`}
                    </p>
                  </div>
                  <div className="rounded-[1.25rem] border border-sky-100/10 bg-white/5 px-4 py-3 text-sm text-sky-100/75">
                    <p>Yaw {Math.round(cameraPose.yawDeg)}°</p>
                    <p>Pitch {Math.round(cameraPose.pitchDeg)}°</p>
                    <p>
                      FOV {getEffectiveVerticalFovDeg(viewerSettings.verticalFovAdjustmentDeg)}°
                      {' '}vertical
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
              <section className="pointer-events-auto shell-panel rounded-[1.75rem] p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-sky-200/60">
                  Bottom dock
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
            </>
          )}

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
        </section>
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:hidden">
        {isMobileOverlayOpen && !isMobileAlignmentFocusActive ? (
          <div
            className={`pointer-events-auto fixed inset-0 z-30 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] ${
              shouldUseCompactNonScrollingOverlay ? 'overflow-hidden' : 'overflow-y-auto'
            }`}
            data-testid={
              shouldUseCompactNonScrollingOverlay
                ? 'mobile-viewer-overlay-shell'
                : 'mobile-viewer-overlay-scroll-region'
            }
          >
            <button
              type="button"
              aria-label="Close viewer overlay"
              data-testid="mobile-viewer-overlay-backdrop"
              onClick={() => setIsMobileOverlayOpen(false)}
              className="absolute inset-0 bg-slate-950/45"
            />
            <div
              className={`relative ${
                shouldUseCompactNonScrollingOverlay ? 'flex h-full items-end' : 'flex min-h-full items-end'
              }`}
            >
              <section
                id="mobile-viewer-overlay"
                data-testid="mobile-viewer-overlay"
                onClick={(event) => event.stopPropagation()}
                className={`shell-panel relative mx-auto w-full max-w-xl rounded-[1.5rem] p-4 ${
                  shouldUseCompactNonScrollingOverlay
                    ? 'flex max-h-full min-h-0 flex-col overflow-hidden'
                    : ''
                }`}
                style={
                  shouldUseCompactNonScrollingOverlay
                    ? { maxHeight: COMPACT_MOBILE_OVERLAY_MAX_HEIGHT }
                    : undefined
                }
              >
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
                      <SettingsSheet {...settingsSheetProps} />
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsMobileOverlayOpen(false)}
                      className="min-h-11 rounded-full border border-sky-100/15 px-3 py-1 text-xs text-sky-50"
                    >
                      Close
                    </button>
                  </div>
                </div>
                {shouldUseCompactNonScrollingOverlay ? (
                  <div
                    className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
                    data-testid="mobile-viewer-overlay-compact-content"
                  >
                    <div className="grid gap-3 pb-1 pr-1">
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge label="Location" value={locationStatusValue} />
                        <StatusBadge label="Camera" value={cameraStatusValue} />
                        <StatusBadge label="Motion" value={motionStatusValue} />
                        <StatusBadge label="Sensor" value={sensorStatusValue} />
                      </div>
                      {astronomyFailureBanner ? (
                        <FallbackBanner
                          title="Astronomy fallback active."
                          body={astronomyFailureBanner}
                          critical
                        />
                      ) : null}
                      {locationError ? (
                        <FallbackBanner
                          title="Live location is temporarily unavailable."
                          body={locationError}
                        />
                      ) : null}
                      {cameraError ? (
                        <FallbackBanner
                          title="Rear camera could not attach."
                          body={cameraError}
                        />
                      ) : null}
                      {startupState === 'sensor-relative-needs-calibration' ? (
                        <FallbackBanner
                          title="Relative sensor mode needs alignment."
                          body={`Center ${calibrationTarget.label} in the crosshair, then press the middle of the screen to align before trusting label placement.`}
                        />
                      ) : null}
                      {calibrationBanner ? (
                        <FallbackBanner
                          title="Calibration"
                          body={calibrationBanner}
                        />
                      ) : null}
                      {showAlignmentGuidance && !manualMode ? (
                        <FallbackBanner
                          title="Alignment looks off."
                          body={`Move phone in a figure eight or open Alignment to use ${calibrationTarget.label}.`}
                        />
                      ) : null}
                      {shouldShowAlignmentInstructions ? (
                        <AlignmentInstructionsPanel {...mobileAlignmentPanelProps} />
                      ) : null}
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
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge label="Location" value={locationStatusValue} />
                      <StatusBadge label="Camera" value={cameraStatusValue} />
                      <StatusBadge label="Motion" value={motionStatusValue} />
                      <StatusBadge label="Sensor" value={sensorStatusValue} />
                    </div>
                    {astronomyFailureBanner ? (
                      <FallbackBanner
                        title="Astronomy fallback active."
                        body={astronomyFailureBanner}
                        critical
                      />
                    ) : null}
                    {state.entry === 'demo' ? (
                      <FallbackBanner
                        title="Demo mode is active."
                        body={`${demoScenario.label}. ${demoScenario.description}`}
                      />
                    ) : null}
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
                        {state.camera !== 'granted' ? (
                          <FallbackBanner
                            title="Camera access is off."
                            body="SkyLens switched to the dark gradient background while keeping the same pose and projection pipeline available."
                          />
                        ) : null}
                        {state.orientation !== 'granted' ? (
                          <FallbackBanner
                            title="Motion access is off."
                            body="Drag horizontally to pan, drag vertically to tilt, and double tap to recenter. Manual pan feeds the same normalized camera pose contract as live sensors."
                          />
                        ) : null}
                        {motionRecoveryPanel}
                        {locationError ? (
                          <FallbackBanner
                            title="Live location is temporarily unavailable."
                            body={locationError}
                          />
                        ) : null}
                        {manualObserverPanel}
                        {cameraError ? (
                          <FallbackBanner
                            title="Rear camera could not attach."
                            body={cameraError}
                          />
                        ) : null}
                        {startupState === 'sensor-relative-needs-calibration' ? (
                          <FallbackBanner
                            title="Relative sensor mode needs alignment."
                            body={`Center ${calibrationTarget.label} in the crosshair, then press the middle of the screen to align before trusting label placement.`}
                          />
                        ) : null}
                        {calibrationBanner ? (
                          <FallbackBanner
                            title="Calibration"
                            body={calibrationBanner}
                          />
                        ) : null}
                        {showAlignmentGuidance && !manualMode ? (
                          <FallbackBanner
                            title="Alignment looks off."
                            body={`Move phone in a figure eight or open Alignment to use ${calibrationTarget.label}.`}
                          />
                        ) : null}
                        {shouldShowAlignmentInstructions ? (
                          <AlignmentInstructionsPanel {...mobileAlignmentPanelProps} />
                        ) : null}
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
                  </div>
                )}
              </section>
            </div>
          </div>
        ) : (
          <div className="grid justify-center gap-3" data-testid="mobile-viewer-quick-actions">
            {shouldShowAlignmentInstructions ? (
              <div className="pointer-events-auto">
                <AlignmentInstructionsPanel
                  {...mobileAlignmentPanelProps}
                  compact
                />
              </div>
            ) : null}
            <div className="pointer-events-auto flex flex-wrap justify-center gap-2">
              {!isMobileAlignmentFocusActive ? (
                <button
                  type="button"
                  onClick={() => setIsMobileOverlayOpen(true)}
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
                  onClick={
                    state.camera === 'granted' && state.orientation !== 'granted'
                      ? handleRetryMotionPermission
                      : handleRetryPermissions
                  }
                  disabled={isPending}
                  data-testid="mobile-permission-action"
                  className="min-h-11 rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_12px_30px_rgba(251,191,36,0.22)] disabled:cursor-wait disabled:bg-amber-100"
                >
                  {isPending ? 'Starting AR...' : mobilePermissionActionLabel}
                </button>
              ) : null}
              {showMobileAlignAction ? (
                <button
                  type="button"
                  onClick={openAlignmentExperience}
                  data-testid="mobile-align-action"
                  className="min-h-11 rounded-full border border-sky-100/15 bg-slate-950/80 px-5 py-3 text-sm font-semibold text-sky-50 shadow-[0_12px_30px_rgba(3,7,13,0.32)]"
                >
                  Align
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function isMotionAffordanceEligible(object: ProjectedSkyObject | null) {
  if (!object) {
    return false
  }

  return object.type === 'aircraft' || object.type === 'satellite'
}

function getMotionAffordanceKind(motionQuality: MotionQuality) {
  return motionQuality === 'low' ? 'vector' : 'trail'
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
) {
  const effectiveFovDeg = getEffectiveVerticalFovDeg(verticalFovAdjustmentDeg)
  const fovScale = clampNumber(50 / effectiveFovDeg, 0.82, 1.24)
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
    case 'star':
      sizePx = 6 + getMagnitudeBoost(object.magnitude) * 0.75
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

  return Math.max(6, Math.round(sizePx * fovScale))
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
}: {
  startupState: StartupState
  orientationSource: OrientationSource | null
  orientationAbsolute: boolean
  cameraPose: CameraPose
}) {
  if (cameraPose.mode === 'manual') {
    return 'Manual'
  }

  if (startupState === 'sensor-relative-needs-calibration') {
    return 'Relative'
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

function StatusBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-sky-100/10 bg-slate-950/55 px-3 py-2 text-xs uppercase tracking-[0.16em] text-sky-100/80">
      {label}: {value}
    </div>
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
}: {
  title: string
  body: string
  critical?: boolean
}) {
  return (
    <section
      className={`rounded-[1.5rem] px-4 py-3 text-sm ${
        critical
          ? 'border border-rose-300/25 bg-rose-500/14 text-rose-50'
          : 'border border-amber-200/15 bg-amber-300/10 text-amber-50'
      }`}
    >
      <p className="font-semibold">{title}</p>
      <p className={`mt-1 ${critical ? 'text-rose-100/80' : 'text-amber-50/80'}`}>
        {body}
      </p>
    </section>
  )
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

function AlignmentInstructionsPanel({
  targetLabel,
  nextAction,
  notices,
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
}: {
  targetLabel: string
  nextAction: string
  notices: AlignmentTutorialNotice[]
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
}) {
  return (
    <section
      className={`rounded-[1.5rem] border border-sky-100/10 bg-slate-950/55 ${
        compact ? 'max-w-full overflow-y-auto overscroll-contain p-4' : 'p-5'
      }`}
      style={compact ? { maxHeight: COMPACT_ALIGNMENT_PANEL_MAX_HEIGHT } : undefined}
      data-testid="alignment-instructions-panel"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-sky-200/60">Alignment</p>
          <p className="mt-2 text-sm text-white">Current target {targetLabel}</p>
        </div>
        <button
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
      <div className="mt-3 grid gap-2">
        {notices.map((notice) => (
          <p
            key={notice.id}
            className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${
              notice.tone === 'warning'
                ? 'border-amber-200/15 bg-amber-300/10 text-amber-50/85'
                : 'border-sky-100/10 bg-white/5 text-sky-100/80'
            }`}
          >
            {notice.text}
          </p>
        ))}
      </div>
      <div
        className="mt-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/10 px-4 py-3 text-sm leading-6 text-emerald-50/90"
        data-testid="alignment-next-action"
      >
        {nextAction}
      </div>
      {showStartAlignmentAction ? (
        <div className={`mt-3 ${compact ? '' : 'sm:max-w-xs'}`}>
          <button
            type="button"
            onClick={onStartAlignment}
            disabled={!canStartAlignment}
            data-testid="alignment-start-action"
            className="min-h-11 rounded-2xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-emerald-100"
          >
            Start alignment
          </button>
        </div>
      ) : null}
      <div className={`mt-3 ${compact ? '' : 'sm:max-w-xs'}`}>
        <button
          type="button"
          onClick={onResetCalibration}
          disabled={!canResetCalibration}
          className="min-h-11 rounded-2xl border border-sky-100/10 bg-slate-950/35 px-4 py-3 text-sm text-sky-50 disabled:cursor-not-allowed disabled:text-sky-100/45"
        >
          Reset calibration
        </button>
      </div>
      <div className={`mt-2 grid grid-cols-2 gap-2 ${compact ? '' : ''}`}>
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
  focusedObjectId,
  aircraftSnapshot,
  aircraftPreviousSnapshot,
  aircraftTransitionStartedAtMs,
  satelliteCatalog,
}: {
  observer: ObserverState
  timeMs: number
  enabledLayers: Record<EnabledLayer, boolean>
  likelyVisibleOnly: boolean
  focusedObjectId: string | null
  aircraftSnapshot: AircraftApiResponse | null
  aircraftPreviousSnapshot: AircraftApiResponse | null
  aircraftTransitionStartedAtMs: number | null
  satelliteCatalog: TleApiResponse | null
}): SceneSnapshot {
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
    })
    let aircraft: SkyObject[] = []
    let satellites: SkyObject[] = []

    try {
      aircraft = resolveAircraftMotionObjects({
        snapshot: aircraftSnapshot,
        previousSnapshot: aircraftPreviousSnapshot,
        transitionStartedAtMs: aircraftTransitionStartedAtMs,
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
        ...(aircraftDetail?.headingCardinal
          ? [{ label: 'Heading', value: aircraftDetail.headingCardinal }]
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
    case 'interpolated':
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
  cameraPose: CameraPose,
  startupState: StartupState,
  orientationSource: OrientationSource | null,
) {
  if (experienceMode === 'blocked' && startupState === 'requesting') {
    return 'Pending'
  }

  if (experienceMode === 'blocked') {
    return badgeValue(state.orientation)
  }

  if (cameraPose.mode === 'manual') {
    return 'Manual pan'
  }

  if (startupState === 'sensor-relative-needs-calibration') {
    return 'Align first'
  }

  if (orientationSource === 'absolute-sensor') {
    return 'Absolute sensor'
  }

  if (cameraPose.alignmentHealth === 'good') {
    return 'Aligned'
  }

  if (cameraPose.alignmentHealth === 'poor') {
    return 'Noisy'
  }

  return 'Settling'
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

function getMobilePermissionActionLabel(state: ViewerRouteState) {
  if (state.camera !== 'granted' && state.orientation !== 'granted') {
    return 'Enable camera and motion'
  }

  if (state.camera !== 'granted') {
    return 'Enable camera'
  }

  if (state.orientation !== 'granted') {
    return 'Enable motion'
  }

  return 'Enable AR'
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
  cameraStatus: _cameraStatus,
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
