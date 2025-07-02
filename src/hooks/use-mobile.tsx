import * as React from "react"

const MOBILE_BREAKPOINT = 768

// This hook is designed to be SSR-safe.
// It defaults to `false` on the server and on the initial client render.
// The `useEffect` then runs on the client to set the actual value.
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)

    // Function to update state based on media query
    const handleResize = () => {
      setIsMobile(mql.matches)
    }

    // Set the initial value on the client
    handleResize()

    // Add event listener for changes
    mql.addEventListener("change", handleResize)

    // Clean up the event listener on component unmount
    return () => {
      mql.removeEventListener("change", handleResize)
    }
  }, [])

  return isMobile
}
