# Implement ↔ Code Reviewer Feedback

- Task ID: implement-skylensprd-md-73e90f91
- Pair: implement
- Phase ID: ranking-settings-and-collisions
- Phase Directory Key: ranking-settings-and-collisions
- Phase Title: Ranking, settings, and collisions
- Scope: phase-local authoritative verifier artifact

- IMP-001 [blocking] `lib/astronomy/celestial.ts:213` and `components/viewer/viewer-shell.tsx:191`: the daylit `likelyVisibleOnly` implementation still filters non-Venus/Jupiter planets before center-lock runs, because the celestial pipeline only receives `selectedObjectId` as `focusedObjectId`. Under PRD 19.2/19.3, those planets may render when they are already center-locked, but with the current flow a daylit Mercury/Mars/Saturn/Uranus/Neptune can never become center-locked in the first place, so AC-2 is not met. Minimal fix: move this daylit eligibility check to a post-center-lock/ranking stage, or thread the current/previous center-lock target into the celestial visibility decision so non-priority planets remain eligible when center-locked without reappearing as normal daylight labels.
- IMP-002 [non-blocking] Cycle 2 verification: IMP-001 is resolved. The updated celestial/viewer flow keeps daylit non-priority planets in the scene with label suppression until they are centered or explicitly selected, which restores the PRD center-lock daylight behavior without reopening ordinary daylight labels.
