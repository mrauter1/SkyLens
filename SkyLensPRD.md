I tightened a few things to make it more agent-safe: explicit env/config, a stricter calibration contract, satellite deduping, demo-mode offline behavior, required scripts, and a few ambiguity fixes around visibility and label budgets.

SkyLens v1 — Agent-Ready Product Requirements Document

Status: Approved for implementation
Audience: An autonomous coding agent such as Codex CLI, plus human reviewers
Document intent: This PRD is complete enough to implement v1 without inventing product scope, core architecture, data contracts, or critical interaction rules.

⸻

1. Product summary

SkyLens is a mobile-first web app that lets a user point their phone at the sky and instantly see labels for what is above them.

V1 must identify and render, in real time:
	•	nearby aircraft
	•	the ISS
	•	curated visible satellites
	•	the Sun and Moon
	•	visible planets
	•	curated bright stars
	•	simplified constellation overlays

The primary experience is zero-learning-curve:
	1.	open the site
	2.	tap Start
	3.	grant permissions
	4.	point the phone at the sky
	5.	see stable labels and tap for details

This is not a developer tool. It is a consumer-grade, visually impressive, low-cognitive-load experience.

⸻

2. Core product goal

Deliver a convincing point-and-see sky-identification experience in a phone browser with deterministic, explainable behavior and no required account, prompt, upload, or setup.

⸻

3. Success criteria

3.1 Primary success criteria
	•	A first-time user can get from landing page to visible overlay in under 10 seconds.
	•	On a warm cache and good network, time from tapping Start SkyLens to first visible overlay is under 3 seconds.
	•	The core flow requires no text input.
	•	Labels remain readable and collision-managed in dense scenes.
	•	The app feels stable enough to be demoed live on a phone without manual patching.

3.2 Secondary success criteria
	•	The app can be installed to the home screen as a PWA.
	•	The app remains useful when camera or motion permissions are denied.
	•	Camera frames never leave the device.
	•	Server state stays minimal and disposable.

⸻

4. Non-goals

These items are explicitly out of scope for v1:
	•	native iOS or Android apps
	•	ARKit, ARCore, or WebXR anchoring
	•	identifying every satellite in orbit
	•	deep-sky objects such as nebulae and galaxies
	•	photo recognition or computer vision of stars from the camera image
	•	social features, accounts, or feeds
	•	historical replay of the full sky
	•	voice features
	•	ads, subscriptions, or payments
	•	flight route lookup beyond what OpenSky directly exposes
	•	persistent user profiles or cloud sync
	•	offline live aircraft fetching

⸻

5. Locked v1 scope

V1 must support only these object classes.

5.1 Aircraft
	•	Source: OpenSky REST API through a server-side proxy/cache
	•	Show only aircraft within 250 km radius of the observer
	•	Show only aircraft with computed elevation >= 2°
	•	Candidate budget before collision filtering: up to 12 aircraft
	•	Aircraft layer is allowed to disappear gracefully when OpenSky is unavailable

5.2 Satellites
	•	Source: CelesTrak current GP/TLE groups via backend cache
	•	Included groups:
	•	ISS
	•	Space Stations
	•	100 Brightest
	•	Show only satellites with elevation >= 10°
	•	Candidate budget before collision filtering: up to 8 satellites
	•	ISS must always be included if present in source data
	•	If the same NORAD ID appears in multiple groups, it must be deduplicated into one satellite object

5.3 Celestial bodies

Include:
	•	Sun
	•	Moon
	•	Mercury
	•	Venus
	•	Mars
	•	Jupiter
	•	Saturn
	•	Uranus
	•	Neptune

Rules:
	•	Always show Sun if above horizon
	•	Always show Moon if above horizon
	•	Show planets if above horizon
	•	When Likely visible only is enabled, dim or suppress objects according to Section 19

5.4 Bright stars
	•	Ship a static bundled dataset at public/data/stars_200.json
	•	Each star record must include:
	•	id
	•	name
	•	raDeg
	•	decDeg
	•	magnitude
	•	Candidate budget before collision filtering: up to 30 stars
	•	Stars are only eligible for display when visibility rules permit them

5.5 Constellations
	•	Ship a static bundled dataset at public/data/constellations.json
	•	Use line segments connecting star IDs from stars_200.json
	•	Draw only line overlays and constellation names
	•	Do not implement full IAU boundaries in v1

⸻

6. Technical assumptions and source-of-truth dependencies

The app must be implemented as a secure-context mobile web app. getUserMedia() is available only in secure contexts, and device orientation data is also treated as a secure-context feature in current browser/platform guidance. Some environments require explicit permission for orientation and motion, and DeviceOrientationEvent.requestPermission() / DeviceMotionEvent.requestPermission() must be called from a user gesture when required.  ￼

Astronomy calculations must use Astronomy Engine as the source of truth for Sun, Moon, planets, and horizontal-coordinate calculations. Astronomy Engine documents topocentric/horizon calculations and describes itself as accurate to about ±1 arcminute.  ￼

Satellite propagation must use satellite.js, which supports TLE or OMM propagation in JavaScript using SGP4/SDP4 and includes coordinate transform helpers.  ￼

Aircraft data must be fetched through a server-side OpenSky proxy. OpenSky now documents OAuth2 client credentials for authenticated access and also documents that anonymous access is limited to the most recent state vectors at 10-second resolution.  ￼

Satellite element data must come from CelesTrak current GP/TLE groups, specifically the groups used by this product scope. CelesTrak publishes current group data, including Space Stations and 100 Brightest.  ￼

The app shell must use Next.js App Router and PWA-friendly manifest support. Next.js documents built-in support for app/manifest.ts in the App Router.  ￼

⸻

7. Locked technology choices

These choices are fixed for v1 and must not be changed unless a human reviewer explicitly approves the change.
	•	Framework: Next.js App Router
	•	Language: TypeScript
	•	Package manager: npm
	•	Styling: Tailwind CSS
	•	Client state: React state plus a small store; Zustand is allowed
	•	Runtime validation: Zod
	•	Unit/integration tests: Vitest
	•	Browser E2E tests: Playwright
	•	Rendering:
	•	camera preview via <video>
	•	lines, reticle, and trails via one full-screen <canvas>
	•	labels and cards via absolutely positioned HTML
	•	Astronomy library: astronomy-engine
	•	Satellite library: satellite.js
	•	Backend: Next.js Route Handlers on the Node runtime
	•	Deployment target: self-hosted Node server or any Node-capable platform
	•	Cache: in-memory cache behind a cache interface
	•	PWA support:
	•	manifest required
	•	icons required
	•	service worker is optional
	•	offline live mode is not required for v1

⸻

8. Environment variables and external configuration

The implementation must support these environment variables:
	•	OPENSKY_CLIENT_ID — optional but recommended
	•	OPENSKY_CLIENT_SECRET — optional but recommended
	•	SKYLENS_BUILD_VERSION — optional; surfaced by /api/config

Rules:
	•	If OpenSky credentials are present, use authenticated OpenSky access.
	•	If OpenSky credentials are absent, attempt anonymous access only where supported by OpenSky’s latest-state limitations.
	•	If neither authenticated nor anonymous OpenSky access succeeds, the app must hide aircraft gracefully and continue.

⸻

9. Privacy and trust requirements

These are product requirements.
	•	Camera frames must never be uploaded to the server.
	•	The server must not persist raw user location.
	•	The backend may receive current location only as request parameters for aircraft filtering.
	•	The app must function without login.
	•	The UI must clearly state:
	•	Camera stays on your device.
	•	Location is used only to calculate what is above you right now.

⸻

10. Target platforms

10.1 Primary
	•	iPhone Safari, latest major version and previous major version
	•	Android Chrome, latest major version and previous major version

10.2 Secondary
	•	Samsung Internet, best effort
	•	desktop browsers, fallback mode only

Desktop is not required to support live camera-overlay mode.

⸻

11. User stories

11.1 Primary user story

As a user standing outdoors, I want to point my phone at the sky and immediately know what I am looking at.

11.2 Supporting user stories
	•	As a user, I want to identify a plane overhead without typing anything.
	•	As a user, I want to know whether a bright moving point is the ISS or another satellite.
	•	As a user, I want planets and constellations to appear in the right area of the sky.
	•	As a user, I want to tap a label to see simple details.
	•	As a user, I want the app to still do something useful if I deny camera or motion access.
	•	As a user, I want a built-in demo mode so the product can still be shown indoors or on desktop.

⸻

12. UX overview

12.1 First-run flow
	1.	User opens /
	2.	Full-screen hero appears with title, subtext, privacy reassurance, and one primary button: Start SkyLens
	3.	After tap, app requests permissions in this order:
	•	location
	•	camera
	•	orientation/motion
	4.	On success, app navigates to /view and starts the live overlay
	5.	If any permission is denied, app enters the appropriate fallback state

12.2 Main view

The main view is full-screen and contains:
	•	rear camera video background
	•	center reticle
	•	canvas-drawn constellation lines and optional motion trails
	•	floating labels for visible objects
	•	a small top bar with:
	•	app name
	•	settings button
	•	compact alignment status indicator
	•	a bottom dock card that shows the currently centered object or a hint when no object is centered

12.3 Interaction model

There are only four primary interactions:
	•	point phone
	•	tap object label
	•	tap centered-object card
	•	open settings

No text input is required anywhere in the core flow.

⸻

13. Routes and screens

13.1 /

Landing/start screen.

Required elements:
	•	product name
	•	one-sentence description: Point your phone at the sky and see what’s above you.
	•	privacy reassurance copy
	•	Start SkyLens button
	•	Try demo mode secondary link

13.2 /view

Main live experience.

Required elements:
	•	full-screen video
	•	overlay canvas
	•	HTML labels
	•	center reticle
	•	bottom dock object card
	•	settings sheet trigger
	•	permission/alignment status badges

13.3 Settings sheet

Bottom sheet, not a separate route.

Required controls:
	•	toggle: Planes
	•	toggle: Satellites
	•	toggle: Planets
	•	toggle: Stars
	•	toggle: Constellations
	•	toggle: Likely visible only
	•	action: Fix alignment
	•	action: Recenter
	•	action: Enter demo mode

13.4 Demo/fallback mode

If camera is denied or unavailable:
	•	render the same overlay on a dark gradient background instead of video
	•	if motion/orientation is available, keep point-and-see behavior using device motion only
	•	if motion/orientation is unavailable, allow:
	•	horizontal drag = yaw
	•	vertical drag = pitch
	•	double tap = recenter
	•	demo mode must be usable on desktop

⸻

14. Functional requirements

14.1 Launch and permission requirements
	•	The app must request permissions only after the user taps Start SkyLens
	•	The app must feature-detect orientation permission APIs before calling them
	•	If location is denied:
	•	show a blocking prompt explaining that the app needs location to know what is above the user
	•	offer Retry permissions
	•	offer Try demo mode
	•	If camera is denied:
	•	enter non-camera fallback mode
	•	continue using location and motion if available
	•	If orientation/motion is denied:
	•	enter manual pan fallback mode
	•	keep camera if available

14.2 Camera requirements
	•	Request rear camera with facingMode: { exact: 'environment' }
	•	If that fails, retry with facingMode: 'environment'
	•	Preferred resolution: 1280x720 or nearest supported resolution
	•	Do not request microphone access
	•	Video element must cover the full viewport using object-fit: cover

14.3 Orientation requirements
	•	Prefer deviceorientationabsolute when supported
	•	Otherwise use deviceorientation
	•	If both are unavailable, enter manual pan fallback mode
	•	Raw jitter must not be drawn directly
	•	The app must expose a normalized camera pose interface even if the raw browser events differ by platform

14.4 Location requirements
	•	Request high accuracy once at startup
	•	After startup, watch position with moderate accuracy
	•	Update observer location only when:
	•	position changes by more than 25 meters, or
	•	15 seconds have elapsed
	•	If altitude is unavailable, use 0 meters

14.5 Object overlay requirements

Every visible object must have:
	•	world coordinates
	•	projected screen coordinates
	•	visibility score
	•	rank score
	•	label payload

Rules:
	•	Only objects in front of the camera frustum may be rendered
	•	Labels must never render outside viewport bounds
	•	Lower-ranked labels must be suppressed if they collide with higher-ranked labels

14.6 Center reticle requirements
	•	A fixed reticle must remain at screen center
	•	The app must continuously determine the highest-ranked object within a center-lock radius of 4°
	•	Center-lock must be computed using angular distance from the camera center ray, not pixel distance
	•	If an object is center-locked, the bottom card must show it as the focused object
	•	If no object is center-locked, the bottom card must show a hint such as:
	•	Move until an object snaps here

14.7 Detail card requirements

On tap or center-lock, the app must show a detail card.

Aircraft
	•	callsign if available, otherwise Unknown flight
	•	type: Aircraft
	•	altitude in feet and meters
	•	heading cardinal direction if available
	•	speed if available
	•	range from observer
	•	origin country if available

Satellite
	•	name
	•	type: Satellite
	•	NORAD ID
	•	current elevation
	•	current azimuth
	•	range if available
	•	special badge for ISS

Planet / Sun / Moon
	•	name
	•	type
	•	current elevation
	•	current azimuth
	•	constellation name if available
	•	magnitude if available

Star
	•	name
	•	type: Star
	•	magnitude
	•	current elevation
	•	constellation name if available

Constellation
	•	name
	•	type: Constellation
	•	brief text: Major star pattern

14.8 Settings requirements

Settings must persist in localStorage.

Persisted values:
	•	enabled layers
	•	likely-visible-only toggle
	•	heading offset adjustment
	•	pitch offset adjustment
	•	vertical FOV adjustment
	•	onboarding completed flag

⸻

15. Shared data model

All object classes must be normalized into a shared client model before projection.

export type ObjectType =
  | 'aircraft'
  | 'satellite'
  | 'sun'
  | 'moon'
  | 'planet'
  | 'star'
  | 'constellation'

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

15.1 Star catalog shape

export interface StarCatalogEntry {
  id: string
  name: string
  raDeg: number
  decDeg: number
  magnitude: number
}

15.2 Constellation catalog shape

export interface ConstellationCatalogEntry {
  id: string
  name: string
  lineSegments: Array<[string, string]> // star IDs
}

15.3 Stable identity rules
	•	SkyObject.id must remain stable across recomputations for the same real-world object
	•	Satellites must use stable IDs based on NORAD ID
	•	Aircraft must use stable IDs based on ICAO24 where available
	•	Stable IDs are required for trails, focused-object continuity, and testability

⸻

16. Data pipelines

16.1 Pipeline overview

All object classes must be normalized into SkyObject before projection, ranking, or labeling.

16.2 Celestial pipeline
	•	Use Astronomy Engine on the client
	•	Compute positions for Sun, Moon, and planets once per second using observer lat/lon/alt and current time
	•	Convert to topocentric horizontal coordinates
	•	Include apparent magnitude when available
	•	Compute constellation name when available

16.3 Star pipeline
	•	Load stars_200.json once at app startup
	•	Convert RA/Dec to horizontal coordinates once per second
	•	Exclude stars with elevation < 0°
	•	If likelyVisibleOnly is enabled, stars are eligible only when Sun altitude <= -6°

16.4 Constellation pipeline
	•	Load constellations.json once at app startup
	•	Each constellation must reference star IDs from stars_200.json
	•	Project line segments only when both endpoint stars are above the horizon and in or near the visible frustum
	•	Constellation names appear only if at least 2 line segments from that constellation are on screen

16.5 Satellite pipeline
	•	Fetch /api/tle once at startup
	•	Refresh TLE cache every 6 hours
	•	Propagate TLEs on the client once per second
	•	Convert satellite positions to observer-relative azimuth/elevation
	•	Hide satellites with elevation < 10°
	•	Deduplicate by NORAD ID across all included groups
	•	ISS must set metadata.isIss = true

When likelyVisibleOnly is enabled:
	•	satellites are eligible only if Sun altitude <= -4°

16.6 Aircraft pipeline
	•	Fetch /api/aircraft every 10 seconds while /view is active
	•	Backend must filter by radius and compute observer-relative azimuth, elevation, and range
	•	Client must never call OpenSky directly
	•	Hide aircraft with elevation < 2°
	•	Ignore aircraft with missing latitude, longitude, or altitude

⸻

17. Coordinate and projection system

This section is implementation-critical.

17.1 Geodetic basis

Use WGS84 geodetic coordinates for observer and object positions where relevant.

17.2 World coordinates

All object positions must be expressed in local topocentric horizontal coordinates:
	•	azimuth in degrees, 0 = north, 90 = east
	•	elevation in degrees, 0 = horizon, +90 = zenith

17.3 Camera orientation model

The client must maintain a smoothed camera orientation state with:
	•	yawDeg
	•	pitchDeg
	•	rollDeg
	•	quaternion

The rest of the app must consume a normalized camera pose interface.

17.4 FOV model

Because browser APIs do not provide reliable per-device camera FOV everywhere, v1 must use this fixed model:
	•	default vertical FOV = 50°
	•	verticalFovAdjustmentDeg user setting in range [-10, +10]
	•	effective vertical FOV = clamp(50 + adjustment, 40, 60)
	•	horizontal FOV computed from aspect ratio

Formula:

hFov = 2 * atan(tan(vFov / 2) * aspect)

17.5 Projection rules

For each object:
	1.	convert object azimuth/elevation to a world-space unit vector in ENU coordinates
	2.	rotate that vector into camera space using the inverse camera quaternion
	3.	if camera-space z <= 0, the object is behind camera and must be hidden
	4.	compute normalized device coordinates using effective FOV
	5.	map to screen x/y
	6.	clip if outside viewport plus overscan margin

17.6 Overscan margin
	•	Overscan margin = 10% of viewport width/height on each edge
	•	Objects in overscan may still participate in line continuity
	•	Labels may not render outside the actual viewport

⸻

18. Alignment and calibration requirements

18.1 Default behavior
	•	App starts in auto-alignment mode
	•	Orientation data is smoothed before use
	•	Heading and pitch offsets from settings are applied after smoothing

18.2 Alignment health

The client must compute alignmentHealth:
	•	good
	•	fair
	•	poor

Computation rules:
	•	maintain a rolling 2-second buffer of heading samples
	•	compute average angular speed over that window
	•	only evaluate variance when average angular speed is <= 5°/sec
	•	if heading variance <= 5°, health = good
	•	if heading variance <= 12°, health = fair
	•	otherwise, health = poor

18.3 User guidance

If health is poor for more than 3 consecutive seconds:
	•	show compact banner:
	•	Alignment looks off. Move phone in a figure eight or tap Fix alignment.

18.4 Fix alignment panel

Must provide:
	•	heading nudge slider: -20° to +20°
	•	pitch nudge slider: -10° to +10°
	•	field-of-view slider: -10° to +10°

These values persist in localStorage.

18.5 Recenter action
	•	Recenter resets the current smoothed orientation baseline
	•	Recenter must not wipe persisted user offsets

⸻

19. Visibility rules

These rules are deterministic and must be implemented exactly.

19.1 Always-hidden conditions

Hide any object if:
	•	elevation < 0°, except aircraft and satellites which use their own minimum-elevation rules
	•	object projects behind the camera
	•	object projects outside the frustum after clipping rules
	•	its layer is disabled in settings

19.2 Likely visible only mode

Default: enabled

Rules when enabled:
	•	Sun: visible if above horizon
	•	Moon: visible if above horizon
	•	Planets:
	•	visible if above horizon
	•	when Sun altitude > 0°, only Venus and Jupiter remain high-priority
	•	other planets may render only if already center-locked or manually tapped from a nearby label
	•	Stars:
	•	eligible only if Sun altitude <= -6°
	•	Constellations:
	•	eligible only if Sun altitude <= -6°
	•	Satellites:
	•	eligible only if Sun altitude <= -4°
	•	Aircraft:
	•	always eligible if above minimum elevation

19.3 Daylight simplification

When Sun altitude > 0° and Likely visible only is enabled:
	•	hide stars
	•	hide constellations
	•	hide non-ISS satellites
	•	keep aircraft, Sun, Moon, and planets
	•	keep ISS hidden unless the user disables Likely visible only

⸻

20. Ranking and collision rules

20.1 Global label budget

At most 18 labels may be displayed simultaneously across all object types.

20.2 Type priority

When two objects compete for space, higher priority wins:
	1.	center-locked object
	2.	ISS
	3.	aircraft
	4.	Moon
	5.	Sun
	6.	bright planets
	7.	satellites
	8.	bright stars
	9.	constellations

20.3 Per-object score

Within a type, rank by this order:
	1.	angular distance to screen center, closer wins
	2.	importance score, higher wins
	3.	elevation, higher wins
	4.	range, nearer wins for aircraft/satellites
	5.	brightness, lower magnitude wins for stars/planets

20.4 Collision handling

Use greedy placement:
	1.	sort eligible labels by rank descending
	2.	for each label, try anchor positions in this order:
	•	above
	•	below
	•	right
	•	left
	3.	if none fit without overlap or leaving viewport bounds, suppress the label

20.5 Minimum spacing
	•	minimum anchor-to-anchor spacing: 24 px
	•	label overlap tolerance: 0 px

Overlap is not allowed.

⸻

21. Trails and line rendering

21.1 Trails

Only these objects may have trails:
	•	aircraft
	•	ISS
	•	user-selected satellite

Rules:
	•	trails are off by default for non-focused objects
	•	when an object is focused, show a short trail of the last 10 projected positions
	•	trail history length = 10 samples at 1-second intervals

21.2 Constellation lines
	•	draw lines with low-opacity stroke
	•	line width = 1.5 px at DPR 1, scaled by devicePixelRatio
	•	if either endpoint is off-screen but within overscan, line may still be drawn clipped to viewport

⸻

22. Backend API requirements

All backend routes live under /api.

22.1 GET /api/config

Returns static runtime configuration.

Response shape:

{
  "buildVersion": "string",
  "defaults": {
    "maxLabels": 18,
    "radiusKm": 250,
    "verticalFovDeg": 50,
    "likelyVisibleOnly": true,
    "enabledLayers": ["aircraft", "satellites", "planets", "stars", "constellations"]
  },
  "satelliteGroups": [
    { "id": "iss", "label": "ISS" },
    { "id": "stations", "label": "Space Stations" },
    { "id": "brightest", "label": "100 Brightest" }
  ]
}

22.2 GET /api/tle

Returns cached TLE data for included groups.

Response shape:

{
  "fetchedAt": "2026-01-01T00:00:00.000Z",
  "expiresAt": "2026-01-01T06:00:00.000Z",
  "satellites": [
    {
      "id": "25544",
      "name": "ISS (ZARYA)",
      "noradId": 25544,
      "groups": ["iss", "stations"],
      "tle1": "string",
      "tle2": "string",
      "isIss": true
    }
  ]
}

Rules:
	•	id must be stable and based on noradId
	•	overlapping group membership must be preserved in groups
	•	duplicates must be removed before response is returned

22.3 GET /api/aircraft

Query params:
	•	lat required
	•	lon required
	•	altMeters optional, default 0
	•	radiusKm optional, default 250, max 250
	•	limit optional, default 50, max 100

Response shape:

{
  "fetchedAt": "2026-01-01T00:00:00.000Z",
  "observer": {
    "lat": 37.7749,
    "lon": -122.4194,
    "altMeters": 0
  },
  "aircraft": [
    {
      "id": "icao24-ab12cd",
      "callsign": "UAL123",
      "originCountry": "United States",
      "lat": 37.98,
      "lon": -122.1,
      "geoAltitudeM": 10668,
      "baroAltitudeM": 10620,
      "velocityMps": 240,
      "headingDeg": 132,
      "verticalRateMps": 0,
      "azimuthDeg": 54.2,
      "elevationDeg": 18.4,
      "rangeKm": 31.8
    }
  ]
}

22.4 GET /api/health

Must return health of:
	•	app server
	•	OpenSky cache freshness
	•	TLE cache freshness

22.5 Validation requirements
	•	All external payloads must be validated with Zod
	•	Invalid query params must return 400
	•	Backend routes must never leak secrets in error messages

⸻

23. Backend cache behavior and resilience

23.1 Aircraft cache
	•	cache OpenSky-derived results for 10 seconds
	•	if a request arrives within TTL for equivalent location bucket, return cached result
	•	location bucket precision: round latitude/longitude to 0.1° for cache key
	•	if authenticated OpenSky access fails, try anonymous latest-state access when possible
	•	if all aircraft fetching fails, serve an empty aircraft list plus an availability flag

23.2 TLE cache
	•	refresh every 6 hours
	•	on refresh failure, continue serving stale cache for up to 24 hours
	•	if stale cache is being served, include stale: true in route metadata

23.3 No persistent storage
	•	in-memory cache only
	•	if server restarts, caches repopulate lazily

⸻

24. Performance requirements

24.1 Rendering
	•	target 60 FPS on recent flagship devices
	•	remain usable at 30 FPS on midrange devices
	•	no more than one full-canvas redraw per animation frame

24.2 Polling and recomputation
	•	orientation projection: every animation frame
	•	celestial recompute: once per second
	•	satellite propagation: once per second
	•	aircraft refresh: every 10 seconds
	•	location refresh: on significant change or after 15 seconds

24.3 Startup budget

On warm cache and good network:
	•	time from tapping Start SkyLens to first visible overlay < 3 seconds

24.4 Client budget
	•	route-based code splitting is required between landing page and main viewer
	•	demo mode must work without requiring OpenSky or live TLE fetch at runtime

⸻

25. Error handling and degraded modes

25.1 OpenSky unavailable

If aircraft data fails:
	•	keep app running
	•	hide aircraft layer
	•	show subtle status in settings:
	•	Live aircraft temporarily unavailable

25.2 TLE unavailable

If TLE refresh fails and no cached TLE exists:
	•	hide satellite layer
	•	keep celestial, stars, and aircraft working

25.3 Astronomy failure

If astronomy calculations fail:
	•	show hard error banner
	•	enter demo mode
	•	treat as critical failure

25.4 Camera unavailable
	•	switch to non-camera fallback
	•	do not block the app entirely

25.5 Orientation unavailable
	•	switch to manual pan fallback
	•	show one-time instruction sheet

⸻

26. Demo mode requirements

Demo mode exists so the app can still be shown indoors, on desktop, or after permission denial.

26.1 Demo mode behavior
	•	uses dark gradient background instead of camera
	•	uses fixed observer location and time scenarios
	•	supports touch drag to pan and tilt
	•	supports the same labels and detail cards as live mode
	•	must be usable without live OpenSky access

26.2 Required built-in demo scenarios

Ship three fixed scenarios:
	•	San Francisco — Clear evening
	•	New York — Busy daylight sky
	•	Tokyo — Night with ISS pass

Each scenario must define:
	•	latitude
	•	longitude
	•	datetime
	•	bundled satellite sample set if needed
	•	optional seeded aircraft sample payload

26.3 Demo mode determinism
	•	demo scenarios must be bundled in the repo
	•	demo scenarios must not depend on current wall-clock time
	•	demo scenarios must not depend on external network availability

⸻

27. Accessibility requirements
	•	all buttons and toggles must be keyboard accessible in desktop fallback
	•	settings sheet must trap focus in desktop mode
	•	minimum touch target size: 44x44 px
	•	cards and labels must meet readable contrast
	•	if prefers-reduced-motion is enabled:
	•	disable trails
	•	reduce animation flourish

⸻

28. Recommended repo structure

app/
  layout.tsx
  globals.css
  page.tsx
  view/page.tsx
  api/
    config/route.ts
    tle/route.ts
    aircraft/route.ts
    health/route.ts
  manifest.ts
components/
  landing/
  viewer/
  settings/
  cards/
lib/
  astronomy/
  satellites/
  aircraft/
  projection/
  sensors/
  labels/
  cache/
  demo/
  utils/
public/
  data/
    stars_200.json
    constellations.json
    demo/
tests/
  unit/
  integration/
  e2e/
  fixtures/
next.config.ts
package.json


⸻

29. Required modules

29.1 lib/sensors/orientation.ts

Responsibilities:
	•	permission requests
	•	raw event subscription
	•	screen orientation correction
	•	smoothing
	•	alignment health calculation
	•	recenter support
	•	normalized camera pose output

29.2 lib/sensors/location.ts

Responsibilities:
	•	permission request
	•	one-shot startup location
	•	watch position
	•	normalized observer state

29.3 lib/projection/camera.ts

Responsibilities:
	•	FOV computation
	•	quaternion utilities
	•	world vector to camera vector transform
	•	camera-space to screen projection

29.4 lib/astronomy/celestial.ts

Responsibilities:
	•	compute Sun/Moon/planet positions
	•	convert to normalized SkyObject
	•	determine constellation names when applicable

29.5 lib/astronomy/stars.ts

Responsibilities:
	•	load bundled stars
	•	transform RA/Dec to horizontal coordinates
	•	normalize visible stars

29.6 lib/astronomy/constellations.ts

Responsibilities:
	•	load constellation definitions
	•	generate projected line segments and eligible labels

29.7 lib/satellites/client.ts

Responsibilities:
	•	fetch /api/tle
	•	propagate TLEs with satellite.js
	•	compute observer-relative positions
	•	deduplicate and normalize visible satellites

29.8 lib/aircraft/client.ts

Responsibilities:
	•	fetch /api/aircraft
	•	normalize aircraft objects

29.9 lib/labels/ranking.ts

Responsibilities:
	•	apply visibility rules
	•	compute rank score
	•	collision resolution
	•	return final label placements

29.10 lib/demo/scenarios.ts

Responsibilities:
	•	define built-in demo scenarios
	•	provide seeded observer and sample aircraft data

⸻

30. Required package scripts

package.json must expose at least these scripts:

{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}

All scripts must run successfully by the end of implementation.

⸻

31. Test requirements

This section is mandatory. The agent must implement the tests while implementing the product.

31.1 Unit tests

Required categories:
	•	FOV calculations
	•	quaternion/angle normalization
	•	world-to-screen projection
	•	visibility rules
	•	label ranking and suppression
	•	alignment health scoring
	•	aircraft normalization
	•	satellite normalization
	•	celestial normalization

31.2 Fixture-based snapshot tests

Create deterministic fixtures for:
	•	observer location/time
	•	camera pose
	•	effective FOV
	•	object inputs

Required assertions:
	•	projected screen positions within tolerance
	•	hidden vs visible decisions
	•	label suppression order

Tolerance:
	•	screen projection tolerance: ±20 px
	•	angular calculation tolerance: ±0.5°

31.3 Integration tests

Required integration tests:
	•	/api/tle returns normalized payload with cache semantics
	•	/api/aircraft rejects invalid input and normalizes valid payloads
	•	stale TLE fallback works
	•	OpenSky outage degrades gracefully

31.4 Playwright E2E tests

Required flows:
	•	landing page loads and shows Start button
	•	permission-denied path enters fallback mode
	•	settings persist toggles
	•	demo mode renders labels
	•	detail card opens on label tap

31.5 Required fixtures

The repo must include at least:
	•	tests/fixtures/observer/sf_evening.json
	•	tests/fixtures/observer/ny_day.json
	•	tests/fixtures/sensors/steady_heading.json
	•	tests/fixtures/sensors/noisy_heading.json
	•	tests/fixtures/opensky/sample_dense.json
	•	tests/fixtures/tle/stations.txt
	•	tests/fixtures/tle/brightest.txt
	•	tests/fixtures/demo/tokyo_iss.json

⸻

32. Milestone plan

Implementation must proceed in this order.

Milestone 1 — App shell and permissions

Deliver:
	•	landing page
	•	manifest
	•	icons
	•	permission flow
	•	route skeleton
	•	fallback screen skeleton

Acceptance:
	•	user can tap Start and see permission prompts
	•	app enters /view
	•	denied permissions route to fallback behavior

Milestone 2 — Sensor and camera foundation

Deliver:
	•	camera stream
	•	orientation pipeline
	•	location pipeline
	•	center reticle
	•	projection foundation with dummy objects

Acceptance:
	•	dummy objects remain stable relative to device movement
	•	alignment health changes correctly in tests

Milestone 3 — Celestial layer

Deliver:
	•	Sun, Moon, planets
	•	star layer
	•	constellation lines
	•	bottom dock center-lock behavior

Acceptance:
	•	known fixtures produce expected visible objects and approximate positions

Milestone 4 — Satellite layer

Deliver:
	•	/api/tle
	•	TLE cache
	•	client propagation
	•	ISS highlighting
	•	group deduplication

Acceptance:
	•	fixtures project ISS and sample satellites correctly
	•	stale-cache fallback works

Milestone 5 — Aircraft layer

Deliver:
	•	/api/aircraft
	•	OpenSky proxy/cache
	•	aircraft labels and detail cards

Acceptance:
	•	sample payloads normalize correctly
	•	live layer degrades gracefully when unavailable

Milestone 6 — Ranking, collisions, settings

Deliver:
	•	collision-aware label layout
	•	settings persistence
	•	likely-visible-only mode
	•	fix-alignment controls

Acceptance:
	•	dense-scene fixtures remain readable
	•	settings survive reload

Milestone 7 — Polish and test completion

Deliver:
	•	trails
	•	demo mode scenarios
	•	final UI polish
	•	full unit/integration/E2E coverage

Acceptance:
	•	all required tests pass
	•	app is demoable on phone and desktop fallback

⸻

33. Definition of done

V1 is done only when all of the following are true:
	•	landing, live view, settings, and fallback/demo mode exist
	•	permissions and degraded modes behave as specified
	•	Sun, Moon, planets, satellites, aircraft, stars, and constellations render according to scope rules
	•	labels are ranked and collision-managed
	•	center reticle focus works
	•	detail cards work for all supported object types
	•	backend routes exist and validate input/output
	•	all required fixtures and tests are present
	•	npm run build passes
	•	npm run test passes
	•	npm run test:e2e passes

⸻

If you want the next artifact, I would turn this directly into a matching phase_plan.yaml so Autoloop can execute it without needing to reinterpret the PRD.
