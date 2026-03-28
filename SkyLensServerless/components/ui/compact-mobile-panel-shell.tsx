'use client'

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'

export const COMPACT_MOBILE_PANEL_MAX_HEIGHT =
  'calc(100dvh - (2rem + env(safe-area-inset-top) + env(safe-area-inset-bottom)))'

type CompactMobilePanelShellProps = {
  children: ReactNode
  header?: ReactNode
  shellTestId?: string
  shellClassName?: string
  shellChildren?: ReactNode
  frameClassName?: string
  panelTestId?: string
  panelClassName?: string
  panelProps?: Omit<HTMLAttributes<HTMLElement>, 'children' | 'className' | 'style'>
  scrollRegionTestId?: string
  scrollRegionClassName?: string
}

export const CompactMobilePanelShell = forwardRef<HTMLElement, CompactMobilePanelShellProps>(
  function CompactMobilePanelShell(
    {
      children,
      header,
      shellTestId,
      shellClassName = '',
      shellChildren,
      frameClassName = '',
      panelTestId,
      panelClassName = '',
      panelProps,
      scrollRegionTestId,
      scrollRegionClassName = '',
    },
    ref,
  ) {
    return (
      <div
        className={`fixed inset-0 overflow-hidden px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] ${shellClassName}`}
        data-testid={shellTestId}
      >
        {shellChildren}
        <div className={`relative flex h-full items-end justify-center ${frameClassName}`}>
          <section
            ref={ref}
            className={`shell-panel relative flex max-h-full min-h-0 w-full max-w-xl flex-col overflow-hidden rounded-[1.5rem] p-4 ${panelClassName}`}
            style={{ maxHeight: COMPACT_MOBILE_PANEL_MAX_HEIGHT }}
            data-testid={panelTestId}
            {...panelProps}
          >
            {header}
            <div
              className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${scrollRegionClassName}`}
              data-testid={scrollRegionTestId}
            >
              {children}
            </div>
          </section>
        </div>
      </div>
    )
  },
)
