"use client";

import { STEPS } from "./onboarding-data";

interface StepDotsProps {
  currentStep: number;
}

export function StepDots({ currentStep }: StepDotsProps) {
  // Exclude the welcome step from dots
  const dotSteps = STEPS.filter((s) => s !== "welcome");

  return (
    <div className="onboarding-steps flex items-center justify-center gap-1.5 mb-6">
      {dotSteps.map((_, i) => (
        <div
          key={i}
          className={`onboarding-step-dot h-1.5 rounded-full transition-all duration-300 ${
            i === currentStep - 1
              ? "w-6 bg-[#FF385C]"
              : i < currentStep - 1
                ? "w-1.5 bg-[#FF385C]/60"
                : "w-1.5 bg-ctx-line"
          }`}
        />
      ))}
    </div>
  );
}
