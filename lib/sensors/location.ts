import type { ObserverState } from '../viewer/contracts'

export interface GeolocationCoordinatesLike {
  latitude: number
  longitude: number
  altitude: number | null
  accuracy: number
}

export interface GeolocationPositionLike {
  coords: GeolocationCoordinatesLike
  timestamp: number
}

export interface GeolocationRuntime {
  getCurrentPosition: (
    successCallback: PositionCallback,
    errorCallback?: PositionErrorCallback,
    options?: PositionOptions,
  ) => void
  watchPosition: (
    successCallback: PositionCallback,
    errorCallback?: PositionErrorCallback,
    options?: PositionOptions,
  ) => number
  clearWatch: (watchId: number) => void
}

export interface ObserverTrackingOptions {
  movementThresholdMeters?: number
  elapsedThresholdMs?: number
}

const DEFAULT_MOVEMENT_THRESHOLD_METERS = 25
const DEFAULT_ELAPSED_THRESHOLD_MS = 15_000

export async function requestLocationPermission(
  runtime?: Pick<GeolocationRuntime, 'getCurrentPosition'>,
): Promise<'granted' | 'denied' | 'unavailable'> {
  const geolocation = runtime ?? getBrowserGeolocation()

  if (!geolocation) {
    return 'unavailable'
  }

  try {
    await getCurrentPosition(geolocation, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10_000,
    })
    return 'granted'
  } catch {
    return 'denied'
  }
}

export async function requestStartupObserverState(
  runtime?: Pick<GeolocationRuntime, 'getCurrentPosition'>,
): Promise<ObserverState> {
  const geolocation = runtime ?? getBrowserGeolocation()

  if (!geolocation) {
    throw new Error('location-unavailable')
  }

  const position = await getCurrentPosition(geolocation, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 10_000,
  })

  return toObserverState(position, 'live')
}

export function startObserverTracking(
  onUpdate: (observerState: ObserverState) => void,
  {
    runtime,
    initialObserver,
    movementThresholdMeters = DEFAULT_MOVEMENT_THRESHOLD_METERS,
    elapsedThresholdMs = DEFAULT_ELAPSED_THRESHOLD_MS,
    onError,
  }: ObserverTrackingOptions & {
    runtime?: GeolocationRuntime
    initialObserver?: ObserverState | null
    onError?: (error: GeolocationPositionError) => void
  } = {},
) {
  const geolocation = runtime ?? getBrowserGeolocation()

  if (!geolocation) {
    return { stop() {} }
  }

  let lastAccepted = initialObserver ?? null

  const watchId = geolocation.watchPosition(
    (position) => {
      const nextObserver = toObserverState(position, 'live')

      if (
        !lastAccepted ||
        shouldAcceptObserverUpdate(lastAccepted, nextObserver, {
          movementThresholdMeters,
          elapsedThresholdMs,
        })
      ) {
        lastAccepted = nextObserver
        onUpdate(nextObserver)
      }
    },
    (error) => onError?.(error),
    {
      enableHighAccuracy: false,
      maximumAge: 5_000,
      timeout: 15_000,
    },
  )

  return {
    stop() {
      geolocation.clearWatch(watchId)
    },
  }
}

export function shouldAcceptObserverUpdate(
  previous: ObserverState,
  next: ObserverState,
  {
    movementThresholdMeters = DEFAULT_MOVEMENT_THRESHOLD_METERS,
    elapsedThresholdMs = DEFAULT_ELAPSED_THRESHOLD_MS,
  }: ObserverTrackingOptions = {},
) {
  const distanceMeters = getDistanceMeters(previous, next)
  const elapsedMs = next.timestampMs - previous.timestampMs

  return (
    distanceMeters > movementThresholdMeters || elapsedMs >= elapsedThresholdMs
  )
}

export function toObserverState(
  position: GeolocationPositionLike,
  source: ObserverState['source'],
): ObserverState {
  return {
    lat: position.coords.latitude,
    lon: position.coords.longitude,
    altMeters: position.coords.altitude ?? 0,
    accuracyMeters: position.coords.accuracy,
    timestampMs: position.timestamp,
    source,
  }
}

export function getDistanceMeters(
  left: Pick<ObserverState, 'lat' | 'lon'>,
  right: Pick<ObserverState, 'lat' | 'lon'>,
) {
  const earthRadiusMeters = 6_371_000
  const lat1 = degreesToRadians(left.lat)
  const lat2 = degreesToRadians(right.lat)
  const deltaLat = degreesToRadians(right.lat - left.lat)
  const deltaLon = degreesToRadians(right.lon - left.lon)
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getCurrentPosition(
  geolocation: Pick<GeolocationRuntime, 'getCurrentPosition'>,
  options: PositionOptions,
) {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    geolocation.getCurrentPosition(resolve, reject, options)
  })
}

function getBrowserGeolocation() {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return null
  }

  return navigator.geolocation
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180
}
