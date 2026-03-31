import { useEffect, useRef, useState } from 'react'

/**
 * Calls `fn` immediately and then every `intervalMs`.
 * Returns seconds until next refresh.
 */
export function useAutoRefresh(fn, intervalMs = 30000) {
  const [secondsLeft, setSecondsLeft] = useState(intervalMs / 1000)
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    fnRef.current()
    const tick = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { fnRef.current(); return intervalMs / 1000 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [intervalMs])

  return secondsLeft
}
