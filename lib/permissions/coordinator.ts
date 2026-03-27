import {
  DEFAULT_DEMO_SCENARIO_ID,
  isDemoScenarioId,
  type DemoScenarioId,
} from '../demo/scenarios'
import { probeRearCameraPermission } from '../projection/camera'
import { requestLocationPermission } from '../sensors/location'
import {
  requestOrientationPermission,
} from '../sensors/orientation'
export { supportsOrientationEvents } from '../sensors/orientation'

export type PermissionStatusValue = 'granted' | 'denied' | 'unavailable' | 'unknown'
export type ViewerEntryMode = 'live' | 'demo'

export type ViewerRouteState = {
  entry: ViewerEntryMode
  location: PermissionStatusValue
  camera: PermissionStatusValue
  orientation: PermissionStatusValue
  demoScenarioId?: DemoScenarioId
}

type PermissionRuntime = {
  requestLocation: () => Promise<PermissionStatusValue>
  requestCamera: () => Promise<PermissionStatusValue>
  requestOrientation: () => Promise<PermissionStatusValue>
}

type ViewerSearchParams =
  | URLSearchParams
  | {
      get(name: string): string | null
    }

type ExperienceDescription = {
  mode: 'blocked' | 'live' | 'non-camera' | 'manual-pan' | 'demo'
  title: string
  body: string
}

export async function runStartFlow(
  runtime: PermissionRuntime = defaultRuntime,
): Promise<ViewerRouteState> {
  const orientation = await runtime.requestOrientation()
  const camera = await runtime.requestCamera()
  const location = await runtime.requestLocation()

  return {
    entry: 'live',
    location,
    camera,
    orientation,
  }
}

export function createDemoViewerState(
  demoScenarioId: DemoScenarioId = DEFAULT_DEMO_SCENARIO_ID,
): ViewerRouteState {
  return {
    entry: 'demo',
    location: 'unavailable',
    camera: 'unavailable',
    orientation: 'unavailable',
    demoScenarioId,
  }
}

export function createDemoViewerRoute(
  demoScenarioId: DemoScenarioId = DEFAULT_DEMO_SCENARIO_ID,
) {
  const state = createDemoViewerState(demoScenarioId)

  return {
    state,
    href: buildViewerHref(state),
  }
}

export function buildViewerHref(state: ViewerRouteState): string {
  const params = new URLSearchParams({
    entry: state.entry,
    location: state.location,
    camera: state.camera,
    orientation: state.orientation,
  })

  if (state.entry === 'demo') {
    params.set('demoScenario', state.demoScenarioId ?? DEFAULT_DEMO_SCENARIO_ID)
  }

  return `/view?${params.toString()}`
}

export function parseViewerRouteState(searchParams: ViewerSearchParams): ViewerRouteState {
  const entry = parseEntry(searchParams.get('entry'))

  if (entry === 'demo') {
    return {
      entry,
      location: parseStatus(searchParams.get('location'), 'unavailable'),
      camera: parseStatus(searchParams.get('camera'), 'unavailable'),
      orientation: parseStatus(searchParams.get('orientation'), 'unavailable'),
      demoScenarioId: parseDemoScenarioId(searchParams.get('demoScenario')),
    }
  }

  return {
    entry: 'live',
    location: parseStatus(searchParams.get('location'), 'unknown'),
    camera: parseStatus(searchParams.get('camera'), 'unknown'),
    orientation: parseStatus(searchParams.get('orientation'), 'unknown'),
  }
}

export function describeViewerExperience(state: ViewerRouteState): ExperienceDescription {
  if (state.entry === 'demo') {
    return {
      mode: 'demo',
      title: 'Demo viewer',
      body: 'The live overlay shell is running against a non-camera demo backdrop so SkyLens stays presentable after denial or on desktop.',
    }
  }

  if (hasUnknownPermissions(state)) {
    return {
      mode: 'blocked',
      title: 'Start AR to continue',
      body: 'Open the live viewer startup controller to request motion, camera, and location from the same in-view flow.',
    }
  }

  if (state.orientation !== 'granted') {
    return {
      mode: 'manual-pan',
      title: 'Manual pan fallback',
      body: 'SkyLens is staying open with manual panning until motion access becomes available again.',
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

export function hasVerifiedLiveViewerState(state: ViewerRouteState) {
  return state.entry === 'live' && !hasUnknownPermissions(state)
}

const defaultRuntime: PermissionRuntime = {
  requestLocation: requestLocationPermission,
  requestCamera: probeRearCameraPermission,
  requestOrientation: requestOrientationPermission,
}

function parseEntry(value: string | null): ViewerEntryMode {
  return value === 'demo' ? 'demo' : 'live'
}

function parseStatus(
  value: string | null,
  fallback: PermissionStatusValue,
): PermissionStatusValue {
  if (
    value === 'granted' ||
    value === 'denied' ||
    value === 'unavailable' ||
    value === 'unknown'
  ) {
    return value
  }

  return fallback
}

function parseDemoScenarioId(value: string | null): DemoScenarioId {
  return isDemoScenarioId(value) ? value : DEFAULT_DEMO_SCENARIO_ID
}

function hasUnknownPermissions(state: ViewerRouteState) {
  return (
    state.location === 'unknown' ||
    state.camera === 'unknown' ||
    state.orientation === 'unknown'
  )
}
