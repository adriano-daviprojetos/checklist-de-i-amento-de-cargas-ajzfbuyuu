import { useState, useEffect } from 'react'

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine)
  const [simulatedOffline, setSimulatedOffline] = useState<boolean>(false)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const toggleSimulateOffline = () => {
    setSimulatedOffline((prev) => !prev)
  }

  const effectiveOnline = isOnline && !simulatedOffline

  return {
    isOnline: effectiveOnline,
    rawOnline: isOnline,
    simulatedOffline,
    toggleSimulateOffline,
  }
}
