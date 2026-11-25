"use client";

import * as React from "react";

const lastMobileViewportWidth = 767;

export const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = globalThis.matchMedia(`(max-width: ${lastMobileViewportWidth}px)`);
    const onChange = (): void => {
      setIsMobile(globalThis.innerWidth <= lastMobileViewportWidth);
    };
    mediaQuery.addEventListener("change", onChange);
    onChange();
    return () => {
      mediaQuery.removeEventListener("change", onChange);
    };
  }, []);

  return isMobile;
};
