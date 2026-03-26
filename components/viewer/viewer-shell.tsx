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
  getLabelRankScore,
  layoutLabels,
  type LabelCandidate,
  type RankedLabelPlacement,
} from '../../lib/labels/ranking'
import {
  createCameraQuaternion,
  getEffectiveVerticalFovDeg,
  pickCenterLockedCandidate,
  projectWorldPointToScreen,
  requestRearCameraStream,
  stopMediaStream,
} from '../../lib/projection/camera'
import {
  buildViewerHref,
  createDemoViewerRoute,
  describeViewerExperience,
  hasVerifiedLiveViewerState,
  runStartFlow,
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
  createManualPoseState,
  recenterManualPose,
  subscribeToOrientationPose,
} from '../../lib/sensors/orientation'
import type { CameraPose, ObserverState, SkyObject } from '../../lib/viewer/contracts'
import {
  markViewerOnboardingCompleted,
  readViewerSettings,
  writeViewerSettings,
} from '../../lib/viewer/settings'
import { SettingsSheet } from '../settings/settings-sheet'

type ViewerShellProps = {
  initialState: ViewerRouteState
}

type ProjectedSkyObject = SkyObject & {
  projection: ReturnType<typeof projectWorldPointToScreen>
}

type DisplayedSkyObject = RankedLabelPlacement<ProjectedSkyObject>
type TrailSample = {
  id: string
  x: number
  y: number
}

const DEFAULT_VIEWPORT = {
  width: 390,
  height: 844,
}

const PUBLIC_CONFIG = getPublicConfig()
const STAR_CATALOG = loadStarCatalog()
const EMPTY_SCENE = {
  objects: [] as SkyObject[],
  lineSegments: [] as ReturnType<typeof buildVisibleConstellations>['lineSegments'],
  error: null as string | null,
}

export function ViewerShell({ initialState }: ViewerShellProps) {
  const router = useRouter()
  const initialDemoScenario = getDemoScenario(initialState.demoScenarioId)
  const [isPending, startTransition] = useTransition()
  const [retryError, setRetryError] = useState<string | null>(null)
  const [state, setState] = useState(initialState)
  const [stageElement, setStageElement] = useState<HTMLDivElement | null>(null)
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null)
  const [viewport, setViewport] = useState(DEFAULT_VIEWPORT)
  const [liveObserver, setLiveObserver] = useState<ObserverState | null>(null)
  const [liveLocationError, setLiveLocationError] = useState<string | null>(null)
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
  const [viewerSettings, setViewerSettings] = useState(() => readViewerSettings())
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const [astronomyFailureBanner, setAstronomyFailureBanner] = useState<string | null>(null)
  const [aircraftSnapshot, setAircraftSnapshot] = useState<AircraftApiResponse | null>(null)
  const [aircraftAvailability, setAircraftAvailability] = useState<AircraftAvailability>(
    'available',
  )
  const [satelliteCatalog, setSatelliteCatalog] = useState<TleApiResponse | null>(null)
  const [liveCameraStreamActive, setLiveCameraStreamActive] = useState(false)
  const [liveCameraError, setLiveCameraError] = useState<string | null>(null)
  const [showAlignmentGuidance, setShowAlignmentGuidance] = useState(false)
  const [healthStatus, setHealthStatus] = useState<HealthApiResponse | null>(null)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [trailSamples, setTrailSamples] = useState<TrailSample[]>([])
  const orientationControllerRef = useRef<ReturnType<typeof subscribeToOrientationPose> | null>(
    null,
  )
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const poorSinceRef = useRef<number | null>(null)
  const dragRef = useRef<{
    pointerId: number
    clientX: number
    clientY: number
    moved: boolean
  } | null>(null)
  const lastTapAtRef = useRef(0)
  const hasMounted = useSyncExternalStore(subscribeToHydrationReady, getHydratedSnapshot, getServerHydrationSnapshot)
  const demoScenario = getDemoScenario(state.demoScenarioId)
  const demoScenarioOptions = listDemoScenarios().map((scenario) => ({
    id: scenario.id,
    label: scenario.label,
  }))
  const experience = describeViewerExperience(state)
  const hasVerifiedLiveState = hasVerifiedLiveViewerState(state)
  const enabledLayers = viewerSettings.enabledLayers
  const likelyVisibleOnly = viewerSettings.likelyVisibleOnly
  const observer =
    state.entry === 'demo'
      ? demoScenario.observer
      : hasVerifiedLiveState && state.location === 'granted'
        ? liveObserver
        : null
  const locationError =
    !hasVerifiedLiveState || state.location !== 'granted' ? null : liveLocationError
  const manualMode =
    experience.mode === 'demo' || experience.mode === 'manual-pan'
  const cameraPose = manualMode
    ? createManualCameraPose(manualPoseState)
    : sensorCameraPose
  const shouldPollAircraft =
    hasVerifiedLiveState &&
    state.entry !== 'demo' &&
    state.location === 'granted' &&
    observer !== null &&
    enabledLayers.aircraft
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
    hasVerifiedLiveState && state.camera === 'granted' && liveCameraStreamActive
  const cameraError =
    !hasVerifiedLiveState || state.camera !== 'granted' ? null : liveCameraError
  const shouldMountVideoElement =
    hasVerifiedLiveState && state.camera === 'granted'

  const showGradientBackground =
    state.entry === 'demo' ||
    state.camera !== 'granted' ||
    !cameraStreamActive
  const blockingCopy = getBlockingCopy(state)
  const scene = observer
    ? buildSkyScene({
        observer,
        timeMs: sceneTimeMs,
        enabledLayers,
        likelyVisibleOnly,
        focusedObjectId: selectedObjectId,
        aircraftSnapshot: activeAircraftData,
        satelliteCatalog: activeSatelliteCatalog,
        cameraPose,
        viewport,
        verticalFovAdjustmentDeg: viewerSettings.verticalFovAdjustmentDeg,
      })
    : EMPTY_SCENE
  const projectedObjects: ProjectedSkyObject[] = scene.objects.map((object) => ({
    ...object,
    projection: projectWorldPointToScreen(
      cameraPose,
      {
        azimuthDeg: object.azimuthDeg,
        elevationDeg: object.elevationDeg,
      },
      viewport,
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
  const displayedObjects: DisplayedSkyObject[] = layoutLabels(
    projectedObjects
      .filter(
        (object) =>
          !isCelestialDaylightLabelSuppressed(object) ||
          object.id === centerLockedObject?.id ||
          object.id === selectedObjectId,
      )
      .map((object) => ({
        object,
        projection: object.projection,
        secondaryLabel: formatSkyObjectSublabel(object),
      })) satisfies LabelCandidate<ProjectedSkyObject>[],
    {
      viewport,
      maxLabels: PUBLIC_CONFIG.defaults.maxLabels,
      centerLockedObjectId: centerLockedObject?.id ?? null,
    },
  )
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
  const renderedLineSegments = hasMounted ? scene.lineSegments : []
  const renderedDisplayedObjects = hasMounted ? displayedObjects : []
  const renderedCenterLockedObject = hasMounted ? centerLockedObject : null
  const renderedSelectedDetailObject = hasMounted ? selectedDetailObject : null
  const renderedActiveSummaryObject = hasMounted ? activeSummaryObject : null

  const handleRetryPermissions = () => {
    setRetryError(null)
    setAstronomyFailureBanner(null)

    startTransition(async () => {
      try {
        const nextState = await runStartFlow()
        setSelectedObjectId(null)
        setTrailSamples([])
        setSceneTimeMs(Date.now())
        setState(nextState)
        router.replace(buildViewerHref(nextState))
      } catch {
        setRetryError('Permission retry failed. Use demo mode if you want to continue now.')
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
    setManualPoseState(
      createManualPoseState({
        pitchDeg: demoScenario.initialPitchDeg,
      }),
    )
    setSceneTimeMs(demoScenario.observer.timestampMs)
    setState(demoRoute.state)
    router.replace(demoRoute.href)
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
    setState(nextState)
    router.replace(buildViewerHref(nextState))
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
    if (!scene.error || state.entry === 'demo') {
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
      setState(demoRoute.state)
      router.replace(demoRoute.href)
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [router, scene.error, state.entry])

  useEffect(() => {
    writeViewerSettings(viewerSettings)
  }, [viewerSettings])

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
    if (!hasVerifiedLiveState || state.entry === 'demo') {
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
  }, [hasVerifiedLiveState, state.entry])

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
    if (!hasVerifiedLiveState || state.location !== 'granted') {
      return
    }

    let disposed = false
    let tracker: ReturnType<typeof startObserverTracking> | null = null

    const handleObserverUpdate = (nextObserver: ObserverState) => {
      setLiveObserver(nextObserver)
      setLiveLocationError(null)
    }

    requestStartupObserverState()
      .then((nextObserver) => {
        if (disposed) {
          return
        }

        handleObserverUpdate(nextObserver)
        tracker = startObserverTracking(handleObserverUpdate, {
          initialObserver: nextObserver,
          onError: () => {
            if (!disposed) {
              setLiveLocationError(
                'SkyLens keeps your last accepted observer until the next fix moves more than 25 meters or 15 seconds have elapsed.',
              )
            }
          },
        })
      })
      .catch(() => {
        if (!disposed) {
          setLiveObserver(null)
          setLiveLocationError(
            'Location access was granted, but the initial high-accuracy fix did not arrive in time.',
          )
        }
      })

    return () => {
      disposed = true
      tracker?.stop()
    }
  }, [hasVerifiedLiveState, state.location])

  useEffect(() => {
    if (!hasVerifiedLiveState || state.camera !== 'granted' || !videoElement) {
      return
    }

    let disposed = false

    requestRearCameraStream()
      .then(async (stream) => {
        if (disposed) {
          stopMediaStream(stream)
          return
        }

        cameraStreamRef.current = stream
        videoElement.srcObject = stream
        await videoElement.play().catch(() => undefined)
        setLiveCameraError(null)
        setLiveCameraStreamActive(true)
      })
      .catch(() => {
        if (!disposed) {
          setLiveCameraError(
            'SkyLens retried exact environment first, then environment fallback, without requesting microphone access.',
          )
          setLiveCameraStreamActive(false)
        }
      })

    return () => {
      disposed = true
      videoElement.srcObject = null
      stopMediaStream(cameraStreamRef.current)
      cameraStreamRef.current = null
      setLiveCameraStreamActive(false)
    }
  }, [hasVerifiedLiveState, state.camera, videoElement])

  useEffect(() => {
    orientationControllerRef.current?.stop()
    orientationControllerRef.current = null
    poorSinceRef.current = null

    if (!hasVerifiedLiveState || manualMode) {
      return
    }

    const controller = subscribeToOrientationPose(
      ({ pose, sample }) => {
        setSensorCameraPose(pose)

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
      },
      {
        offsets: {
          headingDeg: viewerSettings.headingOffsetDeg,
          pitchDeg: viewerSettings.pitchOffsetDeg,
        },
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
    hasVerifiedLiveState,
    manualMode,
    viewerSettings.headingOffsetDeg,
    viewerSettings.pitchOffsetDeg,
  ])

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

  const recenter = () => {
    setShowAlignmentGuidance(false)

    if (manualMode) {
      setManualPoseState(recenterManualPose())
      return
    }

    orientationControllerRef.current?.recenter()
  }

  const fixAlignment = () => {
    setShowAlignmentGuidance(true)
  }

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
        {renderedDisplayedObjects.map((object) => (
          <button
            key={object.object.id}
            type="button"
            onClick={() =>
              setSelectedObjectId((current) =>
                current === object.object.id ? null : object.object.id,
              )
            }
            aria-pressed={selectedObject?.id === object.object.id}
            className={`absolute min-h-11 min-w-[44px] rounded-2xl border px-3 py-2 text-left text-xs shadow-[0_12px_30px_rgba(3,7,13,0.22)] ${
              prefersReducedMotion ? '' : 'transition'
            } ${
              centerLockedObject?.id === object.object.id ||
              selectedObject?.id === object.object.id
                ? 'border-amber-200/70 bg-amber-200/18 text-amber-50'
                : 'border-sky-100/18 bg-slate-950/65 text-sky-50'
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
          </button>
        ))}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-16 w-16 rounded-full border border-sky-100/40">
            <div className="absolute inset-x-1/2 top-2 h-12 w-px -translate-x-1/2 bg-sky-50/80" />
            <div className="absolute inset-y-1/2 left-2 h-px w-12 -translate-y-1/2 bg-sky-50/80" />
          </div>
        </div>
      </div>

      <div className="pointer-events-none relative z-10 flex min-h-screen flex-col justify-between px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
        <header className="flex items-start justify-between gap-3">
          <div className="pointer-events-auto shell-panel rounded-[1.5rem] px-4 py-3">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-sky-200/65">
                  SkyLens
                </p>
                <p className="text-sm text-sky-50/90">{experience.title}</p>
              </div>
              <div className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100/85">
                {alignmentBadgeValue(state, cameraPose)}
              </div>
            </div>
          </div>
          <div className="pointer-events-auto">
            <SettingsSheet
              onEnterDemoMode={handleEnterDemoMode}
              onDemoScenarioSelect={handleSelectDemoScenario}
              onFixAlignment={fixAlignment}
              onRecenter={recenter}
              canFixAlignment={experience.mode !== 'blocked'}
              canRecenter={experience.mode !== 'blocked'}
              headingOffsetDeg={viewerSettings.headingOffsetDeg}
              pitchOffsetDeg={viewerSettings.pitchOffsetDeg}
              verticalFovAdjustmentDeg={viewerSettings.verticalFovAdjustmentDeg}
              layers={enabledLayers}
              layerAvailabilityLabels={{
                aircraft:
                  getAircraftAvailabilityMessage(activeAircraftAvailability) ?? undefined,
                satellites: getSatelliteLayerStatusLabel(healthStatus),
              }}
              likelyVisibleOnly={likelyVisibleOnly}
              demoScenarioId={state.entry === 'demo' ? demoScenario.id : undefined}
              demoScenarioOptions={state.entry === 'demo' ? demoScenarioOptions : []}
              onLayerToggle={(layer, enabled) => {
                setViewerSettings((current) => ({
                  ...current,
                  enabledLayers: {
                    ...current.enabledLayers,
                    [layer]: enabled,
                  },
                }))
              }}
              onLikelyVisibleOnlyChange={(enabled) => {
                setViewerSettings((current) => ({
                  ...current,
                  likelyVisibleOnly: enabled,
                }))
              }}
              onHeadingOffsetChange={(value) => {
                setViewerSettings((current) => ({
                  ...current,
                  headingOffsetDeg: value,
                }))
              }}
              onPitchOffsetChange={(value) => {
                setViewerSettings((current) => ({
                  ...current,
                  pitchOffsetDeg: value,
                }))
              }}
              onVerticalFovAdjustmentChange={(value) => {
                setViewerSettings((current) => ({
                  ...current,
                  verticalFovAdjustmentDeg: value,
                }))
              }}
            />
          </div>
        </header>

        <section className="mx-auto flex w-full max-w-5xl flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <StatusBadge
              label="Location"
              value={
                state.entry === 'demo'
                  ? 'Demo scenario'
                  : observer
                    ? `Ready ±${Math.round(observer.accuracyMeters ?? 0)}m`
                    : badgeValue(state.location)
              }
            />
            <StatusBadge
              label="Camera"
              value={
                state.camera === 'granted' && cameraStreamActive
                  ? 'Ready'
                  : badgeValue(state.camera)
              }
            />
            <StatusBadge
              label="Motion"
              value={getMotionBadgeValue(experience.mode, state, cameraPose)}
            />
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
                {blockingEyebrow(state)}
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
                <button
                  type="button"
                  onClick={handleRetryPermissions}
                  disabled={isPending}
                  className="rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-wait disabled:bg-amber-100"
                >
                  {isPending ? 'Retrying permissions...' : 'Retry permissions'}
                </button>
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
              {showAlignmentGuidance && !manualMode ? (
                <FallbackBanner
                  title="Alignment looks off."
                  body="Move phone in a figure eight or tap Fix alignment."
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
                        : `${experience.body} ${renderedDisplayedObjects.length} labels are currently eligible on screen.`}
                    </p>
                  </div>
                  <div className="rounded-[1.25rem] border border-sky-100/10 bg-white/5 px-4 py-3 text-sm text-sky-100/75">
                    <p>Yaw {Math.round(cameraPose.yawDeg)}°</p>
                    <p>Pitch {Math.round(cameraPose.pitchDeg)}°</p>
                    <p>
                      FOV {getEffectiveVerticalFovDeg(viewerSettings.verticalFovAdjustmentDeg)}°
                      {' '}vertical
                    </p>
                    <p>Visible labels {renderedDisplayedObjects.length}</p>
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

function buildSkyScene({
  observer,
  timeMs,
  enabledLayers,
  likelyVisibleOnly,
  focusedObjectId,
  aircraftSnapshot,
  satelliteCatalog,
  cameraPose,
  viewport,
  verticalFovAdjustmentDeg,
}: {
  observer: ObserverState
  timeMs: number
  enabledLayers: Record<EnabledLayer, boolean>
  likelyVisibleOnly: boolean
  focusedObjectId: string | null
  aircraftSnapshot: AircraftApiResponse | null
  satelliteCatalog: TleApiResponse | null
  cameraPose: CameraPose
  viewport: {
    width: number
    height: number
  }
  verticalFovAdjustmentDeg: number
}) {
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
    const constellations = buildVisibleConstellations({
      cameraPose,
      viewport,
      verticalFovAdjustmentDeg,
      enabledLayers,
      likelyVisibleOnly,
      sunAltitudeDeg: celestial.sunAltitudeDeg,
      visibleStars: stars,
      starCatalog: STAR_CATALOG,
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
        ...constellations.objects,
      ],
      lineSegments: constellations.lineSegments,
      error: null,
    }
  } catch (error) {
    return {
      ...EMPTY_SCENE,
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

function getBlockingCopy(state: ViewerRouteState) {
  if (
    state.location === 'unknown' ||
    state.camera === 'unknown' ||
    state.orientation === 'unknown'
  ) {
    return {
      title: 'Start SkyLens to continue.',
      body: 'The viewer needs a verified permission result before it can enter live or fallback mode. Start from the landing screen, or retry permissions here if you opened /view directly.',
    }
  }

  return {
    title: 'SkyLens needs your location to know what is above you.',
    body: 'The viewer will stay blocked until location access is granted. Camera frames stay on your device, and location is used only to calculate what is above you right now.',
  }
}

function blockingEyebrow(state: ViewerRouteState) {
  if (
    state.location === 'unknown' ||
    state.camera === 'unknown' ||
    state.orientation === 'unknown'
  ) {
    return 'Start required'
  }

  return 'Location required'
}

function getMotionBadgeValue(
  experienceMode: ReturnType<typeof describeViewerExperience>['mode'],
  state: ViewerRouteState,
  cameraPose: CameraPose,
) {
  if (experienceMode === 'blocked') {
    return badgeValue(state.orientation)
  }

  if (cameraPose.mode === 'manual') {
    return 'Manual pan'
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

function alignmentBadgeValue(state: ViewerRouteState, cameraPose: CameraPose) {
  if (state.entry === 'demo') {
    return 'Demo controls'
  }

  if (
    state.location === 'unknown' ||
    state.camera === 'unknown' ||
    state.orientation === 'unknown'
  ) {
    return 'Pending start'
  }

  if (state.location !== 'granted') {
    return 'Location required'
  }

  if (cameraPose.mode === 'manual') {
    return 'Manual pan'
  }

  if (cameraPose.alignmentHealth === 'good') {
    return 'Alignment good'
  }

  if (cameraPose.alignmentHealth === 'poor') {
    return 'Alignment poor'
  }

  return 'Alignment fair'
}
