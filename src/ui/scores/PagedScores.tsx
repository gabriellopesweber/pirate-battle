import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { describeApiError } from '@/api/apiError'
import type { Page } from '@/api/contracts'
import './scores.css'

interface PagedScoresProps<T> {
  query: UseQueryResult<Page<T>>
  /** What is being loaded, for the status messages: "ranking", "match history". */
  noun: string
  empty: string
  onPageChange: (page: number) => void
  children: (items: T[]) => ReactNode
}

/**
 * The states every paged score list goes through — loading, error with
 * retry, empty, a page with a pager — whatever the list shows. The previous
 * page stays on screen while the next loads, and while a background refetch
 * runs.
 */
export function PagedScores<T>({ query, noun, empty, onPageChange, children }: PagedScoresProps<T>) {
  const { data, error, isPending, isFetching, isPlaceholderData } = query
  // A live region announces changes only if it already exists, so it is
  // always rendered and only its text changes.
  const status = isPending ? `Loading ${noun}…` : isFetching ? `Updating ${noun}…` : ''

  return (
    <div className="scores">
      <p role="status" className="scores__status">
        {status}
      </p>

      {error && (
        <div className="scores__error">
          <p role="alert">{describeApiError(error)}</p>
          <button
            type="button"
            className="scores__button"
            onClick={() => {
              void query.refetch()
            }}
          >
            Try again
          </button>
        </div>
      )}

      {data && data.totalItems === 0 && <p className="scores__empty">{empty}</p>}

      {data && data.totalItems > 0 && (
        <>
          <div className="scores__table" aria-busy={isPlaceholderData}>
            {children(data.items)}
          </div>
          <nav aria-label={`${noun} pages`} className="scores__pager">
            <button
              type="button"
              className="scores__button"
              aria-label="Previous page"
              disabled={isPlaceholderData || data.page <= 1}
              onClick={() => {
                onPageChange(data.page - 1)
              }}
            >
              ‹
            </button>
            <span>
              Page {data.page} of {data.totalPages}
            </span>
            <button
              type="button"
              className="scores__button"
              aria-label="Next page"
              disabled={isPlaceholderData || data.page >= data.totalPages}
              onClick={() => {
                onPageChange(data.page + 1)
              }}
            >
              ›
            </button>
          </nav>
        </>
      )}
    </div>
  )
}
