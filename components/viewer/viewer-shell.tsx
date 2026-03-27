'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
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
  normalizeAircraftObjects,
  type AircraftDetailMetadata,
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
  normalizeSatelliteObjects,
  type SatelliteDetailMetadata,
} from '../../lib/satellites/client'
import type { TleApiResponse } from '../../lib/satellites/contracts'
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
  type CameraFrameLayout,
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
  markViewerOnboardingCompleted,
  readViewerSettings,
  writeViewerSettings,
  type ManualObserverSettings,
} from '../../lib/viewer/settings'
import { SettingsSheet } from '../settings/settings-sheet'

type ViewerShellProps = {
  initialState: ViewerRouteState
}

type ProjectedSkyObject = SkyObject & {
  projection: ReturnType<typeof projectWorldPointToScreen>
}

type OnObjectLabel = RankedLabelPlacement<ProjectedSkyObject>
type TrailSample = {
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

type CalibrationTarget = {
  id: string
  label: string
  description: string
  azimuthDeg: number
  elevationDeg: number
  sourceType: SkyObject['type'] | 'north-marker'
}

type AlignmentTargetPreference = 'sun' | 'moon'

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
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null)
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
    initialState.entry === 'demo' ? initialDemoScenario.observer.timestampMs : Date.now(),
  )
  const [viewerSettings, setViewerSettings] = useState(persistedViewerSettings)
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const [astronomyFailureBanner, setAstronomyFailureBanner] = useState<string | null>(null)
  const [aircraftSnapshot, setAircraftSnapshot] = useState<AircraftApiResponse | null>(null)
  const [aircraftAvailability, setAircraftAvailability] = useState<AircraftAvailability>(
    'available',
  )
  const [satelliteCatalog, setSatelliteCatalog] = useState<TleApiResponse | null>(null)
  const [liveCameraStreamActive, setLiveCameraStreamActive] = useState(false)
  const [liveCameraError, setLiveCameraError] = useState<string | null>(null)
  const [cameraDevices, setCameraDevices] = useState<CameraDeviceOption[]>([])
  const [cameraFrameLayout, setCameraFrameLayout] = useState<CameraFrameLayout | null>(null)
  const [renderFrameToken, setRenderFrameToken] = useState(0)
  const [cameraSourceSize, setCameraSourceSize] = useState<{
    width: number
    height: number
  } | null>(null)
  const [orientationSource, setOrientationSource] = useState<OrientationSource | null>(null)
  const [orientationAbsolute, setOrientationAbsolute] = useState(
    initialState.orientation === 'granted',
  )
  const [orientationNeedsCalibration, setOrientationNeedsCalibration] = useState(false)
  const [latestOrientationSample, setLatestOrientationSample] = useState<OrientationSample | null>(
    null,
  )
  const [sceneSnapshot, setSceneSnapshot] = useState<SceneSnapshot>(EMPTY_SCENE_SNAPSHOT)
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
  const [alignmentTargetPreference, setAlignmentTargetPreference] =
    useState<AlignmentTargetPreference>('sun')
  const [lastAppliedCalibrationTarget, setLastAppliedCalibrationTarget] =
    useState<CalibrationTarget | null>(null)
  const [healthStatus, setHealthStatus] = useState<HealthApiResponse | null>(null)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [trailSamples, setTrailSamples] = useState<TrailSample[]>([])
  const [isMobileOverlayOpen, setIsMobileOverlayOpen] = useState(false)
  const [isMobileAlignmentFocusActive, setIsMobileAlignmentFocusActive] = useState(false)
  const [motionRetryError, setMotionRetryError] = useState<string | null>(null)
  const [manualObserverError, setManualObserverError] = useState<string | null>(null)
  const [manualObserverDraft, setManualObserverDraft] = useState<ManualObserverDraft>(() =>
    createManualObserverDraft(persistedViewerSettings.manualObserver),
  )
  const orientationControllerRef = useRef<ReturnType<typeof subscribeToOrientationPose> | null>(
    null,
  )
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const cameraRequestIdRef = useRef(0)
  const lastOpenedCameraPreferenceRef = useRef<string | null>(null)
  const liveObserverRef = useRef<ObserverState | null>(persistedManualObserver)
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
  const activeAircraftSnapshot = shouldPollAircraft ? aircraftSnapshot : null
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
  const cameraStreamActive =
    state.entry === 'live' && state.camera === 'granted' && liveCameraStreamActive
  const cameraError = state.entry === 'demo' ? null : liveCameraError
  const shouldMountVideoElement = state.entry === 'live'

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
  const shouldRenderTrail =
    !prefersReducedMotion && isTrailEligible(activeSummaryObject, selectedObjectId)
  const activeTrailObjectId = activeSummaryObject?.id ?? null
  const activeTrailX = activeSummaryObject?.projection.x ?? null
  const activeTrailY = activeSummaryObject?.projection.y ?? null
  const activeTrailVisible = activeSummaryObject?.projection.visible ?? false
  const activeTrailInViewport = activeSummaryObject?.projection.inViewport ?? false
  const activeTrail =
    shouldRenderTrail && activeSummaryObject
      ? trailSamples.filter((sample) => sample.id === activeSummaryObject.id)
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
  const calibrationInstructions = buildCalibrationInstructions(calibrationTarget)
  const shouldShowAlignmentInstructions =
    !manualMode &&
    (startupState === 'sensor-relative-needs-calibration' ||
      isMobileAlignmentFocusActive ||
      showAlignmentGuidance)
  const calibrationStatus = describeCalibrationStatus({
    startupState,
    cameraPose,
    poseCalibration: viewerSettings.poseCalibration,
    calibrationTarget,
    appliedCalibrationTarget: lastAppliedCalibrationTarget,
  })
  const canFixAlignment = experience.mode !== 'blocked'
  const canAlignCalibration = cameraPose.mode === 'sensor' && latestOrientationSample !== null
  const sensorStatusValue = getSensorStatusValue({
    startupState,
    orientationSource,
    orientationAbsolute,
    cameraPose,
  })
  const showMobilePermissionAction =
    state.entry === 'live' &&
    (state.camera !== 'granted' || state.orientation !== 'granted')
  const showMobileAlignAction = state.entry === 'live'
  const mobilePermissionActionLabel = getMobilePermissionActionLabel(state)

  const enterMobileAlignmentFocus = () => {
    setShowAlignmentGuidance(true)
    setIsMobileOverlayOpen(false)
    setIsMobileAlignmentFocusActive(true)
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
    setCameraFrameLayout(null)

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
        setTrailSamples([])
        setSceneTimeMs(Date.now())
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
    setTrailSamples([])
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
    setTrailSamples([])
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
    setVideoElement(node)
  }, [])

  useEffect(() => {
    if (state.entry === 'demo') {
      const intervalId = window.setInterval(() => {
        setSceneTimeMs((current) => current + 1_000)
      }, 1_000)

      return () => {
        window.clearInterval(intervalId)
      }
    }

    const intervalId = window.setInterval(() => {
      setSceneTimeMs(Date.now())
    }, 1_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [demoScenario.observer.timestampMs, state.entry])

  useEffect(() => {
    if (!observer) {
      setSceneSnapshot(EMPTY_SCENE_SNAPSHOT)
      return
    }

    setSceneSnapshot(
      buildSceneSnapshot({
        observer,
        timeMs: sceneTimeMs,
        enabledLayers,
        likelyVisibleOnly,
        focusedObjectId: selectedObjectId,
        aircraftSnapshot: activeAircraftData,
        satelliteCatalog: activeSatelliteCatalog,
      }),
    )
  }, [
    activeAircraftData,
    activeSatelliteCatalog,
    enabledLayers,
    likelyVisibleOnly,
    observer,
    sceneTimeMs,
    selectedObjectId,
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
      setTrailSamples([])
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
    setManualObserverDraft(createManualObserverDraft(viewerSettings.manualObserver))
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
      !activeTrailObjectId ||
      !shouldRenderTrail ||
      !activeTrailVisible ||
      !activeTrailInViewport ||
      activeTrailX === null ||
      activeTrailY === null
    ) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setTrailSamples((current) => {
        const nextSamples = current.filter((sample) => sample.id === activeTrailObjectId)

        return [
          ...nextSamples,
          {
            id: activeTrailObjectId,
            x: activeTrailX,
            y: activeTrailY,
          },
        ].slice(-10)
      })
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    activeTrailInViewport,
    activeTrailObjectId,
    activeTrailVisible,
    activeTrailX,
    activeTrailY,
    prefersReducedMotion,
    sceneTimeMs,
    shouldRenderTrail,
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
          setAircraftSnapshot(nextSnapshot)
          setAircraftAvailability(nextSnapshot.availability)
        }
      } catch {
        if (!disposed) {
          setAircraftSnapshot(null)
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
      setStartupState('unsupported')
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
    if (
      state.entry !== 'live' ||
      startupState === 'ready-to-request' ||
      state.camera !== 'granted' ||
      !videoElement ||
      cameraStreamRef.current
    ) {
      return
    }

    void openLiveCamera(viewerSettings.selectedCameraDeviceId).catch(() => undefined)
  }, [startupState, state, videoElement, viewerSettings.selectedCameraDeviceId])

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
    if (!cameraSourceSize) {
      setCameraFrameLayout(null)
      return
    }

    setCameraFrameLayout(
      createCameraFrameLayout({
        width: viewport.width,
        height: viewport.height,
        sourceWidth: cameraSourceSize.width,
        sourceHeight: cameraSourceSize.height,
      }),
    )
  }, [cameraSourceSize, viewport])

  useEffect(() => {
    if (!hasLiveSessionStarted) {
      return
    }

    let cancelled = false
    let animationFrameId: number | null = null
    let videoFrameRequestId: number | null = null
    const frameVideo = videoElement as HTMLVideoElement | null
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
  }, [cameraStreamActive, hasLiveSessionStarted, videoElement])

  useEffect(() => {
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
  }, [
    hasLiveSessionStarted,
    observer,
    startupState,
    state,
    videoElement,
    viewerSettings.selectedCameraDeviceId,
  ])

  useEffect(() => {
    if (state.entry === 'live' && state.camera === 'granted') {
      return
    }

    if (videoElement) {
      videoElement.srcObject = null
    }

    stopMediaStream(cameraStreamRef.current)
    cameraStreamRef.current = null
    lastOpenedCameraPreferenceRef.current = null
    setLiveCameraStreamActive(false)
    setCameraSourceSize(null)
    setCameraFrameLayout(null)
  }, [state.camera, state.entry, videoElement])

  useEffect(() => {
    return () => {
      if (videoElement) {
        videoElement.srcObject = null
      }

      stopMediaStream(cameraStreamRef.current)
      cameraStreamRef.current = null
      lastOpenedCameraPreferenceRef.current = null
      setLiveCameraStreamActive(false)
    }
  }, [videoElement])

  useEffect(() => {
    orientationControllerRef.current?.stop()
    orientationControllerRef.current = null
    poorSinceRef.current = null
    setCalibrationBanner(null)
    setOrientationSource(null)
    setOrientationAbsolute(state.orientation === 'granted')
    setOrientationNeedsCalibration(false)
    setLatestOrientationSample(null)

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
    if (
      !isMobileAlignmentFocusActive ||
      state.entry !== 'live' ||
      viewerSettings.poseCalibration.calibrated
    ) {
      if (state.entry !== 'live' || viewerSettings.poseCalibration.calibrated) {
        setIsMobileAlignmentFocusActive(false)
      }

      return
    }

    setIsMobileOverlayOpen(false)
  }, [
    isMobileAlignmentFocusActive,
    state.entry,
    viewerSettings.poseCalibration.calibrated,
  ])

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
    enterMobileAlignmentFocus()
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
        timestampMs: Date.now(),
      },
    )

    updatePoseCalibration(nextCalibration)
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
      lastCalibratedAtMs: Date.now(),
      offsetQuaternion: multiplyQuaternions(
        deltaQuaternion,
        viewerSettings.poseCalibration.offsetQuaternion,
      ),
    })

    updatePoseCalibration(nextCalibration)
  }

  const settingsSheetProps = {
    onEnterDemoMode: handleEnterDemoMode,
    onDemoScenarioSelect: handleSelectDemoScenario,
    onFixAlignment: fixAlignment,
    onAlignCalibration: alignCalibrationTarget,
    onResetCalibration: resetCalibration,
    onFineAdjustCalibration: fineAdjustCalibration,
    onRecenter: recenter,
    canFixAlignment,
    canAlignCalibration,
    canResetCalibration:
      cameraPose.mode === 'sensor' &&
      (viewerSettings.poseCalibration.calibrated ||
        !quaternionsApproximatelyEqual(
          viewerSettings.poseCalibration.offsetQuaternion,
          createIdentityPoseCalibration().offsetQuaternion,
        )),
    canRecenter: manualMode,
    calibrationTargetLabel: calibrationTarget.label,
    calibrationTargetDescription: calibrationTarget.description,
    calibrationStatus,
    calibrationInstructions,
    alignmentTargetPreference,
    alignmentTargetAvailability: calibrationTargetResolution.availability,
    alignmentTargetFallbackLabel: calibrationTargetResolution.preferredTargetUnavailable
      ? calibrationTarget.label
      : null,
    onAlignmentTargetPreferenceChange: setAlignmentTargetPreference,
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
      const now = Date.now()

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
    <main className="relative min-h-screen overflow-hidden text-sky-50">
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
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {activeTrail.length >= 2 ? (
            <polyline
              points={activeTrail.map((sample) => `${sample.x},${sample.y}`).join(' ')}
              fill="none"
              stroke="rgba(251, 191, 36, 0.58)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
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
            }}
          >
            <span className="block truncate font-semibold">{object.object.label}</span>
            <span className="block truncate text-[11px] text-sky-100/75">
              {formatSkyObjectSublabel(object.object)}
            </span>
          </div>
        ))}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-16 w-16 rounded-full border border-sky-100/40">
            <div className="absolute inset-x-1/2 top-2 h-12 w-px -translate-x-1/2 bg-sky-50/80" />
            <div className="absolute inset-y-1/2 left-2 h-px w-12 -translate-y-1/2 bg-sky-50/80" />
          </div>
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
                  body={`Center ${calibrationTarget.label} in the reticle, then align before trusting label placement.`}
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
                  instructions={calibrationInstructions}
                  selectedTarget={alignmentTargetPreference}
                  availability={calibrationTargetResolution.availability}
                  fallbackLabel={
                    calibrationTargetResolution.preferredTargetUnavailable
                      ? calibrationTarget.label
                      : null
                  }
                  onSelectTarget={setAlignmentTargetPreference}
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
            className="pointer-events-auto fixed inset-0 z-30 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]"
            data-testid="mobile-viewer-overlay-scroll-region"
          >
            <button
              type="button"
              aria-label="Close viewer overlay"
              data-testid="mobile-viewer-overlay-backdrop"
              onClick={() => setIsMobileOverlayOpen(false)}
              className="absolute inset-0 bg-slate-950/45"
            />
            <div className="relative flex min-h-full items-end">
              <section
                id="mobile-viewer-overlay"
                data-testid="mobile-viewer-overlay"
                onClick={(event) => event.stopPropagation()}
                className="shell-panel relative mx-auto w-full max-w-xl rounded-[1.5rem] p-4"
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
                          body={`Center ${calibrationTarget.label} in the reticle, then align before trusting label placement.`}
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
                          instructions={calibrationInstructions}
                          selectedTarget={alignmentTargetPreference}
                          availability={calibrationTargetResolution.availability}
                          fallbackLabel={
                            calibrationTargetResolution.preferredTargetUnavailable
                              ? calibrationTarget.label
                              : null
                          }
                          onSelectTarget={setAlignmentTargetPreference}
                        />
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
              </section>
            </div>
          </div>
        ) : (
          <div className="grid justify-center gap-3" data-testid="mobile-viewer-quick-actions">
            {shouldShowAlignmentInstructions ? (
              <div className="pointer-events-auto">
                <AlignmentInstructionsPanel
                  targetLabel={calibrationTarget.label}
                  instructions={calibrationInstructions}
                  selectedTarget={alignmentTargetPreference}
                  availability={calibrationTargetResolution.availability}
                  fallbackLabel={
                    calibrationTargetResolution.preferredTargetUnavailable
                      ? calibrationTarget.label
                      : null
                  }
                  onSelectTarget={setAlignmentTargetPreference}
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
                  onClick={
                    isMobileAlignmentFocusActive
                      ? alignCalibrationTarget
                      : enterMobileAlignmentFocus
                  }
                  disabled={!canAlignCalibration}
                  data-testid="mobile-align-action"
                  className="min-h-11 rounded-full border border-sky-100/15 bg-slate-950/80 px-5 py-3 text-sm font-semibold text-sky-50 shadow-[0_12px_30px_rgba(3,7,13,0.32)] disabled:cursor-not-allowed disabled:text-sky-100/45"
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

function isTrailEligible(
  object: ProjectedSkyObject | null,
  selectedObjectId: string | null,
) {
  if (!object) {
    return false
  }

  if (object.type === 'aircraft') {
    return true
  }

  if (object.type !== 'satellite') {
    return false
  }

  return object.metadata.isIss === true || selectedObjectId === object.id
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

  if (isFocused) {
    return 'rounded-full border border-amber-100/80 bg-amber-200/35 shadow-[0_0_0_4px_rgba(251,191,36,0.14),0_0_18px_rgba(251,191,36,0.4)]'
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
        ? 'rounded-[0.4rem] border border-violet-100/70 bg-violet-200/42 shadow-[0_0_14px_rgba(196,181,253,0.28)]'
        : 'rounded-[0.35rem] border border-sky-100/70 bg-sky-200/38 shadow-[0_0_12px_rgba(125,211,252,0.2)]'
    case 'aircraft':
      return 'rounded-[0.35rem] border border-cyan-100/70 bg-cyan-200/38 shadow-[0_0_12px_rgba(103,232,249,0.22)]'
    default:
      return 'rounded-full border border-sky-100/70 bg-sky-100/30'
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
  const sunTarget = sun ? createCalibrationTarget(sun, 'sun') : null

  const moon = visibleCelestialTargets.find((object) => object.type === 'moon')
  const moonTarget = moon ? createCalibrationTarget(moon, 'moon') : null

  const brightestPlanet = [...visibleCelestialTargets]
    .filter((object) => object.type === 'planet')
    .sort(compareCalibrationBrightness)[0]
  const planetTarget = brightestPlanet
    ? createCalibrationTarget(brightestPlanet, 'planet')
    : null

  const brightestStar = [...visibleCelestialTargets]
    .filter((object) => object.type === 'star')
    .sort(compareCalibrationBrightness)[0]
  const starTarget = brightestStar ? createCalibrationTarget(brightestStar, 'star') : null
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

function buildCalibrationInstructions(calibrationTarget: CalibrationTarget) {
  return [
    'Choose the Sun or Moon target for this alignment pass.',
    `Center ${calibrationTarget.label} in the reticle.`,
    `Tap Align to lock labels to ${calibrationTarget.label}.`,
    'If labels still drift, fine-adjust or reset calibration.',
  ]
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

function AlignmentInstructionsPanel({
  targetLabel,
  instructions,
  selectedTarget,
  availability,
  fallbackLabel,
  onSelectTarget,
  compact = false,
}: {
  targetLabel: string
  instructions: string[]
  selectedTarget: AlignmentTargetPreference
  availability: {
    sun: boolean
    moon: boolean
  }
  fallbackLabel: string | null
  onSelectTarget: (target: AlignmentTargetPreference) => void
  compact?: boolean
}) {
  return (
    <section
      className={`rounded-[1.5rem] border border-sky-100/10 bg-slate-950/55 ${
        compact ? 'p-4' : 'p-5'
      }`}
      data-testid="alignment-instructions-panel"
    >
      <p className="text-xs uppercase tracking-[0.18em] text-sky-200/60">Alignment steps</p>
      <p className="mt-2 text-sm text-white">Current target {targetLabel}</p>
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
      {fallbackLabel ? (
        <p className="mt-3 text-sm text-amber-100/80">
          {selectedTarget === 'sun' ? 'Sun' : 'Moon'} is unavailable. SkyLens will use{' '}
          {fallbackLabel}.
        </p>
      ) : null}
      <ol className="mt-3 grid gap-2 text-sm leading-6 text-sky-100/80">
        {instructions.map((instruction, index) => (
          <li
            key={`${targetLabel}-${instruction}`}
            className="rounded-2xl border border-sky-100/10 bg-white/5 px-4 py-3"
          >
            <span className="mr-2 text-sky-200/70">{index + 1}.</span>
            {instruction}
          </li>
        ))}
      </ol>
    </section>
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
  onSelect: (target: AlignmentTargetPreference) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(target)}
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

function buildSceneSnapshot({
  observer,
  timeMs,
  enabledLayers,
  likelyVisibleOnly,
  focusedObjectId,
  aircraftSnapshot,
  satelliteCatalog,
}: {
  observer: ObserverState
  timeMs: number
  enabledLayers: Record<EnabledLayer, boolean>
  likelyVisibleOnly: boolean
  focusedObjectId: string | null
  aircraftSnapshot: AircraftApiResponse | null
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
    let aircraft: SkyObject[] = []

    try {
      aircraft = normalizeAircraftObjects({
        snapshot: aircraftSnapshot,
        enabledLayers,
      })
    } catch {
      aircraft = []
    }

    const stars = normalizeVisibleStars({
      observer,
      timeMs,
      enabledLayers,
      likelyVisibleOnly,
      sunAltitudeDeg: celestial.sunAltitudeDeg,
    })
    let satellites: SkyObject[] = []

    try {
      satellites = normalizeSatelliteObjects({
        catalog: satelliteCatalog,
        observer,
        timeMs,
        enabledLayers,
        likelyVisibleOnly,
        sunAltitudeDeg: celestial.sunAltitudeDeg,
      })
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
      return 'Aircraft'
    case 'satellite':
      return 'Satellite'
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
  if (object.metadata.isIss !== true) {
    return null
  }

  return (
    <span className="rounded-full border border-amber-200/45 bg-amber-200/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-50">
      ISS
    </span>
  )
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
    timestampMs: Date.now(),
    source: 'manual',
  }
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
