"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface ViewportState {
  originalHeight: number;
  currentHeight: number;
  visualViewportHeight: number;
  isViewportAtMaxHeight: boolean;
}

interface ViewportActions {
  init: () => void;
}

export const useViewportStore = create<ViewportState & ViewportActions>()(
  devtools(
    (set) => ({
      originalHeight: 0,
      currentHeight: 0,
      visualViewportHeight: 0,
      isViewportAtMaxHeight: false,

      init: () => {
        if (typeof window === "undefined") return;

        const initHeight = window.innerHeight;
        const vvHeight = window.visualViewport?.height || initHeight;
        set(
          {
            originalHeight: initHeight,
            currentHeight: initHeight,
            visualViewportHeight: vvHeight,
            isViewportAtMaxHeight: vvHeight > initHeight,
          },
          false,
          "init",
        );

        const handleResize = () => {
          const h = window.innerHeight;
          const vv = window.visualViewport?.height || h;
          set(
            (s) => ({
              currentHeight: h,
              visualViewportHeight: vv,
              isViewportAtMaxHeight: vv > s.originalHeight,
            }),
            false,
            "resize",
          );
        };

        const handleVisualViewportChange = () => {
          const vv = window.visualViewport?.height || window.innerHeight;
          set(
            (s) => ({
              visualViewportHeight: vv,
              isViewportAtMaxHeight: vv > s.originalHeight,
            }),
            false,
            "visualViewportChange",
          );
        };

        window.addEventListener("resize", handleResize, { passive: true });
        window.visualViewport?.addEventListener(
          "resize",
          handleVisualViewportChange,
          {
            passive: true,
          },
        );
      },
    }),
    { name: "ViewportStore" },
  ),
);
