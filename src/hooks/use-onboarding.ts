"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/stores/use-auth";
import { organizationsApi } from "@/lib/organizationsApi";
import { accountApiClient } from "@/lib/accountApi";
import { preferencesApiClient } from "@/lib/preferencesApi";
import type { ResponseLength, Tone } from "@/lib/preferencesApi";
import { ApiError } from "@/lib/api-client";
import { STEPS } from "@/components/onboarding/onboarding-data";

/** Full-screen phases that take over from the in-card form carousel. */
export type OnboardingPhase = "form" | "creating" | "created" | "welcome-tabs";

/**
 * Map the FE wizard's local state to the platform's onboarding wire
 * shape (`submitOnboardingSchema`). The FE allows multi-select on the role
 * step but the platform DTO is `role: string` singular, so we join; the FE
 * stores `responseLength` camelCase while the DTO is `response_length`.
 */
function buildOnboardingPayload(input: {
  roles: string[];
  interests: string[];
  responseLength: string;
  tone: string;
}): {
  role: string;
  interests: string[];
  response_length: ResponseLength;
  tone: Tone;
} {
  return {
    role: input.roles.join(", "),
    interests: input.interests,
    response_length: input.responseLength as ResponseLength,
    tone: input.tone as Tone,
  };
}

function describeOnboardingError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "PERMISSION_DENIED") {
      return "Your account isn't fully set up to create a workspace. Please contact support — this usually means a missing role assignment.";
    }
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Something went wrong";
}

/** Keep the creating-workspace animation on screen long enough to feel real. */
const MIN_CREATING_MS = 1700;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useOnboarding() {
  const router = useRouter();
  const { user, setNeedsOnboarding } = useAuth();

  const [phase, setPhase] = useState<OnboardingPhase>("form");
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [workspaceName, setWorkspaceName] = useState("");
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [createdOrgId, setCreatedOrgId] = useState<string | null>(
    user?.organization_id ?? null,
  );
  const [roles, setRoles] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [responseLength, setResponseLength] = useState<string>("balanced");
  const [tone, setTone] = useState<string>("professional");

  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;

  const canContinue = (): boolean => {
    switch (step) {
      case "welcome":
        return true;
      case "workspace":
        return !!workspaceName.trim();
      case "profile":
        return !!fullName.trim();
      case "invite":
        return true;
      case "role":
        return roles.length > 0;
      case "interests":
        return interests.length > 0;
      case "preferences":
        return true;
      default:
        return true;
    }
  };

  const goNext = () => setCurrentStep((prev) => prev + 1);
  // Can't go back past `workspace` (welcome is one-time; the org is created
  // on leaving `workspace`, so it's the floor).
  const goBack = () =>
    setCurrentStep((prev) => Math.max(prev - 1, STEPS.indexOf("workspace")));

  /** Submit preferences (best-effort) and reveal the celebration overlay. */
  const finalize = async () => {
    setSubmitting(true);
    try {
      await preferencesApiClient.submitOnboarding(
        buildOnboardingPayload({ roles, interests, responseLength, tone }),
      );
    } catch (err) {
      // The user finished the wizard — land them in the celebration even if
      // the preferences write blipped (logged per "never swallow errors").
      console.error("[useOnboarding] finalize submit failed:", err);
    } finally {
      setSubmitting(false);
      setPhase("created");
    }
  };

  const advanceOrFinish = async () => {
    if (isLastStep) {
      await finalize();
    } else {
      goNext();
    }
  };

  const handleNext = async () => {
    setError(null);

    if (step === "workspace") {
      // Create the organization (auto-provisions its `Default` workspace
      // server-side) behind the dramatic creating-workspace animation.
      setPhase("creating");
      try {
        const [{ organization }] = await Promise.all([
          organizationsApi.createOrganization({ name: workspaceName.trim() }),
          delay(MIN_CREATING_MS),
        ]);
        setCreatedOrgId(organization.id);
        setNeedsOnboarding(false);
        setPhase("form");
        goNext();
      } catch (err) {
        console.error("[useOnboarding] createOrganization failed:", err);
        setPhase("form");
        setError(describeOnboardingError(err));
      }
      return;
    }

    if (step === "profile") {
      // Persist the display name. Non-blocking: a blip here shouldn't trap
      // the user in onboarding — log and proceed.
      const accountId = user?.account_id;
      if (accountId) {
        setSubmitting(true);
        try {
          await accountApiClient.updateAccount(accountId, {
            name: fullName.trim(),
          });
        } catch (err) {
          console.error("[useOnboarding] updateAccount(name) failed:", err);
        } finally {
          setSubmitting(false);
        }
      }
      goNext();
      return;
    }

    await advanceOrFinish();
  };

  /**
   * "Skip for now": skipping the invite step just advances to the
   * personalization steps; skipping any personalization step bypasses the
   * rest and jumps straight to the celebration (the old skip-all semantics).
   */
  const skipForNow = async () => {
    setError(null);
    if (step === "invite") {
      goNext();
      return;
    }
    await finalize();
  };

  const continueFromCreated = () => setPhase("welcome-tabs");

  const enterApp = () => {
    localStorage.setItem("show-splash-after-onboarding", "1");
    router.push("/sales");
  };

  const toggleRole = (id: string) => {
    setRoles((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  };

  const toggleInterest = (id: string) => {
    setInterests((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  return {
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
    // form state
    workspaceName,
    setWorkspaceName,
    fullName,
    setFullName,
    createdOrgId,
    roles,
    toggleRole,
    interests,
    toggleInterest,
    responseLength,
    setResponseLength,
    tone,
    setTone,
  };
}
