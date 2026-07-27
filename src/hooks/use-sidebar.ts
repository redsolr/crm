import { useState, useMemo, useCallback } from "react";
import { useMediaQuery } from "./use-media-query";

export default function useSidebar(
  initialState: boolean = false,
  breakpoint: number = 768,
) {
  const isDesktop = useMediaQuery(`(min-width: ${breakpoint}px)`);
  const [isSidebarOpen, setIsSidebarOpen] = useState(initialState);

  // Match the responsive default on mount + when the viewport crosses
  // the breakpoint. Using the "adjusting state during render" idiom
  // (https://react.dev/reference/react/useState#storing-information-from-previous-renders)
  // keeps a manual toggle sticky inside the same range — only a
  // breakpoint crossing forces the override.
  const [lastIsDesktop, setLastIsDesktop] = useState(isDesktop);
  if (isDesktop !== lastIsDesktop) {
    setIsSidebarOpen(isDesktop);
    setLastIsDesktop(isDesktop);
  }

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  // Calculate background color based on sidebar state
  const backgroundColor = useMemo(() => {
    return isSidebarOpen && !isDesktop
      ? "var(--background)"
      : "var(--claude-dark)";
  }, [isSidebarOpen, isDesktop]);

  // Add style properties for transitions
  const sidebarStyles = useMemo(
    () => ({
      backgroundColor,
      transition: "background-color 0.3s, transform 0.3s ease-in-out",
    }),
    [backgroundColor],
  );

  // Add class names for sidebar transitions - improved for mobile
  const sidebarClassName = useMemo(() => {
    // On mobile: slide in from left
    // On desktop: always visible
    const baseClasses =
      "transform transition-transform duration-300 ease-in-out";
    return isSidebarOpen
      ? `${baseClasses} translate-x-0`
      : `${baseClasses} -translate-x-full md:translate-x-0`;
  }, [isSidebarOpen]);

  return {
    isSidebarOpen,
    setIsSidebarOpen,
    toggleSidebar,
    backgroundColor,
    sidebarStyles,
    sidebarClassName,
  };
}
