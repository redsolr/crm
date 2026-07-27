"use client";

import { useRef, useEffect, memo } from "react";
import "./splash-screen.css";

const DURATION_MS = 3600;

export const SplashScreen = memo(function SplashScreen({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const callbackRef = useRef(onComplete);

  useEffect(() => {
    callbackRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const id = window.setTimeout(() => callbackRef.current(), DURATION_MS);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="splash-screen">
      <div className="splash-content">
        <h1 className="splash-title">Jurisimus</h1>
        <div className="splash-progress-track">
          <div className="splash-progress-bar" />
        </div>
        <p className="splash-loading">Loading...</p>
      </div>
    </div>
  );
});
