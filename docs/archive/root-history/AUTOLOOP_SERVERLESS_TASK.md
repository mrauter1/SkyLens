# SkyLens Serverless Migration and Equivalence Task

## Objective
Create a new folder named `SkyLensServerless` at the repository root and build a **full, complete, and working** version of SkyLens inside it that is fully serverless.

## Hard Constraints
1. **Do not edit files in the root SkyLens app implementation** (existing root project files must remain unchanged except for adding this task file and autoloop artifacts).
2. All implementation for the new serverless app must be placed under `SkyLensServerless/`.
3. If any existing SkyLens repository files can be reused as-is, copy them into `SkyLensServerless/`.
4. Preserve equivalent UI and behavior.

## Functional Requirements
1. Identify every current server-side feature in SkyLens.
2. Re-implement each server-side feature client-side within `SkyLensServerless`.
3. Ensure no loss of capability versus the original app.
4. Ensure UI/UX and user-visible behavior remain equivalent.

## Verification Requirements
1. Analyze and document feature parity between original SkyLens and SkyLensServerless.
2. Verify correctness of each migrated feature.
3. Add and run tests for equivalence and correctness.
4. Ensure the new app builds and runs.

## Execution Mode
Use autoloop with iterative **plan → implement → test** pairs until complete.
