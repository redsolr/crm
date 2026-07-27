"use client";

import { useEffect, useState } from "react";

const CONFETTI_COLORS = [
  "#FF385C",
  "#E61E4D",
  "#D70466",
  "#7C3AED",
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EC4899",
];

const CONFETTI_PIECES = Array.from({ length: 20 }).map((_, i) => ({
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  left: `${10 + Math.random() * 80}%`,
  delay: `${Math.random() * 0.4}s`,
  duration: `${1 + Math.random() * 0.8}s`,
  xDrift: `${(Math.random() - 0.5) * 100}px`,
  size: 5 + Math.random() * 5,
  isCircle: i % 3 === 0,
}));

export function WelcomeStep() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div className="onboarding-welcome flex flex-col items-center text-center py-8 relative">
      {/* Confetti */}
      <div className="confetti-explosion absolute inset-0 overflow-hidden pointer-events-none z-50">
        {CONFETTI_PIECES.map((p, i) => (
          <div
            key={i}
            className="confetti-piece absolute top-0"
            style={
              {
                left: p.left,
                width: p.isCircle ? p.size : p.size * 0.4,
                height: p.isCircle ? p.size : p.size,
                backgroundColor: p.color,
                borderRadius: p.isCircle ? "50%" : "2px",
                animation: `confetti-fall ${p.duration} ${p.delay} cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
                "--x-drift": p.xDrift,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* Checkmark circle */}                                    
      <div
        className={`onboarding-welcome-icon w-18 h-18 rounded-full bg-gradient-to-br from-[#FF385C] to-[#D70466] flex items-center justify-center mb-8 ${
          visible ? "onboarding-icon-in" : "scale-0"
        }`}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
          <path
            d="M20 6L9 17L4 12"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={visible ? "onboarding-checkmark-draw" : ""}
            style={{
              strokeDasharray: 24,
              strokeDashoffset: visible ? undefined : 24,
            }}
          />
        </svg>
      </div>

      {/* Body text */}
      <p
        className={`ctx-body onboarding-fade-up ${visible ? "is-visible" : ""}`}
      >
        Let&apos;s set up your workspace in just a few quick steps.
      </p>
    </div>
  );
}
