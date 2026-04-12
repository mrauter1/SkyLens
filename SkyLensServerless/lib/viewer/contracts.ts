export type AlignmentHealth = 'good' | 'fair' | 'poor'
export type CameraMode = 'sensor' | 'manual'
export type ObserverSource = 'geo' | 'manual'
export type StartupState =
  | 'unsupported'
  | 'ready-to-request'
  | 'requesting'
  | 'camera-only'
  | 'sensor-relative-needs-calibration'
  | 'sensor-absolute'
  | 'manual'
  | 'error'
export type ObjectType =
  | 'aircraft'
  | 'satellite'
  | 'sun'
  | 'moon'
  | 'planet'
  | 'star'
  | 'constellation'

export interface ObserverState {
  lat: number
  lon: number
  altMeters: number
  accuracyMeters?: number
  timestampMs: number
  source: 'live' | 'demo' | 'manual' | 'fallback'
}

export interface CameraPose {
  yawDeg: number
  pitchDeg: number
  rollDeg: number
  quaternion: [number, number, number, number]
  alignmentHealth: AlignmentHealth
  mode: CameraMode
}

export interface SkyObject {
  id: string
  type: ObjectType
  label: string
  sublabel?: string
  azimuthDeg: number
  elevationDeg: number
  rangeKm?: number
  magnitude?: number
  importance: number
  metadata: Record<string, unknown>
}

export interface StarCatalogEntry {
  id: string
  name: string
  raDeg: number
  decDeg: number
  magnitude: number
}

export interface ConstellationCatalogEntry {
  id: string
  name: string
  lineSegments: Array<[string, string]>
}
