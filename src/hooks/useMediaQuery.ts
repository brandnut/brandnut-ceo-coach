'use client'

import { useState, useEffect } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const updateMatches = () => {
      if (typeof window !== 'undefined') {
        setMatches(window.matchMedia(query).matches)
      }
    }

    updateMatches()

    if (typeof window !== 'undefined') {
      const media = window.matchMedia(query)
      media.addEventListener('change', updateMatches)
      return () => media.removeEventListener('change', updateMatches)
    }
  }, [query])

  return matches
}