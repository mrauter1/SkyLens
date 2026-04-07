'use client'

import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function isElementVisible(element: HTMLElement) {
  if (
    element.hasAttribute('hidden') ||
    element.closest('[hidden]') ||
    element.hasAttribute('inert') ||
    element.closest('[inert]') ||
    element.getAttribute('aria-hidden') === 'true' ||
    element.closest('[aria-hidden="true"]')
  ) {
    return false
  }

  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    const style = window.getComputedStyle(element)

    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
      return false
    }
  }

  return true
}

function isFocusableElement(element: HTMLElement) {
  if (!element.isConnected || element.hasAttribute('disabled') || !isElementVisible(element)) {
    return false
  }

  return element.matches(FOCUSABLE_SELECTOR) || element.tabIndex >= 0
}

export function canRestoreFocusTarget(target: HTMLElement | null | undefined): target is HTMLElement {
  return Boolean(target && target.isConnected && isElementVisible(target) && isFocusableElement(target))
}

export function resolveFocusRestoreTarget(...targets: Array<HTMLElement | null | undefined>) {
  return targets.find((target) => canRestoreFocusTarget(target)) ?? null
}

export function getFocusableElements(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) =>
    isFocusableElement(element),
  )
}

export function trapFocusWithinPanel(
  event: ReactKeyboardEvent<HTMLElement>,
  panel: HTMLElement | null,
) {
  if (event.key !== 'Tab' || !panel) {
    return
  }

  const focusableElements = getFocusableElements(panel)

  if (focusableElements.length === 0) {
    return
  }

  const firstFocusable = focusableElements[0]
  const lastFocusable = focusableElements[focusableElements.length - 1]
  const activeElement = document.activeElement

  if (event.shiftKey && activeElement === firstFocusable) {
    event.preventDefault()
    lastFocusable.focus()
    return
  }

  if (!event.shiftKey && activeElement === lastFocusable) {
    event.preventDefault()
    firstFocusable.focus()
  }
}

export function focusAfterDismiss(target: HTMLElement | null) {
  if (!target) {
    return
  }

  target.focus()

  if (document.activeElement === target || typeof window === 'undefined') {
    return
  }

  window.setTimeout(() => {
    if (canRestoreFocusTarget(target)) {
      target.focus()
    }
  }, 0)
}
