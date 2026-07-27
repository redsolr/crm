"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useCarouselHeight } from "@/hooks/use-carousel-height";
import { useRouter } from "next/navigation";
import { useAuth } from "@/stores/use-auth";
import { useOnboarding } from "@/hooks/use-onboarding";
import { SubmitButton } from "@/components/auth/SubmitButton";
import {
  ROLES,
  INTERESTS,
  RESPONSE_LENGTHS,
  TONES,
  STEP_META,
  SKIPPABLE_STEPS,
} from "@/components/onboarding/onboarding-data";
import { WelcomeStep } from "@/components/onboarding/WelcomeStep";
import { ProfileStep } from "@/components/onboarding/ProfileStep";
import { InviteStep } from "@/components/onboarding/InviteStep";
import { SelectionGroup } from "@/components/onboarding/SelectionGroup";
import { LabeledInput } from "@/components/onboarding/LabeledInput";
import { StepDots } from "@/components/onboarding/StepDots";
import { CreatingWorkspaceOverlay } from "@/components/onboarding/CreatingWorkspaceOverlay";
import { WorkspaceCreatedOverlay } from "@/components/onboarding/WorkspaceCreatedOverlay";
import { WelcomeTabsOverlay } from "@/components/onboarding/WelcomeTabsOverlay";
import { IconArrowLeft } from "@/components/icons";
import { LoadingDots } from "@/components/shared/LoadingDots";
import "@/components/onboarding/onboarding.css";

function LoadingSpinner() {
  return (
    <div className="onboarding-loading flex items-center justify-center min-h-[200px]">
      <LoadingDots label="Loading onboarding" />
    </div>
  );
}

export default function OnboardingPage() {
  return <OnboardingContent />;
}

function OnboardingContent() {
  const router = useRouter();
  const { loading, isAuthenticated } = useAuth();
  const ob = useOnboarding();
  const {
    phase,
    step,
    currentStep,
    isLastStep,
    submitting,
    error,
    canContinue,
    handleNext,
    goBack,
    skipForNow,
    continueFromCreated,
    enterApp,
  } = ob;
  const { title, subtitle } = STEP_META[step];
  const isSkippable = SKIPPABLE_STEPS.includes(step);
  const [showSkipInvite, setShowSkipInvite] = useState(false);
  const {
    trackRef,
    height: carouselHeight,
    ready: carouselReady,
  } = useCarouselHeight(currentStep);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push("/login");
  }, [loading, isAuthenticated, router]);

  if (loading) return <LoadingSpinner />;
  if (!isAuthenticated) return null;

  // ── Full-screen phases (escape the auth card) ──
  if (phase === "creating") {
    return <CreatingWorkspaceOverlay workspaceName={ob.workspaceName} />;
  }
  if (phase === "created") {
    return (
      <WorkspaceCreatedOverlay
        workspaceName={ob.workspaceName}
        fullName={ob.fullName}
        onContinue={continueFromCreated}
      />
    );
  }
  if (phase === "welcome-tabs") {
    return <WelcomeTabsOverlay onDone={enterApp} />;
  }

  const slides: ReactNode[] = [
    <WelcomeStep key="welcome" />,

    <div key="workspace" className="onboarding-setup space-y-5">
      <LabeledInput
        label="Workspace name"
        value={ob.workspaceName}
        onChange={ob.setWorkspaceName}
        placeholder="e.g. Hiranphan & Partners"
        maxLength={255}
        autoFocus
        showValid
      />
    </div>,

    <ProfileStep
      key="profile"
      fullName={ob.fullName}
      onChange={ob.setFullName}
    />,

    <InviteStep key="invite" organizationId={ob.createdOrgId} />,

    <SelectionGroup
      key="roles"
      items={ROLES}
      selected={ob.roles}
      onSelect={ob.toggleRole}
    />,

    <SelectionGroup
      key="interests"
      items={INTERESTS}
      selected={ob.interests}
      onSelect={ob.toggleInterest}
    />,

    <div key="preferences" className="onboarding-preferences space-y-5">
      <SelectionGroup
        label="Response length"
        items={RESPONSE_LENGTHS}
        selected={[ob.responseLength]}
        onSelect={ob.setResponseLength}
        layout="grid"
      />
      <SelectionGroup
        label="Tone"
        items={TONES}
        selected={[ob.tone]}
        onSelect={ob.setTone}
        layout="grid"
      />
    </div>,
  ];

  const showNav = step !== "welcome";

  const onSkipClick = () => {
    if (step === "invite") {
      setShowSkipInvite(true);
      return;
    }
    void skipForNow();
  };

  const primaryLabel =
    step === "welcome"
      ? "Let’s go"
      : step === "workspace"
        ? "Create workspace"
        : isLastStep
          ? "Finish"
          : "Continue";

  return (
    <>
      <div className="onboarding-header text-center">
        <h1 className="onboarding-title ctx-title text-center">{title}</h1>
        {subtitle && (
          <p className="onboarding-subtitle ctx-subtitle mt-1">{subtitle}</p>
        )}
      </div>

      {showNav && <StepDots currentStep={currentStep} />}

      {error && (
        <div className="onboarding-error mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Mobile: render active slide only */}
      <div className="md:hidden">{slides[currentStep]}</div>

      {/* Desktop: animated height container */}
      <div
        className="onboarding-carousel hidden md:block"
        style={{
          height: carouselHeight != null ? `${carouselHeight}px` : "auto",
          transition: carouselReady ? undefined : "none",
        }}
      >
        <div ref={trackRef}>{slides[currentStep]}</div>
      </div>

      {/* Actions */}
      <div
        className={`onboarding-actions ${
          showNav
            ? "flex items-center justify-between gap-3"
            : "flex justify-center"
        }`}
      >
        {showNav && (
          <div className="onboarding-actions-left flex-1">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={goBack}
                className="onboarding-back-btn flex items-center gap-1.5 text-ctx-primary hover:text-ctx-accent"
              >
                <IconArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
          </div>
        )}

        {showNav && (
          <div className="onboarding-actions-center">
            {isSkippable && (
              <button
                type="button"
                onClick={onSkipClick}
                className="onboarding-skip-btn px-5 py-3.5 text-ctx-primary border border-ctx-line hover:bg-ctx-subtle"
              >
                Skip for now
              </button>
            )}
          </div>
        )}

        <div
          className={
            showNav
              ? "onboarding-actions-right flex-1 flex justify-end"
              : "w-full"
          }
        >
          <SubmitButton
            type="button"
            onClick={handleNext}
            isPending={submitting}
            label={primaryLabel}
            pendingLabel={isLastStep ? "Finishing..." : "Saving..."}
            className={!canContinue() ? "opacity-50 pointer-events-none" : ""}
            data-testid="onboarding-continue"
          />
        </div>
      </div>

      {/* Skip-invite confirmation (Slack's "Skip without inviting?") */}
      {showSkipInvite && (
        <div className="onboarding-skip-modal fixed inset-0 z-[110] flex items-center justify-center bg-black/50 px-4">
          <div className="onboarding-skip-modal-card w-full max-w-[420px] rounded-2xl bg-[var(--theme-bg-secondary)] p-6 text-[var(--theme-text-primary)] border border-[var(--theme-border-primary)] shadow-2xl">
            <h2 className="text-lg font-bold">Skip without inviting?</h2>
            <p className="mt-2 text-sm text-[var(--theme-text-secondary)]">
              Jurisimus works great solo — but with your firm here, you can
              share matters, hand off work, and decide together. You can always
              invite people later.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSkipInvite(false)}
                className="rounded-lg border border-[var(--theme-border-secondary)] px-4 py-2 text-sm font-semibold text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-hover)]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSkipInvite(false);
                  void skipForNow();
                }}
                className="rounded-lg bg-[#FF385C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#E61E4D]"
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
