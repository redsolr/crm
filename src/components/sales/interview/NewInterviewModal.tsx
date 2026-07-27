"use client";

/**
 * New-interview quick-create — the Interviews tab's speed path.
 *
 * Built for the ten seconds before a live meeting starts: type the
 * company (typeahead over existing accounts — an unknown name creates
 * the account inline), optionally say what it's about, pick the
 * script, Start. Behind the scenes it find-or-creates the account +
 * opportunity — the same records the pipeline reads — so the interview
 * is tied to the pipeline by construction, not as a follow-up chore.
 */

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Field, FORM_INPUT_CLASS as INPUT } from "../form";
import {
  OPPORTUNITY_USE_CASE_OPTIONS,
  SALES_TYPE_KEYS,
} from "@/lib/sales/constants";
import {
  useCreateAccount,
  useCreateOpportunity,
} from "@/lib/sales/use-sales-mutations";
import { fireActivation } from "@/lib/sales/activation";
import { INTERVIEW_SCRIPTS, findInterviewScript } from "@/lib/interview/scripts";
import type { InterviewScript } from "@/lib/interview/script-schema";
import type { WorkItem } from "@/lib/workItemsApi";
import type { SalesWorkspaceBundle } from "@/lib/sales/use-sales-workspace";

interface Props {
  bundle: SalesWorkspaceBundle;
  accounts: WorkItem[];
  onClose: () => void;
  /** Records exist — drop straight into the interview overlay. */
  onLaunch: (opportunity: WorkItem, script: InterviewScript) => void;
}

export function NewInterviewModal({
  bundle,
  accounts,
  onClose,
  onLaunch,
}: Props) {
  const [company, setCompany] = useState("");
  const [about, setAbout] = useState("");
  // Prefilled from the preset — sales prep is repetitive by design,
  // so the script carries the defaults and the founder only overrides
  // when this meeting differs.
  const [useCase, setUseCase] = useState<string>(
    INTERVIEW_SCRIPTS[0].default_use_case ?? "other",
  );
  const [scriptKey, setScriptKey] = useState(INTERVIEW_SCRIPTS[0].key);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createAccount = useCreateAccount();
  const createOpportunity = useCreateOpportunity();

  const accountType = bundle.workItemTypes.find(
    (t) => t.key === SALES_TYPE_KEYS.account,
  );
  const accountDefs = accountType
    ? bundle.attributeDefinitionsByType[accountType.id] ?? []
    : [];
  const opportunityType = bundle.workItemTypes.find(
    (t) => t.key === SALES_TYPE_KEYS.opportunity,
  );
  const opportunityDefs = opportunityType
    ? bundle.attributeDefinitionsByType[opportunityType.id] ?? []
    : [];

  const matchedAccount = useMemo(() => {
    const needle = company.trim().toLowerCase();
    if (needle === "") return undefined;
    return accounts.find((a) => a.title.trim().toLowerCase() === needle);
  }, [accounts, company]);

  const script = findInterviewScript(scriptKey) ?? INTERVIEW_SCRIPTS[0];
  const canSubmit = company.trim().length > 0 && !submitting;

  async function handleStart() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      let account = matchedAccount;
      if (!account) {
        account = await createAccount.mutateAsync({
          title: company.trim(),
          workspace_id: bundle.workspace.id,
          definitions: accountDefs,
        });
        fireActivation("first_lead_added", {
          account_id: account.id,
          source: "interview",
        });
      }

      const opportunity = await createOpportunity.mutateAsync({
        title: `${account.title} — ${about.trim() || script.default_title_suffix}`,
        workspace_id: bundle.workspace.id,
        parent_id: account.id,
        definitions: opportunityDefs,
        attributes: { use_case: useCase },
      });
      fireActivation("first_opportunity_created", {
        opportunity_id: opportunity.id,
        use_case: useCase,
      });

      onLaunch(opportunity, script);
    } catch (err) {
      console.error("[NewInterviewModal] quick-create failed:", err);
      setError("Could not set up the interview. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <Modal.Title>New interview</Modal.Title>
      <Modal.Description>
        Type the company and start — the account and pipeline
        opportunity are created (or reused) automatically, and the
        interview saves under them as a call note.
      </Modal.Description>
      <Modal.Body>
        <div className="new-interview-form space-y-4">
          <Field label="Company" required>
            <input
              type="text"
              data-testid="new-interview-company-input"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleStart();
              }}
              placeholder="Firm name — existing or new"
              className={INPUT}
              list="new-interview-company-options"
              autoFocus
            />
            <datalist id="new-interview-company-options">
              {accounts.map((a) => (
                <option key={a.id} value={a.title} />
              ))}
            </datalist>
            <p className="text-[11px] text-[var(--theme-text-muted)] mt-1">
              {matchedAccount
                ? `Existing account — the interview attaches to ${matchedAccount.title}.`
                : company.trim()
                  ? "New company — the account is created for you."
                  : " "}
            </p>
          </Field>
          <Field label="What's it about">
            <input
              type="text"
              data-testid="new-interview-about-input"
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder={`Optional — defaults to "${script.default_title_suffix}"`}
              className={INPUT}
            />
          </Field>
          <Field label="Use case">
            <select
              data-testid="new-interview-use-case-select"
              value={useCase}
              onChange={(e) => setUseCase(e.target.value)}
              className={INPUT}
            >
              {OPPORTUNITY_USE_CASE_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Script">
            {INTERVIEW_SCRIPTS.length > 1 ? (
              <select
                data-testid="new-interview-script-select"
                value={scriptKey}
                onChange={(e) => {
                  const next = findInterviewScript(e.target.value);
                  setScriptKey(e.target.value);
                  // Re-prefill from the newly picked preset.
                  if (next?.default_use_case) setUseCase(next.default_use_case);
                }}
                className={INPUT}
              >
                {INTERVIEW_SCRIPTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.title}
                  </option>
                ))}
              </select>
            ) : (
              <p
                className="text-sm text-[var(--theme-text-secondary)] px-1 py-1.5"
                data-testid="new-interview-script-fixed"
              >
                {script.title}
              </p>
            )}
            {/* The preset's goal, visible before the meeting starts —
                the founder walks in knowing what this session is for. */}
            <p
              className="new-interview-goal text-[12px] text-[var(--theme-text-muted)] mt-1.5 leading-snug"
              data-testid="new-interview-goal"
            >
              {script.ai_context.goal}
            </p>
          </Field>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </Modal.Body>
      <Modal.Actions>
        <Modal.Button
          cta
          onClick={() => void handleStart()}
          disabled={!canSubmit}
          loading={submitting}
        >
          ▶ Start interview
        </Modal.Button>
        <Modal.ButtonMuted onClick={onClose}>Cancel</Modal.ButtonMuted>
      </Modal.Actions>
    </Modal>
  );
}
