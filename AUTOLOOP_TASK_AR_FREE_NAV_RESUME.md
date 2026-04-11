# Resume Task: AR / Free-Navigation Mode (Implement + Test)

Resume task id: `ar-free-navigation-mode`.

## Objective
Complete the interrupted autoloop work for the explicit AR/free-navigation implementation by running only:
- implement pair
- test pair

## Required run mode
- full-auto answers enabled
- pairs: implement,test
- resume existing task state

## Must satisfy before completion
1. Address outstanding verifier feedback from prior implement cycles.
2. Ensure the AR/free-navigation behavior is consistent with the accepted plan:
   - free-navigation default when AR disabled
   - always-visible Enable/Disable AR controls on mobile and desktop
   - permission prompts only on explicit user action
   - sticky Disable AR (no passive auto-reentry)
3. Ensure tests are updated and green for the targeted slices used by this task.
4. Keep changes scoped to task-relevant files; avoid unrelated churn.

## Validation target
Run and pass relevant implement/test validations for this task (unit/e2e as required by the task artifacts).

