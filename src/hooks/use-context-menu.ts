"use client";

import { useState, useCallback } from "react";

export interface ContextMenuState {
  visible: boolean;
  position: { x: number; y: number };
}

export interface UseContextMenuResult {
  state: ContextMenuState;
  show: (e: React.MouseEvent) => void;
  hide: () => void;
}

/**
 * Hook for managing context menu state.
 * Handles showing/hiding and position tracking.
 */
export function useContextMenu(): UseContextMenuResult {
  const [state, setState] = useState<ContextMenuState>({
    visible: false,
    position: { x: 0, y: 0 },
  });

  const show = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setState({
      visible: true,
      position: { x: e.clientX, y: e.clientY },
    });
  }, []);

  const hide = useCallback(() => {
    setState({
      visible: false,
      position: { x: 0, y: 0 },
    });
  }, []);

  return { state, show, hide };
}

export default useContextMenu;
