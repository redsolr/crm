/* tslint:disable */
/* eslint-disable */
/**
 * Public projection of an `accounts` row. Excludes `stripe_customer_id` (cross-tenant billing PK — never on wire) and `is_active` (first-party-app suspend toggle lives on `control.account_app_state`; an authenticated caller is by definition active so the field is informationally redundant).
 * @export
 * @interface Account
 */
export interface Account {
    /**
     * Prefixed resource ID. Wire form: `acc_<base58>`.
     * @type {string}
     * @memberof Account
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof Account
     */
    email: string;
    /**
     * 
     * @type {string}
     * @memberof Account
     */
    full_name: string | null;
    /**
     * 
     * @type {string}
     * @memberof Account
     */
    avatar_url: string | null;
    /**
     * 
     * @type {{ [key: string]: string; }}
     * @memberof Account
     */
    metadata: { [key: string]: string; };
    /**
     * 
     * @type {string}
     * @memberof Account
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Account
     */
    updated_at: string;
}
/**
 * 
 * @export
 * @interface AccountListEnvelope
 */
export interface AccountListEnvelope {
    [key: string]: any | any;
    /**
     * 
     * @type {Array<Account>}
     * @memberof AccountListEnvelope
     */
    data: Array<Account>;
    /**
     * 
     * @type {AccountListEnvelopeMeta}
     * @memberof AccountListEnvelope
     */
    meta: AccountListEnvelopeMeta;
}
/**
 * 
 * @export
 * @interface AccountListEnvelopeMeta
 */
export interface AccountListEnvelopeMeta {
    /**
     * 
     * @type {number}
     * @memberof AccountListEnvelopeMeta
     */
    total: number;
    /**
     * 
     * @type {number}
     * @memberof AccountListEnvelopeMeta
     */
    page: number;
    /**
     * 
     * @type {number}
     * @memberof AccountListEnvelopeMeta
     */
    limit: number;
    /**
     * 
     * @type {number}
     * @memberof AccountListEnvelopeMeta
     */
    total_pages: number;
    /**
     * 
     * @type {boolean}
     * @memberof AccountListEnvelopeMeta
     */
    has_next_page: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof AccountListEnvelopeMeta
     */
    has_previous_page: boolean;
}
/**
 * One row of `GET /v1/accounts/me/organizations` — pairs an organization the caller belongs to with their membership row (role + joined_at). Lets a switcher UX render in one round-trip.
 * @export
 * @interface AccountMembership
 */
export interface AccountMembership {
    [key: string]: any | any;
    /**
     * 
     * @type {AccountMembershipOrganization}
     * @memberof AccountMembership
     */
    organization: AccountMembershipOrganization;
    /**
     * 
     * @type {AccountMembershipMembership}
     * @memberof AccountMembership
     */
    membership: AccountMembershipMembership;
}
/**
 * 
 * @export
 * @interface AccountMembershipList
 */
export interface AccountMembershipList {
    /**
     * 
     * @type {Array<AccountMembership>}
     * @memberof AccountMembershipList
     */
    data: Array<AccountMembership>;
}
/**
 * 
 * @export
 * @interface AccountMembershipMembership
 */
export interface AccountMembershipMembership {
    /**
     * Prefixed resource ID. Wire form: `mem_<base58>`.
     * @type {string}
     * @memberof AccountMembershipMembership
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof AccountMembershipMembership
     */
    role: AccountMembershipMembershipRoleEnum;
    /**
     * 
     * @type {boolean}
     * @memberof AccountMembershipMembership
     */
    is_active: boolean;
    /**
     * 
     * @type {AccountMembershipMembershipInvitedAt}
     * @memberof AccountMembershipMembership
     */
    invited_at: AccountMembershipMembershipInvitedAt;
    /**
     * 
     * @type {AccountMembershipMembershipInvitedAt}
     * @memberof AccountMembershipMembership
     */
    joined_at: AccountMembershipMembershipInvitedAt;
}


/**
 * @export
 */
export const AccountMembershipMembershipRoleEnum = {
    owner: 'owner',
    admin: 'admin',
    member: 'member',
    billing: 'billing',
    readonly: 'readonly'
} as const;
export type AccountMembershipMembershipRoleEnum = typeof AccountMembershipMembershipRoleEnum[keyof typeof AccountMembershipMembershipRoleEnum];

/**
 * 
 * @export
 * @interface AccountMembershipMembershipInvitedAt
 */
export interface AccountMembershipMembershipInvitedAt {
}
/**
 * 
 * @export
 * @interface AccountMembershipOrganization
 */
export interface AccountMembershipOrganization {
    /**
     * Prefixed resource ID. Wire form: `org_<base58>`.
     * @type {string}
     * @memberof AccountMembershipOrganization
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof AccountMembershipOrganization
     */
    name: string;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof AccountMembershipOrganization
     */
    billing_email: AccountMembershipOrganizationBillingEmail;
    /**
     * 
     * @type {{ [key: string]: string; }}
     * @memberof AccountMembershipOrganization
     */
    metadata: { [key: string]: string; };
    /**
     * 
     * @type {string}
     * @memberof AccountMembershipOrganization
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof AccountMembershipOrganization
     */
    updated_at: string;
}
/**
 * 
 * @export
 * @interface AccountMembershipOrganizationBillingEmail
 */
export interface AccountMembershipOrganizationBillingEmail {
}
/**
 * 
 * @export
 * @interface AccountUsageConsolidated
 */
export interface AccountUsageConsolidated {
    /**
     * 
     * @type {number}
     * @memberof AccountUsageConsolidated
     */
    token_count: number;
    /**
     * 
     * @type {number}
     * @memberof AccountUsageConsolidated
     */
    total_cost_cents: number;
}
/**
 * Consolidated across-orgs spend view for one account. Sums the per-org `getUsageSummary` rolled-up totals and surfaces a per-org breakdown for chargeback. Maya-style consolidated billing reads from this endpoint.
 * @export
 * @interface AccountUsageSummary
 */
export interface AccountUsageSummary {
    /**
     * Prefixed resource ID. Wire form: `acc_<base58>`.
     * @type {string}
     * @memberof AccountUsageSummary
     */
    account_id: string;
    /**
     * 
     * @type {number}
     * @memberof AccountUsageSummary
     */
    organizations_count: number;
    /**
     * 
     * @type {AccountUsageConsolidated}
     * @memberof AccountUsageSummary
     */
    consolidated: AccountUsageConsolidated;
    /**
     * 
     * @type {Array<UsageByOrganization>}
     * @memberof AccountUsageSummary
     */
    by_organization: Array<UsageByOrganization>;
}
/**
 * Every workspace the caller can reach across all their org memberships, grouped `organization → workspace`. Companion to the `Jurisimus-Workspace-Id` request header — pick a workspace from this list, then stamp the header on subsequent requests to override the JWT-claim workspace.
 * @export
 * @interface AccountWorkspaces
 */
export interface AccountWorkspaces {
    [key: string]: any | any;
    /**
     * 
     * @type {Array<AccountWorkspacesOrganizationsInner>}
     * @memberof AccountWorkspaces
     */
    organizations: Array<AccountWorkspacesOrganizationsInner>;
}
/**
 * 
 * @export
 * @interface AccountWorkspacesOrganizationsInner
 */
export interface AccountWorkspacesOrganizationsInner {
    /**
     * Prefixed resource ID. Wire form: `org_<base58>`.
     * @type {string}
     * @memberof AccountWorkspacesOrganizationsInner
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof AccountWorkspacesOrganizationsInner
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof AccountWorkspacesOrganizationsInner
     */
    role: AccountWorkspacesOrganizationsInnerRoleEnum;
    /**
     * 
     * @type {Array<AccountWorkspacesOrganizationsInnerWorkspacesInner>}
     * @memberof AccountWorkspacesOrganizationsInner
     */
    workspaces: Array<AccountWorkspacesOrganizationsInnerWorkspacesInner>;
}


/**
 * @export
 */
export const AccountWorkspacesOrganizationsInnerRoleEnum = {
    owner: 'owner',
    admin: 'admin',
    member: 'member',
    billing: 'billing',
    readonly: 'readonly'
} as const;
export type AccountWorkspacesOrganizationsInnerRoleEnum = typeof AccountWorkspacesOrganizationsInnerRoleEnum[keyof typeof AccountWorkspacesOrganizationsInnerRoleEnum];

/**
 * 
 * @export
 * @interface AccountWorkspacesOrganizationsInnerWorkspacesInner
 */
export interface AccountWorkspacesOrganizationsInnerWorkspacesInner {
    /**
     * Prefixed resource ID. Wire form: `ws_<base58>`.
     * @type {string}
     * @memberof AccountWorkspacesOrganizationsInnerWorkspacesInner
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof AccountWorkspacesOrganizationsInnerWorkspacesInner
     */
    key: string;
    /**
     * 
     * @type {string}
     * @memberof AccountWorkspacesOrganizationsInnerWorkspacesInner
     */
    name: string;
}
/**
 * Customer-facing projection of an `service.activities` row. Excludes `organization_id`, `row_hash`, `prev_hash`, `token_scope_at_call` (internal bookkeeping). The activity feed is the "queryable company" primitive — kept narrow so an agent can drop a page directly into a model prompt without burning the context window.
 * @export
 * @interface Activity
 */
export interface Activity {
    /**
     * Prefixed resource ID. Wire form: `act_<base58>`.
     * @type {string}
     * @memberof Activity
     */
    id: string;
    /**
     * Activity type (e.g. `task_created`, `comment_added`). Open string on the wire so writers can introduce new types without a parallel reader deploy. Closed set lives in `activities.dto.ts` ACTIVITY_TYPES for runtime validation.
     * @type {string}
     * @memberof Activity
     */
    type: string;
    /**
     * 
     * @type {string}
     * @memberof Activity
     */
    entity_type: string;
    /**
     * 
     * @type {string}
     * @memberof Activity
     */
    entity_id: string;
    /**
     * 
     * @type {string}
     * @memberof Activity
     */
    entity_identifier: string | null;
    /**
     * Prefixed resource ID. Wire form: `ws_<base58>`.
     * @type {string}
     * @memberof Activity
     */
    workspace_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof Activity
     */
    actor_id: string | null;
    /**
     * 
     * @type {ActivityActorType}
     * @memberof Activity
     */
    actor_type: ActivityActorType;
    /**
     * 
     * @type {string}
     * @memberof Activity
     */
    actor_name: string | null;
    /**
     * 
     * @type {any}
     * @memberof Activity
     */
    changes: any | null;
    /**
     * 
     * @type {any}
     * @memberof Activity
     */
    metadata: any | null;
    /**
     * 
     * @type {string}
     * @memberof Activity
     */
    created_at: string;
    /**
     * 
     * @type {ActivityActorPayload}
     * @memberof Activity
     */
    actor_account?: ActivityActorPayload;
    /**
     * 
     * @type {ActivityEntityPayload}
     * @memberof Activity
     */
    entity?: ActivityEntityPayload;
}


/**
 * Inline expansion of an activity's actor account. Surfaced under `actor_account` when the caller passes `?include[0]=actor_account`. Minimal projection — only the fields a triage UI needs.
 * @export
 * @interface ActivityActorPayload
 */
export interface ActivityActorPayload {
    /**
     * Prefixed resource ID. Wire form: `acc_<base58>`.
     * @type {string}
     * @memberof ActivityActorPayload
     */
    id: string | null;
    /**
     * 
     * @type {ActivityActorType}
     * @memberof ActivityActorPayload
     */
    type: ActivityActorType;
    /**
     * 
     * @type {string}
     * @memberof ActivityActorPayload
     */
    name: string | null;
    /**
     * 
     * @type {string}
     * @memberof ActivityActorPayload
     */
    email: string | null;
}



/**
 * Closed set mirrored from the `actor_type` pgEnum on `service.activities`. `agent` covers AI agents calling the API on behalf of a user; `system` and `service` are platform writers.
 * @export
 */
export const ActivityActorType = {
    user: 'user',
    agent: 'agent',
    system: 'system',
    service: 'service'
} as const;
export type ActivityActorType = typeof ActivityActorType[keyof typeof ActivityActorType];

/**
 * 
 * @export
 * @interface ActivityCursorPage
 */
export interface ActivityCursorPage {
    /**
     * 
     * @type {Array<Activity>}
     * @memberof ActivityCursorPage
     */
    data: Array<Activity>;
    /**
     * 
     * @type {boolean}
     * @memberof ActivityCursorPage
     */
    has_more: boolean;
    /**
     * 
     * @type {string}
     * @memberof ActivityCursorPage
     */
    next_page_url: string | null;
    /**
     * 
     * @type {string}
     * @memberof ActivityCursorPage
     */
    previous_page_url: string | null;
}
/**
 * Inline expansion of an activity's entity. Today only `entity_type=task` resolves (the dominant agent surface). Other entity types fall back to the flat `entity_id` / `entity_identifier` fields on the base shape.
 * @export
 * @interface ActivityEntityPayload
 */
export interface ActivityEntityPayload {
    /**
     * 
     * @type {string}
     * @memberof ActivityEntityPayload
     */
    id: string;
    /**
     * Resolved entity type (e.g. `work_item`). NOT necessarily the same as the activity's `entity_type` — for `entity_type=task` the resolved entity is a `work_item`.
     * @type {string}
     * @memberof ActivityEntityPayload
     */
    type: string;
    /**
     * 
     * @type {string}
     * @memberof ActivityEntityPayload
     */
    identifier: string | null;
    /**
     * 
     * @type {string}
     * @memberof ActivityEntityPayload
     */
    title: string | null;
}
/**
 * 
 * @export
 * @interface ActivityFeedEnvelope
 */
export interface ActivityFeedEnvelope {
    /**
     * 
     * @type {Array<Activity>}
     * @memberof ActivityFeedEnvelope
     */
    activities: Array<Activity>;
}
/**
 * 
 * @export
 * @interface ActivityListEnvelope
 */
export interface ActivityListEnvelope {
    /**
     * 
     * @type {Array<Activity>}
     * @memberof ActivityListEnvelope
     */
    activities: Array<Activity>;
    /**
     * 
     * @type {number}
     * @memberof ActivityListEnvelope
     */
    total: number;
}
/**
 * 
 * @export
 * @interface AddChatMessage
 */
export interface AddChatMessage {
    /**
     * 
     * @type {string}
     * @memberof AddChatMessage
     */
    role: string;
    /**
     * 
     * @type {string}
     * @memberof AddChatMessage
     */
    content: string;
}
/**
 * 
 * @export
 * @interface AddFindingsToSet
 */
export interface AddFindingsToSet {
    /**
     * 
     * @type {Array<string>}
     * @memberof AddFindingsToSet
     */
    finding_ids: Array<string>;
}
/**
 * 
 * @export
 * @interface AddGroupMember
 */
export interface AddGroupMember {
    /**
     * Prefixed resource ID. Wire form: `acc_<base58>`.
     * @type {string}
     * @memberof AddGroupMember
     */
    account_id: string;
}
/**
 * 
 * @export
 * @interface AddGroupPolicy
 */
export interface AddGroupPolicy {
    /**
     * Prefixed resource ID. Wire form: `pol_<base58>`.
     * @type {string}
     * @memberof AddGroupPolicy
     */
    policy_id: string;
}
/**
 * 
 * @export
 * @interface AddOrganizationMember
 */
export interface AddOrganizationMember {
    /**
     * Prefixed resource ID. Wire form: `acc_<base58>`.
     * @type {string}
     * @memberof AddOrganizationMember
     */
    account_id: string;
    /**
     * 
     * @type {string}
     * @memberof AddOrganizationMember
     */
    role: AddOrganizationMemberRoleEnum;
    /**
     * Prefixed resource ID. Wire form: `acc_<base58>`.
     * @type {string}
     * @memberof AddOrganizationMember
     */
    invited_by?: string;
    /**
     * 
     * @type {string}
     * @memberof AddOrganizationMember
     */
    external_id?: string;
}


/**
 * @export
 */
export const AddOrganizationMemberRoleEnum = {
    owner: 'owner',
    admin: 'admin',
    member: 'member',
    billing: 'billing',
    readonly: 'readonly'
} as const;
export type AddOrganizationMemberRoleEnum = typeof AddOrganizationMemberRoleEnum[keyof typeof AddOrganizationMemberRoleEnum];

/**
 * Management projection of a platform API-key row. Hashed token is excluded — it never leaves the DB layer. `token` is set on issuance + rotation only; lists, gets, and revokes never carry it.
 * @export
 * @interface ApiKey
 */
export interface ApiKey {
    /**
     * Prefixed id (`ak_<base58>`).
     * @type {string}
     * @memberof ApiKey
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof ApiKey
     */
    organization_id: string;
    /**
     * 
     * @type {string}
     * @memberof ApiKey
     */
    workspace_id: string;
    /**
     * 
     * @type {string}
     * @memberof ApiKey
     */
    created_by_id: string;
    /**
     * 
     * @type {string}
     * @memberof ApiKey
     */
    name: string;
    /**
     * First 12 chars of the raw token (e.g. `ak_live_abcd`). Stable across the key's lifetime; safe to display in management UI.
     * @type {string}
     * @memberof ApiKey
     */
    token_prefix: string;
    /**
     * 
     * @type {string}
     * @memberof ApiKey
     */
    token_last4: string;
    /**
     * 
     * @type {string}
     * @memberof ApiKey
     */
    pinned_version: string | null;
    /**
     * 
     * @type {string}
     * @memberof ApiKey
     */
    expires_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof ApiKey
     */
    rotated_from_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof ApiKey
     */
    rotated_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof ApiKey
     */
    first_used_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof ApiKey
     */
    last_used_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof ApiKey
     */
    last_used_ip: string | null;
    /**
     * 
     * @type {string}
     * @memberof ApiKey
     */
    revoked_at: string | null;
    /**
     * 
     * @type {{ [key: string]: string; }}
     * @memberof ApiKey
     */
    metadata: { [key: string]: string; };
    /**
     * 
     * @type {string}
     * @memberof ApiKey
     */
    created_at: string;
    /**
     * The raw `ak_live_*` / `ak_test_*` token. Populated ONLY on the issuance response (`POST /v1/api_keys`) and the rotation response (`POST /v1/api_keys/{id}:rotate`). After this single echo, the platform cannot recover it — issue a new key if lost.
     * @type {string}
     * @memberof ApiKey
     */
    token?: string;
}
/**
 * Per-key usage drill-down: headline period totals + daily time-series for one specific api-key. Mirrors the org-level `usage/breakdown?group_by=day` shape filtered to a single api-key. `by_day` is sparse — gap days where this key drove no spend are NOT auto-filled.
 * @export
 * @interface ApiKeyUsage
 */
export interface ApiKeyUsage {
    /**
     * Prefixed resource ID. Wire form: `ak_<base58>`.
     * @type {string}
     * @memberof ApiKeyUsage
     */
    api_key_id: string;
    /**
     * Prefixed resource ID. Wire form: `org_<base58>`.
     * @type {string}
     * @memberof ApiKeyUsage
     */
    organization_id: string;
    /**
     * 
     * @type {string}
     * @memberof ApiKeyUsage
     */
    period_start: string;
    /**
     * 
     * @type {string}
     * @memberof ApiKeyUsage
     */
    period_end: string;
    /**
     * 
     * @type {ApiKeyUsageTotals}
     * @memberof ApiKeyUsage
     */
    totals: ApiKeyUsageTotals;
    /**
     * 
     * @type {Array<UsageByDay>}
     * @memberof ApiKeyUsage
     */
    by_day: Array<UsageByDay>;
}
/**
 * 
 * @export
 * @interface ApiKeyUsageTotals
 */
export interface ApiKeyUsageTotals {
    /**
     * 
     * @type {number}
     * @memberof ApiKeyUsageTotals
     */
    token_count: number;
    /**
     * 
     * @type {number}
     * @memberof ApiKeyUsageTotals
     */
    total_cost_cents: number;
}
/**
 * 
 * @export
 * @interface AttachLabel
 */
export interface AttachLabel {
    /**
     * Prefixed resource ID. Wire form: `lbl_<base58>`.
     * @type {string}
     * @memberof AttachLabel
     */
    label_id: string;
}
/**
 * A file attached to a work_item, comment, or communication. The byte blob lives in S3; this row records the binding + display metadata. The caller is responsible for hitting the presigned URL minted by POST /v1/uploads/presign before calling POST /v1/attachments.
 * @export
 * @interface Attachment
 */
export interface Attachment {
    /**
     * Prefixed resource ID. Wire form: `att_<base58>`.
     * @type {string}
     * @memberof Attachment
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof Attachment
     */
    parent_type: AttachmentParentTypeEnum;
    /**
     * Polymorphic on `parent_type`. `wi_*` when `work_item`; `cmt_*` when `comment`; `comm_*` when `communication`.
     * @type {string}
     * @memberof Attachment
     */
    parent_id: string;
    /**
     * 
     * @type {string}
     * @memberof Attachment
     */
    s3_key: string;
    /**
     * 
     * @type {string}
     * @memberof Attachment
     */
    file_name: string;
    /**
     * 
     * @type {string}
     * @memberof Attachment
     */
    content_type: string;
    /**
     * 
     * @type {number}
     * @memberof Attachment
     */
    size_bytes: number;
    /**
     * 
     * @type {string}
     * @memberof Attachment
     */
    sha256: string | null;
    /**
     * Opaque polymorphic actor reference (Actor Contract — 1-128 chars, `[A-Za-z0-9_:.\-+@]+`). The Jurisimus consumer app sends `account:{prefixed_account_id}` here; SaaS-dev tenants send any opaque string in their own namespace.
     * @type {string}
     * @memberof Attachment
     */
    uploaded_by_id: string;
    /**
     * 
     * @type {string}
     * @memberof Attachment
     */
    uploaded_by_name: string | null;
    /**
     * 
     * @type {string}
     * @memberof Attachment
     */
    created_at: string;
}


/**
 * @export
 */
export const AttachmentParentTypeEnum = {
    work_item: 'work_item',
    comment: 'comment',
    communication: 'communication'
} as const;
export type AttachmentParentTypeEnum = typeof AttachmentParentTypeEnum[keyof typeof AttachmentParentTypeEnum];

/**
 * 
 * @export
 * @interface AttachmentEnvelope
 */
export interface AttachmentEnvelope {
    /**
     * 
     * @type {Attachment}
     * @memberof AttachmentEnvelope
     */
    attachment: Attachment;
}
/**
 * 
 * @export
 * @interface AttachmentListEnvelope
 */
export interface AttachmentListEnvelope {
    /**
     * 
     * @type {Array<Attachment>}
     * @memberof AttachmentListEnvelope
     */
    data: Array<Attachment>;
}
/**
 * Result of a sync single-item LLM compute. `skipped_manual_override` reports loudly that a human value already exists and was left untouched; `value` is the row as it stands after the call (null only when the work item has no row and the compute failed).
 * @export
 * @interface AttributeComputeResult
 */
export interface AttributeComputeResult {
    /**
     * 
     * @type {string}
     * @memberof AttributeComputeResult
     */
    outcome: AttributeComputeResultOutcomeEnum;
    /**
     * 
     * @type {AttributeValue}
     * @memberof AttributeComputeResult
     */
    value: AttributeValue | null;
}


/**
 * @export
 */
export const AttributeComputeResultOutcomeEnum = {
    computed: 'computed',
    skipped_manual_override: 'skipped_manual_override',
    failed: 'failed'
} as const;
export type AttributeComputeResultOutcomeEnum = typeof AttributeComputeResultOutcomeEnum[keyof typeof AttributeComputeResultOutcomeEnum];


/**
 * 
 * @export
 */
export const AttributeDataType = {
    text: 'text',
    number: 'number',
    date: 'date',
    boolean: 'boolean',
    url: 'url',
    user_ref: 'user_ref',
    select: 'select',
    multi_select: 'multi_select'
} as const;
export type AttributeDataType = typeof AttributeDataType[keyof typeof AttributeDataType];

/**
 * A custom-field declaration on a WorkItemType (e.g. `Bug.severity`, `Feature.customer_impact`). Per-work-item values are stored separately as `AttributeValue` rows.
 * @export
 * @interface AttributeDefinition
 */
export interface AttributeDefinition {
    /**
     * Prefixed resource ID. Wire form: `ad_<base58>`.
     * @type {string}
     * @memberof AttributeDefinition
     */
    id: string;
    /**
     * Prefixed resource ID. Wire form: `wit_<base58>`.
     * @type {string}
     * @memberof AttributeDefinition
     */
    work_item_type_id: string;
    /**
     * 
     * @type {string}
     * @memberof AttributeDefinition
     */
    key: string;
    /**
     * 
     * @type {string}
     * @memberof AttributeDefinition
     */
    name: string;
    /**
     * 
     * @type {AttributeDataType}
     * @memberof AttributeDefinition
     */
    data_type: AttributeDataType;
    /**
     * 
     * @type {boolean}
     * @memberof AttributeDefinition
     */
    required: boolean;
    /**
     * 
     * @type {any}
     * @memberof AttributeDefinition
     */
    config: any | null;
    /**
     * 
     * @type {number}
     * @memberof AttributeDefinition
     */
    position: number;
    /**
     * 
     * @type {any}
     * @memberof AttributeDefinition
     */
    enrichment: any | null;
    /**
     * 
     * @type {string}
     * @memberof AttributeDefinition
     */
    template_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof AttributeDefinition
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof AttributeDefinition
     */
    updated_at: string;
}


/**
 * 
 * @export
 * @interface AttributeDefinitionEnvelope
 */
export interface AttributeDefinitionEnvelope {
    /**
     * 
     * @type {AttributeDefinition}
     * @memberof AttributeDefinitionEnvelope
     */
    definition: AttributeDefinition;
}
/**
 * 
 * @export
 * @interface AttributeDefinitionListEnvelope
 */
export interface AttributeDefinitionListEnvelope {
    /**
     * 
     * @type {Array<AttributeDefinition>}
     * @memberof AttributeDefinitionListEnvelope
     */
    data: Array<AttributeDefinition>;
}
/**
 * An async column-wide LLM enrichment job. Live counts drive a progress bar as the worker fills the column; poll `GET /v1/attribute_enrichment_jobs/{id}`.
 * @export
 * @interface AttributeEnrichmentJob
 */
export interface AttributeEnrichmentJob {
    /**
     * Prefixed resource ID. Wire form: `aej_<base58>`.
     * @type {string}
     * @memberof AttributeEnrichmentJob
     */
    id: string;
    /**
     * Prefixed resource ID. Wire form: `wit_<base58>`.
     * @type {string}
     * @memberof AttributeEnrichmentJob
     */
    work_item_type_id: string;
    /**
     * Prefixed resource ID. Wire form: `ad_<base58>`.
     * @type {string}
     * @memberof AttributeEnrichmentJob
     */
    definition_id: string;
    /**
     * 
     * @type {string}
     * @memberof AttributeEnrichmentJob
     */
    status: AttributeEnrichmentJobStatusEnum;
    /**
     * 
     * @type {number}
     * @memberof AttributeEnrichmentJob
     */
    total_items: number;
    /**
     * 
     * @type {number}
     * @memberof AttributeEnrichmentJob
     */
    processed_items: number;
    /**
     * 
     * @type {number}
     * @memberof AttributeEnrichmentJob
     */
    computed_count: number;
    /**
     * 
     * @type {number}
     * @memberof AttributeEnrichmentJob
     */
    skipped_count: number;
    /**
     * 
     * @type {number}
     * @memberof AttributeEnrichmentJob
     */
    failed_count: number;
    /**
     * 
     * @type {string}
     * @memberof AttributeEnrichmentJob
     */
    error_code: string | null;
    /**
     * 
     * @type {string}
     * @memberof AttributeEnrichmentJob
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof AttributeEnrichmentJob
     */
    updated_at: string;
    /**
     * 
     * @type {string}
     * @memberof AttributeEnrichmentJob
     */
    started_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof AttributeEnrichmentJob
     */
    finished_at: string | null;
}


/**
 * @export
 */
export const AttributeEnrichmentJobStatusEnum = {
    pending: 'pending',
    running: 'running',
    completed: 'completed',
    failed: 'failed'
} as const;
export type AttributeEnrichmentJobStatusEnum = typeof AttributeEnrichmentJobStatusEnum[keyof typeof AttributeEnrichmentJobStatusEnum];

/**
 * A per-work-item custom-field value. One row per (work_item_id, definition_id) pair. Upserted via PUT, removed via DELETE on the same URL.
 * @export
 * @interface AttributeValue
 */
export interface AttributeValue {
    /**
     * Prefixed resource ID. Wire form: `av_<base58>`.
     * @type {string}
     * @memberof AttributeValue
     */
    id: string;
    /**
     * Prefixed resource ID. Wire form: `wi_<base58>`.
     * @type {string}
     * @memberof AttributeValue
     */
    work_item_id: string;
    /**
     * Prefixed resource ID. Wire form: `ad_<base58>`.
     * @type {string}
     * @memberof AttributeValue
     */
    definition_id: string;
    /**
     * 
     * @type {any}
     * @memberof AttributeValue
     */
    value: any | null;
    /**
     * `manual` — a human set it. `computed` — the LLM-enrichment primitive wrote it. Computed writes can never overwrite a manual row (enforced at the database conflict level).
     * @type {string}
     * @memberof AttributeValue
     */
    source: AttributeValueSourceEnum;
    /**
     * 
     * @type {string}
     * @memberof AttributeValue
     */
    computed_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof AttributeValue
     */
    computed_model: string | null;
    /**
     * 
     * @type {string}
     * @memberof AttributeValue
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof AttributeValue
     */
    updated_at: string;
}


/**
 * @export
 */
export const AttributeValueSourceEnum = {
    manual: 'manual',
    computed: 'computed'
} as const;
export type AttributeValueSourceEnum = typeof AttributeValueSourceEnum[keyof typeof AttributeValueSourceEnum];

/**
 * 
 * @export
 * @interface AttributeValueEnvelope
 */
export interface AttributeValueEnvelope {
    /**
     * 
     * @type {AttributeValue}
     * @memberof AttributeValueEnvelope
     */
    value: AttributeValue;
}
/**
 * 
 * @export
 * @interface AttributeValueListEnvelope
 */
export interface AttributeValueListEnvelope {
    /**
     * 
     * @type {Array<AttributeValue>}
     * @memberof AttributeValueListEnvelope
     */
    data: Array<AttributeValue>;
}
/**
 * One audit row recording a config / member / api-key / workspace / webhook / template / billing change. Distinct from `Event` (product events for outbound webhook delivery) — audit covers ADMIN changes, events cover DATA changes. Distinct from the staff `admin_query_audit` table — customers see THEIR audit log, Jurisimus support queries surface separately through Support Access.
 * @export
 * @interface AuditEvent
 */
export interface AuditEvent {
    [key: string]: any | any;
    /**
     * Prefixed resource ID. Wire form: `audit_<base58>`.
     * @type {string}
     * @memberof AuditEvent
     */
    id: string;
    /**
     * Opaque text identifying the credential that authenticated the originating request. Namespace convention: `api_key:ak_*` (platform API key — SaaS-dev integration), `account:acc_*` (JWT session — Jurisimus dashboard / SDK), `pat:uat_*` (user PAT — `sk_user_*` token), `system` (cron / migration / automation). Always set. Authorization decisions key on this, NOT on `actor_id`.
     * @type {string}
     * @memberof AuditEvent
     */
    auth_principal: string;
    /**
     * 
     * @type {AuditEventActorId}
     * @memberof AuditEvent
     */
    actor_id: AuditEventActorId;
    /**
     * 
     * @type {AuditEventActorName}
     * @memberof AuditEvent
     */
    actor_name: AuditEventActorName;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof AuditEvent
     */
    actor_email: AccountMembershipOrganizationBillingEmail;
    /**
     * Closed enum-as-string. Examples: `member.invited`, `api_key.rotated`, `workspace.deleted`. New actions ship without a migration; the emit-side type guarantees the closed set.
     * @type {string}
     * @memberof AuditEvent
     */
    action: string;
    /**
     * What was acted on: `organization` / `workspace` / `api_key` / `webhook` / `member` / `template`. Polymorphic; pair with `target_id` to resolve.
     * @type {string}
     * @memberof AuditEvent
     */
    target_type: string;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof AuditEvent
     */
    target_id: AccountMembershipOrganizationBillingEmail;
    /**
     * Prefixed resource ID. Wire form: `org_<base58>`.
     * @type {string}
     * @memberof AuditEvent
     */
    organization_id: string;
    /**
     * Prefixed resource ID. Wire form: `ws_<base58>`.
     * @type {string}
     * @memberof AuditEvent
     */
    workspace_id: string;
    /**
     * 
     * @type {string}
     * @memberof AuditEvent
     */
    source: AuditEventSourceEnum;
    /**
     * 
     * @type {AuditEventBefore}
     * @memberof AuditEvent
     */
    before: AuditEventBefore;
    /**
     * 
     * @type {AuditEventAfter}
     * @memberof AuditEvent
     */
    after: AuditEventAfter;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof AuditEvent
     */
    request_id: AccountMembershipOrganizationBillingEmail;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof AuditEvent
     */
    ip_address: AccountMembershipOrganizationBillingEmail;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof AuditEvent
     */
    user_agent: AccountMembershipOrganizationBillingEmail;
    /**
     * 
     * @type {string}
     * @memberof AuditEvent
     */
    occurred_at: string;
}


/**
 * @export
 */
export const AuditEventSourceEnum = {
    dashboard: 'dashboard',
    api: 'api',
    system: 'system',
    webhook: 'webhook',
    support: 'support',
    migration: 'migration',
    automation: 'automation'
} as const;
export type AuditEventSourceEnum = typeof AuditEventSourceEnum[keyof typeof AuditEventSourceEnum];

/**
 * Opaque polymorphic text identifying the domain actor (WHO the customer's data says the actor is). For dashboard JWT writes this is the same as `auth_principal` minus the prefix; for `Acting-User` API-key writes the two diverge. Display logic keys on this + `actor_name`.
 * @export
 * @interface AuditEventActorId
 */
export interface AuditEventActorId {
}
/**
 * Cached display name for `actor_id` at write time. Stripe forward-only: actor rename does NOT retroactively rewrite historical rows. Scrubbed to `[deleted]` after the referenced actor is soft-deleted.
 * @export
 * @interface AuditEventActorName
 */
export interface AuditEventActorName {
}
/**
 * 
 * @export
 * @interface AuditEventAfter
 */
export interface AuditEventAfter {
}
/**
 * 
 * @export
 * @interface AuditEventBefore
 */
export interface AuditEventBefore {
}
/**
 * 
 * @export
 * @interface AuditEventPage
 */
export interface AuditEventPage {
    /**
     * 
     * @type {Array<AuditEvent>}
     * @memberof AuditEventPage
     */
    data: Array<AuditEvent>;
    /**
     * 
     * @type {boolean}
     * @memberof AuditEventPage
     */
    has_more: boolean;
    /**
     * 
     * @type {string}
     * @memberof AuditEventPage
     */
    next_page_url: string | null;
    /**
     * 
     * @type {string}
     * @memberof AuditEventPage
     */
    previous_page_url: string | null;
}
/**
 * Token-exchange response — same envelope returned by `POST /auth/workos/exchange` and `POST /v1/accounts/me:switch_organization`.
 * @export
 * @interface AuthExchange
 */
export interface AuthExchange {
    [key: string]: any | any;
    /**
     * 
     * @type {boolean}
     * @memberof AuthExchange
     */
    success: boolean;
    /**
     * 
     * @type {AuthExchangeUser}
     * @memberof AuthExchange
     */
    user: AuthExchangeUser;
    /**
     * Prefixed resource ID. Wire form: `org_<base58>`.
     * @type {string}
     * @memberof AuthExchange
     */
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof AuthExchange
     */
    organization_name?: string;
    /**
     * 
     * @type {string}
     * @memberof AuthExchange
     */
    role?: string;
    /**
     * 
     * @type {boolean}
     * @memberof AuthExchange
     */
    needs_onboarding: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof AuthExchange
     */
    needs_profile_setup: boolean;
    /**
     * 
     * @type {string}
     * @memberof AuthExchange
     */
    access_token: string;
    /**
     * 
     * @type {string}
     * @memberof AuthExchange
     */
    refresh_token: string;
    /**
     * 
     * @type {number}
     * @memberof AuthExchange
     */
    expires_in: number;
}
/**
 * 
 * @export
 * @interface AuthExchangeUser
 */
export interface AuthExchangeUser {
    /**
     * Prefixed resource ID. Wire form: `acc_<base58>`.
     * @type {string}
     * @memberof AuthExchangeUser
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof AuthExchangeUser
     */
    email: string;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof AuthExchangeUser
     */
    full_name: AccountMembershipOrganizationBillingEmail;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof AuthExchangeUser
     */
    avatar_url: AccountMembershipOrganizationBillingEmail;
}

/**
 * 
 * @export
 */
export const BillingInterval = {
    month: 'month',
    year: 'year'
} as const;
export type BillingInterval = typeof BillingInterval[keyof typeof BillingInterval];

/**
 * 
 * @export
 * @interface BranchInfo
 */
export interface BranchInfo {
    /**
     * 
     * @type {string}
     * @memberof BranchInfo
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof BranchInfo
     */
    branch_name: string | null;
    /**
     * 
     * @type {string}
     * @memberof BranchInfo
     */
    branched_from_message_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof BranchInfo
     */
    created_at: string;
    /**
     * 
     * @type {number}
     * @memberof BranchInfo
     */
    message_count: number;
}
/**
 * Snapshot of the organization's billing-period spend vs. its configured budget cap. Money in integer cents to match the platform-wide `*_cents` discipline.
 * @export
 * @interface Budget
 */
export interface Budget {
    /**
     * Spend across the current billing period, in cents (USD).
     * @type {number}
     * @memberof Budget
     */
    total_cost_cents: number;
    /**
     * Configured per-period budget cap, in cents (USD). 0 when the plan has no enforced cap.
     * @type {number}
     * @memberof Budget
     */
    budget_cents: number;
    /**
     * `budget_cents - total_cost_cents`, in cents (USD). MAY be negative when the org has overrun a soft cap.
     * @type {number}
     * @memberof Budget
     */
    budget_remaining_cents: number;
    /**
     * Integer percentage of `budget_cents` consumed, in [0, 100] (capped at 100). Render directly — do NOT multiply by 100. (Description corrected 2026-06-13; the wire value was always 0-100.)
     * @type {number}
     * @memberof Budget
     */
    percent_used: number;
    /**
     * 
     * @type {boolean}
     * @memberof Budget
     */
    within_budget: boolean;
    /**
     * 
     * @type {string}
     * @memberof Budget
     */
    plan_type: string | null;
    /**
     * 
     * @type {string}
     * @memberof Budget
     */
    period_start: string | null;
    /**
     * 
     * @type {string}
     * @memberof Budget
     */
    period_end: string | null;
}
/**
 * 
 * @export
 * @interface BuildContextRequest
 */
export interface BuildContextRequest {
    /**
     * 
     * @type {string}
     * @memberof BuildContextRequest
     */
    query: string;
    /**
     * 
     * @type {number}
     * @memberof BuildContextRequest
     */
    limit?: number;
    /**
     * 
     * @type {boolean}
     * @memberof BuildContextRequest
     */
    include_graph?: boolean;
}
/**
 * 
 * @export
 * @interface BulkDeleteFindings
 */
export interface BulkDeleteFindings {
    /**
     * 
     * @type {Array<string>}
     * @memberof BulkDeleteFindings
     */
    ids: Array<string>;
}
/**
 * 
 * @export
 * @interface BulkUpdateWorkItems
 */
export interface BulkUpdateWorkItems {
    /**
     * 
     * @type {Array<string>}
     * @memberof BulkUpdateWorkItems
     */
    work_item_ids: Array<string>;
    /**
     * 
     * @type {string}
     * @memberof BulkUpdateWorkItems
     */
    state_key?: string;
    /**
     * 
     * @type {string}
     * @memberof BulkUpdateWorkItems
     */
    priority?: BulkUpdateWorkItemsPriorityEnum;
    /**
     * 
     * @type {string}
     * @memberof BulkUpdateWorkItems
     */
    assignee_id?: string | null;
    /**
     * 
     * @type {string}
     * @memberof BulkUpdateWorkItems
     */
    assignee_name?: string | null;
    /**
     * Prefixed resource ID. Wire form: `it_<base58>`.
     * @type {string}
     * @memberof BulkUpdateWorkItems
     */
    iteration_id?: string | null;
    /**
     * 
     * @type {Array<string>}
     * @memberof BulkUpdateWorkItems
     */
    add_label_ids?: Array<string>;
    /**
     * 
     * @type {Array<string>}
     * @memberof BulkUpdateWorkItems
     */
    remove_label_ids?: Array<string>;
}


/**
 * @export
 */
export const BulkUpdateWorkItemsPriorityEnum = {
    none: 'none',
    low: 'low',
    medium: 'medium',
    high: 'high',
    urgent: 'urgent'
} as const;
export type BulkUpdateWorkItemsPriorityEnum = typeof BulkUpdateWorkItemsPriorityEnum[keyof typeof BulkUpdateWorkItemsPriorityEnum];

/**
 * A conversation. Branching: a chat with non-null `parent_chat_id` + `branched_from_message_id` was forked from another chat at a specific message. `external_user_id` is the developer-supplied end-user identifier that scopes chats per-end-user inside a tenant; opaque to the platform. `metadata` is free-form developer JSON, persisted as-is.
 * @export
 * @interface Chat
 */
export interface Chat {
    [key: string]: any | any;
    /**
     * 
     * @type {string}
     * @memberof Chat
     */
    id: string;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof Chat
     */
    title: AccountMembershipOrganizationBillingEmail;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof Chat
     */
    page_id: AccountMembershipOrganizationBillingEmail;
    /**
     * 
     * @type {number}
     * @memberof Chat
     */
    findings_count: number;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof Chat
     */
    parent_chat_id: AccountMembershipOrganizationBillingEmail;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof Chat
     */
    branched_from_message_id: AccountMembershipOrganizationBillingEmail;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof Chat
     */
    branch_name: AccountMembershipOrganizationBillingEmail;
    /**
     * 
     * @type {boolean}
     * @memberof Chat
     */
    starred: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof Chat
     */
    ephemeral: boolean;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof Chat
     */
    external_user_id: AccountMembershipOrganizationBillingEmail;
    /**
     * 
     * @type {object}
     * @memberof Chat
     */
    metadata: object;
    /**
     * 
     * @type {string}
     * @memberof Chat
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Chat
     */
    updated_at: string;
}
/**
 * 
 * @export
 * @interface ChatCompletionsRequest
 */
export interface ChatCompletionsRequest {
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsRequest
     */
    model: string;
    /**
     * 
     * @type {Array<ChatCompletionsRequestMessagesInner>}
     * @memberof ChatCompletionsRequest
     */
    messages: Array<ChatCompletionsRequestMessagesInner>;
    /**
     * 
     * @type {boolean}
     * @memberof ChatCompletionsRequest
     */
    stream?: boolean;
    /**
     * 
     * @type {number}
     * @memberof ChatCompletionsRequest
     */
    temperature?: number;
    /**
     * 
     * @type {number}
     * @memberof ChatCompletionsRequest
     */
    max_tokens?: number;
    /**
     * 
     * @type {number}
     * @memberof ChatCompletionsRequest
     */
    top_p?: number;
    /**
     * 
     * @type {Array<ChatCompletionsRequestToolsInner>}
     * @memberof ChatCompletionsRequest
     */
    tools?: Array<ChatCompletionsRequestToolsInner>;
    /**
     * 
     * @type {ChatCompletionsRequestToolChoice}
     * @memberof ChatCompletionsRequest
     */
    tool_choice?: ChatCompletionsRequestToolChoice;
    /**
     * 
     * @type {{ [key: string]: string; }}
     * @memberof ChatCompletionsRequest
     */
    metadata?: { [key: string]: string; };
}
/**
 * 
 * @export
 * @interface ChatCompletionsRequestMessagesInner
 */
export interface ChatCompletionsRequestMessagesInner {
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsRequestMessagesInner
     */
    role: ChatCompletionsRequestMessagesInnerRoleEnum;
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsRequestMessagesInner
     */
    content: string;
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsRequestMessagesInner
     */
    name?: string;
    /**
     * 
     * @type {Array<ChatCompletionsRequestMessagesInnerAnyOf2ToolCallsInner>}
     * @memberof ChatCompletionsRequestMessagesInner
     */
    tool_calls?: Array<ChatCompletionsRequestMessagesInnerAnyOf2ToolCallsInner>;
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsRequestMessagesInner
     */
    tool_call_id: string;
}


/**
 * @export
 */
export const ChatCompletionsRequestMessagesInnerRoleEnum = {
    tool: 'tool'
} as const;
export type ChatCompletionsRequestMessagesInnerRoleEnum = typeof ChatCompletionsRequestMessagesInnerRoleEnum[keyof typeof ChatCompletionsRequestMessagesInnerRoleEnum];

/**
 * 
 * @export
 * @interface ChatCompletionsRequestMessagesInnerAnyOf
 */
export interface ChatCompletionsRequestMessagesInnerAnyOf {
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsRequestMessagesInnerAnyOf
     */
    role: ChatCompletionsRequestMessagesInnerAnyOfRoleEnum;
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsRequestMessagesInnerAnyOf
     */
    content: string;
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsRequestMessagesInnerAnyOf
     */
    name?: string;
}


/**
 * @export
 */
export const ChatCompletionsRequestMessagesInnerAnyOfRoleEnum = {
    system: 'system'
} as const;
export type ChatCompletionsRequestMessagesInnerAnyOfRoleEnum = typeof ChatCompletionsRequestMessagesInnerAnyOfRoleEnum[keyof typeof ChatCompletionsRequestMessagesInnerAnyOfRoleEnum];

/**
 * 
 * @export
 * @interface ChatCompletionsRequestMessagesInnerAnyOf1
 */
export interface ChatCompletionsRequestMessagesInnerAnyOf1 {
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsRequestMessagesInnerAnyOf1
     */
    role: ChatCompletionsRequestMessagesInnerAnyOf1RoleEnum;
    /**
     * 
     * @type {ChatCompletionsRequestMessagesInnerAnyOf1Content}
     * @memberof ChatCompletionsRequestMessagesInnerAnyOf1
     */
    content: ChatCompletionsRequestMessagesInnerAnyOf1Content;
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsRequestMessagesInnerAnyOf1
     */
    name?: string;
}


/**
 * @export
 */
export const ChatCompletionsRequestMessagesInnerAnyOf1RoleEnum = {
    user: 'user'
} as const;
export type ChatCompletionsRequestMessagesInnerAnyOf1RoleEnum = typeof ChatCompletionsRequestMessagesInnerAnyOf1RoleEnum[keyof typeof ChatCompletionsRequestMessagesInnerAnyOf1RoleEnum];

/**
 * 
 * @export
 * @interface ChatCompletionsRequestMessagesInnerAnyOf1Content
 */
export interface ChatCompletionsRequestMessagesInnerAnyOf1Content {
}
/**
 * 
 * @export
 * @interface ChatCompletionsRequestMessagesInnerAnyOf1ContentAnyOfInner
 */
export interface ChatCompletionsRequestMessagesInnerAnyOf1ContentAnyOfInner {
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsRequestMessagesInnerAnyOf1ContentAnyOfInner
     */
    type: ChatCompletionsRequestMessagesInnerAnyOf1ContentAnyOfInnerTypeEnum;
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsRequestMessagesInnerAnyOf1ContentAnyOfInner
     */
    text: string;
}


/**
 * @export
 */
export const ChatCompletionsRequestMessagesInnerAnyOf1ContentAnyOfInnerTypeEnum = {
    text: 'text'
} as const;
export type ChatCompletionsRequestMessagesInnerAnyOf1ContentAnyOfInnerTypeEnum = typeof ChatCompletionsRequestMessagesInnerAnyOf1ContentAnyOfInnerTypeEnum[keyof typeof ChatCompletionsRequestMessagesInnerAnyOf1ContentAnyOfInnerTypeEnum];

/**
 * 
 * @export
 * @interface ChatCompletionsRequestMessagesInnerAnyOf2
 */
export interface ChatCompletionsRequestMessagesInnerAnyOf2 {
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsRequestMessagesInnerAnyOf2
     */
    role: ChatCompletionsRequestMessagesInnerAnyOf2RoleEnum;
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsRequestMessagesInnerAnyOf2
     */
    content?: string | null;
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsRequestMessagesInnerAnyOf2
     */
    name?: string;
    /**
     * 
     * @type {Array<ChatCompletionsRequestMessagesInnerAnyOf2ToolCallsInner>}
     * @memberof ChatCompletionsRequestMessagesInnerAnyOf2
     */
    tool_calls?: Array<ChatCompletionsRequestMessagesInnerAnyOf2ToolCallsInner>;
}


/**
 * @export
 */
export const ChatCompletionsRequestMessagesInnerAnyOf2RoleEnum = {
    assistant: 'assistant'
} as const;
export type ChatCompletionsRequestMessagesInnerAnyOf2RoleEnum = typeof ChatCompletionsRequestMessagesInnerAnyOf2RoleEnum[keyof typeof ChatCompletionsRequestMessagesInnerAnyOf2RoleEnum];

/**
 * 
 * @export
 * @interface ChatCompletionsRequestMessagesInnerAnyOf2ToolCallsInner
 */
export interface ChatCompletionsRequestMessagesInnerAnyOf2ToolCallsInner {
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsRequestMessagesInnerAnyOf2ToolCallsInner
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsRequestMessagesInnerAnyOf2ToolCallsInner
     */
    type: ChatCompletionsRequestMessagesInnerAnyOf2ToolCallsInnerTypeEnum;
    /**
     * 
     * @type {ChatCompletionsRequestMessagesInnerAnyOf2ToolCallsInnerFunction}
     * @memberof ChatCompletionsRequestMessagesInnerAnyOf2ToolCallsInner
     */
    _function: ChatCompletionsRequestMessagesInnerAnyOf2ToolCallsInnerFunction;
}


/**
 * @export
 */
export const ChatCompletionsRequestMessagesInnerAnyOf2ToolCallsInnerTypeEnum = {
    function: 'function'
} as const;
export type ChatCompletionsRequestMessagesInnerAnyOf2ToolCallsInnerTypeEnum = typeof ChatCompletionsRequestMessagesInnerAnyOf2ToolCallsInnerTypeEnum[keyof typeof ChatCompletionsRequestMessagesInnerAnyOf2ToolCallsInnerTypeEnum];

/**
 * 
 * @export
 * @interface ChatCompletionsRequestMessagesInnerAnyOf2ToolCallsInnerFunction
 */
export interface ChatCompletionsRequestMessagesInnerAnyOf2ToolCallsInnerFunction {
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsRequestMessagesInnerAnyOf2ToolCallsInnerFunction
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsRequestMessagesInnerAnyOf2ToolCallsInnerFunction
     */
    arguments: string;
}
/**
 * 
 * @export
 * @interface ChatCompletionsRequestMessagesInnerAnyOf3
 */
export interface ChatCompletionsRequestMessagesInnerAnyOf3 {
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsRequestMessagesInnerAnyOf3
     */
    role: ChatCompletionsRequestMessagesInnerAnyOf3RoleEnum;
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsRequestMessagesInnerAnyOf3
     */
    content: string;
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsRequestMessagesInnerAnyOf3
     */
    tool_call_id: string;
}


/**
 * @export
 */
export const ChatCompletionsRequestMessagesInnerAnyOf3RoleEnum = {
    tool: 'tool'
} as const;
export type ChatCompletionsRequestMessagesInnerAnyOf3RoleEnum = typeof ChatCompletionsRequestMessagesInnerAnyOf3RoleEnum[keyof typeof ChatCompletionsRequestMessagesInnerAnyOf3RoleEnum];

/**
 * 
 * @export
 * @interface ChatCompletionsRequestToolChoice
 */
export interface ChatCompletionsRequestToolChoice {
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsRequestToolChoice
     */
    type: ChatCompletionsRequestToolChoiceTypeEnum;
    /**
     * 
     * @type {ChatCompletionsRequestToolChoiceAnyOfFunction}
     * @memberof ChatCompletionsRequestToolChoice
     */
    _function: ChatCompletionsRequestToolChoiceAnyOfFunction;
}


/**
 * @export
 */
export const ChatCompletionsRequestToolChoiceTypeEnum = {
    function: 'function'
} as const;
export type ChatCompletionsRequestToolChoiceTypeEnum = typeof ChatCompletionsRequestToolChoiceTypeEnum[keyof typeof ChatCompletionsRequestToolChoiceTypeEnum];

/**
 * 
 * @export
 * @interface ChatCompletionsRequestToolChoiceAnyOf
 */
export interface ChatCompletionsRequestToolChoiceAnyOf {
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsRequestToolChoiceAnyOf
     */
    type: ChatCompletionsRequestToolChoiceAnyOfTypeEnum;
    /**
     * 
     * @type {ChatCompletionsRequestToolChoiceAnyOfFunction}
     * @memberof ChatCompletionsRequestToolChoiceAnyOf
     */
    _function: ChatCompletionsRequestToolChoiceAnyOfFunction;
}


/**
 * @export
 */
export const ChatCompletionsRequestToolChoiceAnyOfTypeEnum = {
    function: 'function'
} as const;
export type ChatCompletionsRequestToolChoiceAnyOfTypeEnum = typeof ChatCompletionsRequestToolChoiceAnyOfTypeEnum[keyof typeof ChatCompletionsRequestToolChoiceAnyOfTypeEnum];

/**
 * 
 * @export
 * @interface ChatCompletionsRequestToolChoiceAnyOfFunction
 */
export interface ChatCompletionsRequestToolChoiceAnyOfFunction {
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsRequestToolChoiceAnyOfFunction
     */
    name: string;
}
/**
 * 
 * @export
 * @interface ChatCompletionsRequestToolsInner
 */
export interface ChatCompletionsRequestToolsInner {
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsRequestToolsInner
     */
    type: ChatCompletionsRequestToolsInnerTypeEnum;
    /**
     * 
     * @type {ChatCompletionsRequestToolsInnerFunction}
     * @memberof ChatCompletionsRequestToolsInner
     */
    _function: ChatCompletionsRequestToolsInnerFunction;
}


/**
 * @export
 */
export const ChatCompletionsRequestToolsInnerTypeEnum = {
    function: 'function'
} as const;
export type ChatCompletionsRequestToolsInnerTypeEnum = typeof ChatCompletionsRequestToolsInnerTypeEnum[keyof typeof ChatCompletionsRequestToolsInnerTypeEnum];

/**
 * 
 * @export
 * @interface ChatCompletionsRequestToolsInnerFunction
 */
export interface ChatCompletionsRequestToolsInnerFunction {
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsRequestToolsInnerFunction
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsRequestToolsInnerFunction
     */
    description?: string;
    /**
     * 
     * @type {object}
     * @memberof ChatCompletionsRequestToolsInnerFunction
     */
    parameters?: object;
}
/**
 * OpenAI Chat Completions byte-compat response. The adapter translates internal LLM types to OpenAI shape on every call — `id` is `chatcmpl-*`, `created` is unix seconds, `usage` uses `prompt_tokens` / `completion_tokens` / `total_tokens`.
 * @export
 * @interface ChatCompletionsResponse
 */
export interface ChatCompletionsResponse {
    [key: string]: any | any;
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsResponse
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsResponse
     */
    object: string;
    /**
     * 
     * @type {number}
     * @memberof ChatCompletionsResponse
     */
    created: number;
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsResponse
     */
    model: string;
    /**
     * 
     * @type {Array<ChatCompletionsResponseChoicesInner>}
     * @memberof ChatCompletionsResponse
     */
    choices: Array<ChatCompletionsResponseChoicesInner>;
    /**
     * 
     * @type {ChatCompletionsResponseUsage}
     * @memberof ChatCompletionsResponse
     */
    usage: ChatCompletionsResponseUsage;
}
/**
 * 
 * @export
 * @interface ChatCompletionsResponseChoicesInner
 */
export interface ChatCompletionsResponseChoicesInner {
    /**
     * 
     * @type {number}
     * @memberof ChatCompletionsResponseChoicesInner
     */
    index: number;
    /**
     * 
     * @type {ChatCompletionsResponseChoicesInnerMessage}
     * @memberof ChatCompletionsResponseChoicesInner
     */
    message: ChatCompletionsResponseChoicesInnerMessage;
    /**
     * 
     * @type {ChatCompletionsResponseChoicesInnerFinishReason}
     * @memberof ChatCompletionsResponseChoicesInner
     */
    finish_reason: ChatCompletionsResponseChoicesInnerFinishReason;
}
/**
 * 
 * @export
 * @interface ChatCompletionsResponseChoicesInnerFinishReason
 */
export interface ChatCompletionsResponseChoicesInnerFinishReason {
}
/**
 * 
 * @export
 * @interface ChatCompletionsResponseChoicesInnerMessage
 */
export interface ChatCompletionsResponseChoicesInnerMessage {
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsResponseChoicesInnerMessage
     */
    role: string;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof ChatCompletionsResponseChoicesInnerMessage
     */
    content: AccountMembershipOrganizationBillingEmail;
    /**
     * 
     * @type {Array<ChatCompletionsResponseChoicesInnerMessageToolCallsInner>}
     * @memberof ChatCompletionsResponseChoicesInnerMessage
     */
    tool_calls?: Array<ChatCompletionsResponseChoicesInnerMessageToolCallsInner>;
}
/**
 * 
 * @export
 * @interface ChatCompletionsResponseChoicesInnerMessageToolCallsInner
 */
export interface ChatCompletionsResponseChoicesInnerMessageToolCallsInner {
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsResponseChoicesInnerMessageToolCallsInner
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsResponseChoicesInnerMessageToolCallsInner
     */
    type: ChatCompletionsResponseChoicesInnerMessageToolCallsInnerTypeEnum;
    /**
     * 
     * @type {ChatCompletionsResponseChoicesInnerMessageToolCallsInnerFunction}
     * @memberof ChatCompletionsResponseChoicesInnerMessageToolCallsInner
     */
    _function: ChatCompletionsResponseChoicesInnerMessageToolCallsInnerFunction;
}


/**
 * @export
 */
export const ChatCompletionsResponseChoicesInnerMessageToolCallsInnerTypeEnum = {
    function: 'function'
} as const;
export type ChatCompletionsResponseChoicesInnerMessageToolCallsInnerTypeEnum = typeof ChatCompletionsResponseChoicesInnerMessageToolCallsInnerTypeEnum[keyof typeof ChatCompletionsResponseChoicesInnerMessageToolCallsInnerTypeEnum];

/**
 * 
 * @export
 * @interface ChatCompletionsResponseChoicesInnerMessageToolCallsInnerFunction
 */
export interface ChatCompletionsResponseChoicesInnerMessageToolCallsInnerFunction {
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsResponseChoicesInnerMessageToolCallsInnerFunction
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof ChatCompletionsResponseChoicesInnerMessageToolCallsInnerFunction
     */
    arguments: string;
}
/**
 * 
 * @export
 * @interface ChatCompletionsResponseUsage
 */
export interface ChatCompletionsResponseUsage {
    /**
     * 
     * @type {number}
     * @memberof ChatCompletionsResponseUsage
     */
    prompt_tokens: number;
    /**
     * 
     * @type {number}
     * @memberof ChatCompletionsResponseUsage
     */
    completion_tokens: number;
    /**
     * 
     * @type {number}
     * @memberof ChatCompletionsResponseUsage
     */
    total_tokens: number;
}
/**
 * 
 * @export
 * @interface ChatDeleteAck
 */
export interface ChatDeleteAck {
    /**
     * 
     * @type {boolean}
     * @memberof ChatDeleteAck
     */
    deleted: boolean;
}
/**
 * 
 * @export
 * @interface ChatList
 */
export interface ChatList {
    /**
     * 
     * @type {Array<Chat>}
     * @memberof ChatList
     */
    data: Array<Chat>;
    /**
     * 
     * @type {boolean}
     * @memberof ChatList
     */
    has_more: boolean;
    /**
     * 
     * @type {string}
     * @memberof ChatList
     */
    next_page_url: string | null;
    /**
     * 
     * @type {string}
     * @memberof ChatList
     */
    previous_page_url: string | null;
}
/**
 * One turn in a chat. `content` is null for tool-call-only turns (no text body).
 * @export
 * @interface ChatMessage
 */
export interface ChatMessage {
    /**
     * 
     * @type {string}
     * @memberof ChatMessage
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof ChatMessage
     */
    chat_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof ChatMessage
     */
    role: ChatMessageRoleEnum;
    /**
     * 
     * @type {string}
     * @memberof ChatMessage
     */
    content: string | null;
    /**
     * 
     * @type {string}
     * @memberof ChatMessage
     */
    created_at: string;
}


/**
 * @export
 */
export const ChatMessageRoleEnum = {
    user: 'user',
    assistant: 'assistant',
    system: 'system'
} as const;
export type ChatMessageRoleEnum = typeof ChatMessageRoleEnum[keyof typeof ChatMessageRoleEnum];

/**
 * One catalog entry. `kind: alias` rows map to a real provider model via `alias_for`; `kind: raw` rows are the underlying provider models. `price_version` is bumped (and committed in source) whenever rates change.
 * @export
 * @interface ChatModelCatalogEntry
 */
export interface ChatModelCatalogEntry {
    /**
     * 
     * @type {string}
     * @memberof ChatModelCatalogEntry
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof ChatModelCatalogEntry
     */
    object: ChatModelCatalogEntryObjectEnum;
    /**
     * 
     * @type {string}
     * @memberof ChatModelCatalogEntry
     */
    kind: ChatModelCatalogEntryKindEnum;
    /**
     * 
     * @type {string}
     * @memberof ChatModelCatalogEntry
     */
    alias_for: string | null;
    /**
     * 
     * @type {string}
     * @memberof ChatModelCatalogEntry
     */
    display_name: string;
    /**
     * 
     * @type {string}
     * @memberof ChatModelCatalogEntry
     */
    provider: string;
    /**
     * 
     * @type {number}
     * @memberof ChatModelCatalogEntry
     */
    context_window: number;
    /**
     * 
     * @type {ChatModelRates}
     * @memberof ChatModelCatalogEntry
     */
    rates: ChatModelRates;
    /**
     * 
     * @type {Array<string>}
     * @memberof ChatModelCatalogEntry
     */
    features: Array<string>;
    /**
     * 
     * @type {string}
     * @memberof ChatModelCatalogEntry
     */
    billing_mode: ChatModelCatalogEntryBillingModeEnum;
    /**
     * 
     * @type {string}
     * @memberof ChatModelCatalogEntry
     */
    price_version: string;
}


/**
 * @export
 */
export const ChatModelCatalogEntryObjectEnum = {
    model: 'model'
} as const;
export type ChatModelCatalogEntryObjectEnum = typeof ChatModelCatalogEntryObjectEnum[keyof typeof ChatModelCatalogEntryObjectEnum];

/**
 * @export
 */
export const ChatModelCatalogEntryKindEnum = {
    raw: 'raw',
    alias: 'alias'
} as const;
export type ChatModelCatalogEntryKindEnum = typeof ChatModelCatalogEntryKindEnum[keyof typeof ChatModelCatalogEntryKindEnum];

/**
 * @export
 */
export const ChatModelCatalogEntryBillingModeEnum = {
    per_token: 'per_token'
} as const;
export type ChatModelCatalogEntryBillingModeEnum = typeof ChatModelCatalogEntryBillingModeEnum[keyof typeof ChatModelCatalogEntryBillingModeEnum];

/**
 * Catalog response envelope. The catalog is unpaginated — it fits in one response and changes only on rate updates.
 * @export
 * @interface ChatModelCatalogResponse
 */
export interface ChatModelCatalogResponse {
    /**
     * 
     * @type {string}
     * @memberof ChatModelCatalogResponse
     */
    object: ChatModelCatalogResponseObjectEnum;
    /**
     * 
     * @type {Array<ChatModelCatalogEntry>}
     * @memberof ChatModelCatalogResponse
     */
    data: Array<ChatModelCatalogEntry>;
}


/**
 * @export
 */
export const ChatModelCatalogResponseObjectEnum = {
    list: 'list'
} as const;
export type ChatModelCatalogResponseObjectEnum = typeof ChatModelCatalogResponseObjectEnum[keyof typeof ChatModelCatalogResponseObjectEnum];

/**
 * Per-model rate envelope. `currency: usd_micros` is fixed for v1 (1 USD = 1,000,000 micros). `cached_input_per_million_tokens` is null when the provider bills cache reads at the standard input rate.
 * @export
 * @interface ChatModelRates
 */
export interface ChatModelRates {
    /**
     * 
     * @type {number}
     * @memberof ChatModelRates
     */
    input_per_million_tokens: number;
    /**
     * 
     * @type {number}
     * @memberof ChatModelRates
     */
    output_per_million_tokens: number;
    /**
     * 
     * @type {number}
     * @memberof ChatModelRates
     */
    cached_input_per_million_tokens: number | null;
    /**
     * 
     * @type {string}
     * @memberof ChatModelRates
     */
    currency: ChatModelRatesCurrencyEnum;
}


/**
 * @export
 */
export const ChatModelRatesCurrencyEnum = {
    usd_micros: 'usd_micros'
} as const;
export type ChatModelRatesCurrencyEnum = typeof ChatModelRatesCurrencyEnum[keyof typeof ChatModelRatesCurrencyEnum];

/**
 * A single model invocation against a persisted chat. The response replaces the consumer-app `/v1/chat/completion` and `/v1/chat/stream` endpoints for the public surface — model invocation here is durable, billed via reserve/commit/release (see chat-surface-design.md § 8), and idempotent on the write side via `Idempotency-Key` (§ 9). The streaming bytes are NOT replayed from the idempotency cache; reconnecting clients call `GET /v1/chats/{id}/responses/{response_id}` to fetch the completed result.
 * @export
 * @interface ChatResponse
 */
export interface ChatResponse {
    /**
     * Prefixed resource ID. Wire form: `cresp_<base58>`.
     * @type {string}
     * @memberof ChatResponse
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof ChatResponse
     */
    object: ChatResponseObjectEnum;
    /**
     * Prefixed resource ID. Wire form: `chat_<base58>`.
     * @type {string}
     * @memberof ChatResponse
     */
    chat_id: string;
    /**
     * 
     * @type {string}
     * @memberof ChatResponse
     */
    status: ChatResponseStatusEnum;
    /**
     * 
     * @type {string}
     * @memberof ChatResponse
     */
    model: string;
    /**
     * 
     * @type {Array<ChatResponseContentBlock>}
     * @memberof ChatResponse
     */
    output: Array<ChatResponseContentBlock> | null;
    /**
     * 
     * @type {ChatResponseUsage}
     * @memberof ChatResponse
     */
    usage: ChatResponseUsage | null;
    /**
     * 
     * @type {string}
     * @memberof ChatResponse
     */
    error_code: string | null;
    /**
     * 
     * @type {string}
     * @memberof ChatResponse
     */
    error_message: string | null;
    /**
     * Prefixed resource ID. Wire form: `msg_<base58>`.
     * @type {string}
     * @memberof ChatResponse
     */
    assistant_message_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof ChatResponse
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof ChatResponse
     */
    updated_at: string;
    /**
     * 
     * @type {string}
     * @memberof ChatResponse
     */
    completed_at: string | null;
}


/**
 * @export
 */
export const ChatResponseObjectEnum = {
    chat_response: 'chat.response'
} as const;
export type ChatResponseObjectEnum = typeof ChatResponseObjectEnum[keyof typeof ChatResponseObjectEnum];

/**
 * @export
 */
export const ChatResponseStatusEnum = {
    pending: 'pending',
    streaming: 'streaming',
    completed: 'completed',
    failed: 'failed',
    aborted: 'aborted'
} as const;
export type ChatResponseStatusEnum = typeof ChatResponseStatusEnum[keyof typeof ChatResponseStatusEnum];

/**
 * 
 * @export
 * @interface ChatResponseContentBlock
 */
export interface ChatResponseContentBlock {
    /**
     * 
     * @type {string}
     * @memberof ChatResponseContentBlock
     */
    type: string;
    /**
     * 
     * @type {string}
     * @memberof ChatResponseContentBlock
     */
    text: string;
    /**
     * 
     * @type {string}
     * @memberof ChatResponseContentBlock
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof ChatResponseContentBlock
     */
    name: string;
    /**
     * 
     * @type {object}
     * @memberof ChatResponseContentBlock
     */
    input: object;
}
/**
 * 
 * @export
 * @interface ChatResponseTextBlock
 */
export interface ChatResponseTextBlock {
    /**
     * 
     * @type {string}
     * @memberof ChatResponseTextBlock
     */
    type: ChatResponseTextBlockTypeEnum;
    /**
     * 
     * @type {string}
     * @memberof ChatResponseTextBlock
     */
    text: string;
}


/**
 * @export
 */
export const ChatResponseTextBlockTypeEnum = {
    text: 'text'
} as const;
export type ChatResponseTextBlockTypeEnum = typeof ChatResponseTextBlockTypeEnum[keyof typeof ChatResponseTextBlockTypeEnum];

/**
 * 
 * @export
 * @interface ChatResponseToolUseBlock
 */
export interface ChatResponseToolUseBlock {
    [key: string]: any | any;
    /**
     * 
     * @type {string}
     * @memberof ChatResponseToolUseBlock
     */
    type: string;
    /**
     * 
     * @type {string}
     * @memberof ChatResponseToolUseBlock
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof ChatResponseToolUseBlock
     */
    name: string;
    /**
     * 
     * @type {object}
     * @memberof ChatResponseToolUseBlock
     */
    input: object;
}
/**
 * 
 * @export
 * @interface ChatResponseUsage
 */
export interface ChatResponseUsage {
    /**
     * 
     * @type {number}
     * @memberof ChatResponseUsage
     */
    input_tokens: number;
    /**
     * 
     * @type {number}
     * @memberof ChatResponseUsage
     */
    output_tokens: number;
}
/**
 * 
 * @export
 * @interface ChatWithMessages
 */
export interface ChatWithMessages {
    /**
     * 
     * @type {Chat}
     * @memberof ChatWithMessages
     */
    chat: Chat;
    /**
     * 
     * @type {Array<ChatMessage>}
     * @memberof ChatWithMessages
     */
    messages: Array<ChatMessage>;
}
/**
 * 
 * @export
 * @interface CheckPermission
 */
export interface CheckPermission {
    /**
     * 
     * @type {string}
     * @memberof CheckPermission
     */
    action: string;
    /**
     * 
     * @type {string}
     * @memberof CheckPermission
     */
    resource: string;
}
/**
 * Free-form human-authored prose attached to a work item. Distinct from `Activity` (the structured event log) — see docs/public-api/DESIGN.md § 4.2.
 * @export
 * @interface Comment
 */
export interface Comment {
    /**
     * Prefixed resource ID. Wire form: `cmt_<base58>`.
     * @type {string}
     * @memberof Comment
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof Comment
     */
    content: string;
    /**
     * Prefixed resource ID. Wire form: `wi_<base58>`.
     * @type {string}
     * @memberof Comment
     */
    work_item_id: string;
    /**
     * Prefixed resource ID. Wire form: `acc_<base58>`.
     * @type {string}
     * @memberof Comment
     */
    author_id: string;
    /**
     * 
     * @type {Array<string>}
     * @memberof Comment
     */
    mentions: Array<string>;
    /**
     * 
     * @type {string}
     * @memberof Comment
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Comment
     */
    updated_at: string;
}
/**
 * Minimal author projection joined onto each comment in the `/work_items/{workItemId}/comments` view. Excludes `full_name`, `avatar_url`, etc. — the comment renderer only needs id + email today.
 * @export
 * @interface CommentAuthorPayload
 */
export interface CommentAuthorPayload {
    /**
     * Prefixed resource ID. Wire form: `acc_<base58>`.
     * @type {string}
     * @memberof CommentAuthorPayload
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof CommentAuthorPayload
     */
    email: string;
}
/**
 * 
 * @export
 * @interface CommentByWorkItemListEnvelope
 */
export interface CommentByWorkItemListEnvelope {
    /**
     * 
     * @type {Array<CommentWithAuthor>}
     * @memberof CommentByWorkItemListEnvelope
     */
    data: Array<CommentWithAuthor>;
}
/**
 * 
 * @export
 * @interface CommentEnvelope
 */
export interface CommentEnvelope {
    /**
     * 
     * @type {Comment}
     * @memberof CommentEnvelope
     */
    comment: Comment;
}
/**
 * Stripe v2 cursor-paginated envelope. Use the `next_page_url` and `previous_page_url` URL-form tokens to walk pages — see docs/platform/stripe-v2-adoption.md.
 * @export
 * @interface CommentListEnvelope
 */
export interface CommentListEnvelope {
    /**
     * 
     * @type {Array<Comment>}
     * @memberof CommentListEnvelope
     */
    data: Array<Comment>;
    /**
     * 
     * @type {boolean}
     * @memberof CommentListEnvelope
     */
    has_more: boolean;
    /**
     * 
     * @type {string}
     * @memberof CommentListEnvelope
     */
    next_page_url: string | null;
    /**
     * 
     * @type {string}
     * @memberof CommentListEnvelope
     */
    previous_page_url: string | null;
}
/**
 * 
 * @export
 * @interface CommentWithAuthor
 */
export interface CommentWithAuthor {
    /**
     * 
     * @type {Comment}
     * @memberof CommentWithAuthor
     */
    comment: Comment;
    /**
     * 
     * @type {CommentAuthorPayload}
     * @memberof CommentWithAuthor
     */
    author: CommentAuthorPayload;
}
/**
 * 
 * @export
 * @interface CompleteIteration
 */
export interface CompleteIteration {
    /**
     * Prefixed resource ID. Wire form: `it_<base58>`.
     * @type {string}
     * @memberof CompleteIteration
     */
    move_unfinished_to?: string;
}
/**
 * 
 * @export
 * @interface CreateAccount
 */
export interface CreateAccount {
    /**
     * 
     * @type {string}
     * @memberof CreateAccount
     */
    email: string;
    /**
     * 
     * @type {string}
     * @memberof CreateAccount
     */
    full_name?: string;
    /**
     * 
     * @type {string}
     * @memberof CreateAccount
     */
    avatar_url?: string;
}
/**
 * 
 * @export
 * @interface CreateApiKey
 */
export interface CreateApiKey {
    /**
     * Prefixed resource ID. Wire form: `ws_<base58>`.
     * @type {string}
     * @memberof CreateApiKey
     */
    workspace_id: string;
    /**
     * 
     * @type {string}
     * @memberof CreateApiKey
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof CreateApiKey
     */
    pinned_version?: string;
    /**
     * 
     * @type {number}
     * @memberof CreateApiKey
     */
    expires_in_days?: number;
    /**
     * 
     * @type {{ [key: string]: string; }}
     * @memberof CreateApiKey
     */
    metadata?: { [key: string]: string; };
}
/**
 * @type CreateAttachment
 * 
 * @export
 */
export type CreateAttachment = CreateAttachmentOneOf | CreateAttachmentOneOf1 | CreateAttachmentOneOf2 | CreateAttachmentOneOf3;
/**
 * 
 * @export
 * @interface CreateAttachmentOneOf
 */
export interface CreateAttachmentOneOf {
    /**
     * 
     * @type {string}
     * @memberof CreateAttachmentOneOf
     */
    parent_type: CreateAttachmentOneOfParentTypeEnum;
    /**
     * Prefixed resource ID. Wire form: `wi_<base58>`.
     * @type {string}
     * @memberof CreateAttachmentOneOf
     */
    parent_id: string;
    /**
     * 
     * @type {string}
     * @memberof CreateAttachmentOneOf
     */
    s3_key: string;
    /**
     * 
     * @type {string}
     * @memberof CreateAttachmentOneOf
     */
    file_name: string;
    /**
     * 
     * @type {string}
     * @memberof CreateAttachmentOneOf
     */
    content_type: string;
    /**
     * 
     * @type {number}
     * @memberof CreateAttachmentOneOf
     */
    size_bytes: number;
    /**
     * 
     * @type {string}
     * @memberof CreateAttachmentOneOf
     */
    sha256?: string;
}


/**
 * @export
 */
export const CreateAttachmentOneOfParentTypeEnum = {
    work_item: 'work_item'
} as const;
export type CreateAttachmentOneOfParentTypeEnum = typeof CreateAttachmentOneOfParentTypeEnum[keyof typeof CreateAttachmentOneOfParentTypeEnum];

/**
 * 
 * @export
 * @interface CreateAttachmentOneOf1
 */
export interface CreateAttachmentOneOf1 {
    /**
     * 
     * @type {string}
     * @memberof CreateAttachmentOneOf1
     */
    parent_type: CreateAttachmentOneOf1ParentTypeEnum;
    /**
     * Prefixed resource ID. Wire form: `cmt_<base58>`.
     * @type {string}
     * @memberof CreateAttachmentOneOf1
     */
    parent_id: string;
    /**
     * 
     * @type {string}
     * @memberof CreateAttachmentOneOf1
     */
    s3_key: string;
    /**
     * 
     * @type {string}
     * @memberof CreateAttachmentOneOf1
     */
    file_name: string;
    /**
     * 
     * @type {string}
     * @memberof CreateAttachmentOneOf1
     */
    content_type: string;
    /**
     * 
     * @type {number}
     * @memberof CreateAttachmentOneOf1
     */
    size_bytes: number;
    /**
     * 
     * @type {string}
     * @memberof CreateAttachmentOneOf1
     */
    sha256?: string;
}


/**
 * @export
 */
export const CreateAttachmentOneOf1ParentTypeEnum = {
    comment: 'comment'
} as const;
export type CreateAttachmentOneOf1ParentTypeEnum = typeof CreateAttachmentOneOf1ParentTypeEnum[keyof typeof CreateAttachmentOneOf1ParentTypeEnum];

/**
 * 
 * @export
 * @interface CreateAttachmentOneOf2
 */
export interface CreateAttachmentOneOf2 {
    /**
     * 
     * @type {string}
     * @memberof CreateAttachmentOneOf2
     */
    parent_type: CreateAttachmentOneOf2ParentTypeEnum;
    /**
     * Prefixed resource ID. Wire form: `comm_<base58>`.
     * @type {string}
     * @memberof CreateAttachmentOneOf2
     */
    parent_id: string;
    /**
     * 
     * @type {string}
     * @memberof CreateAttachmentOneOf2
     */
    s3_key: string;
    /**
     * 
     * @type {string}
     * @memberof CreateAttachmentOneOf2
     */
    file_name: string;
    /**
     * 
     * @type {string}
     * @memberof CreateAttachmentOneOf2
     */
    content_type: string;
    /**
     * 
     * @type {number}
     * @memberof CreateAttachmentOneOf2
     */
    size_bytes: number;
    /**
     * 
     * @type {string}
     * @memberof CreateAttachmentOneOf2
     */
    sha256?: string;
}


/**
 * @export
 */
export const CreateAttachmentOneOf2ParentTypeEnum = {
    communication: 'communication'
} as const;
export type CreateAttachmentOneOf2ParentTypeEnum = typeof CreateAttachmentOneOf2ParentTypeEnum[keyof typeof CreateAttachmentOneOf2ParentTypeEnum];

/**
 * 
 * @export
 * @interface CreateAttachmentOneOf3
 */
export interface CreateAttachmentOneOf3 {
    /**
     * 
     * @type {string}
     * @memberof CreateAttachmentOneOf3
     */
    parent_type: CreateAttachmentOneOf3ParentTypeEnum;
    /**
     * Prefixed resource ID. Wire form: `tmsg_<base58>`.
     * @type {string}
     * @memberof CreateAttachmentOneOf3
     */
    parent_id: string;
    /**
     * 
     * @type {string}
     * @memberof CreateAttachmentOneOf3
     */
    s3_key: string;
    /**
     * 
     * @type {string}
     * @memberof CreateAttachmentOneOf3
     */
    file_name: string;
    /**
     * 
     * @type {string}
     * @memberof CreateAttachmentOneOf3
     */
    content_type: string;
    /**
     * 
     * @type {number}
     * @memberof CreateAttachmentOneOf3
     */
    size_bytes: number;
    /**
     * 
     * @type {string}
     * @memberof CreateAttachmentOneOf3
     */
    sha256?: string;
}


/**
 * @export
 */
export const CreateAttachmentOneOf3ParentTypeEnum = {
    team_message: 'team_message'
} as const;
export type CreateAttachmentOneOf3ParentTypeEnum = typeof CreateAttachmentOneOf3ParentTypeEnum[keyof typeof CreateAttachmentOneOf3ParentTypeEnum];

/**
 * 
 * @export
 * @interface CreateAttributeDefinition
 */
export interface CreateAttributeDefinition {
    /**
     * 
     * @type {string}
     * @memberof CreateAttributeDefinition
     */
    key: string;
    /**
     * 
     * @type {string}
     * @memberof CreateAttributeDefinition
     */
    name: string;
    /**
     * 
     * @type {boolean}
     * @memberof CreateAttributeDefinition
     */
    required?: boolean;
    /**
     * 
     * @type {number}
     * @memberof CreateAttributeDefinition
     */
    position?: number;
    /**
     * 
     * @type {CreateAttributeDefinitionAllOfEnrichment}
     * @memberof CreateAttributeDefinition
     */
    enrichment?: CreateAttributeDefinitionAllOfEnrichment;
    /**
     * 
     * @type {string}
     * @memberof CreateAttributeDefinition
     */
    data_type: CreateAttributeDefinitionDataTypeEnum;
    /**
     * 
     * @type {object}
     * @memberof CreateAttributeDefinition
     */
    config: object;
}


/**
 * @export
 */
export const CreateAttributeDefinitionDataTypeEnum = {
    multi_select: 'multi_select'
} as const;
export type CreateAttributeDefinitionDataTypeEnum = typeof CreateAttributeDefinitionDataTypeEnum[keyof typeof CreateAttributeDefinitionDataTypeEnum];

/**
 * 
 * @export
 * @interface CreateAttributeDefinitionAllOfEnrichment
 */
export interface CreateAttributeDefinitionAllOfEnrichment {
    /**
     * 
     * @type {string}
     * @memberof CreateAttributeDefinitionAllOfEnrichment
     */
    prompt: string;
    /**
     * 
     * @type {string}
     * @memberof CreateAttributeDefinitionAllOfEnrichment
     */
    refreshPolicy: CreateAttributeDefinitionAllOfEnrichmentRefreshPolicyEnum;
}


/**
 * @export
 */
export const CreateAttributeDefinitionAllOfEnrichmentRefreshPolicyEnum = {
    manual: 'manual'
} as const;
export type CreateAttributeDefinitionAllOfEnrichmentRefreshPolicyEnum = typeof CreateAttributeDefinitionAllOfEnrichmentRefreshPolicyEnum[keyof typeof CreateAttributeDefinitionAllOfEnrichmentRefreshPolicyEnum];

/**
 * A newly-forked branch chat plus the starter messages copied from the parent up to and including the branch point.
 * @export
 * @interface CreateBranchResponse
 */
export interface CreateBranchResponse {
    /**
     * 
     * @type {string}
     * @memberof CreateBranchResponse
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof CreateBranchResponse
     */
    parent_chat_id: string;
    /**
     * 
     * @type {string}
     * @memberof CreateBranchResponse
     */
    branched_from_message_id: string;
    /**
     * 
     * @type {string}
     * @memberof CreateBranchResponse
     */
    branch_name: string | null;
    /**
     * 
     * @type {string}
     * @memberof CreateBranchResponse
     */
    title: string | null;
    /**
     * 
     * @type {Array<ChatMessage>}
     * @memberof CreateBranchResponse
     */
    messages: Array<ChatMessage>;
}
/**
 * 
 * @export
 * @interface CreateChat
 */
export interface CreateChat {
    /**
     * Prefixed resource ID. Wire form: `org_<base58>`.
     * @type {string}
     * @memberof CreateChat
     */
    organization_id?: string;
    /**
     * Prefixed resource ID. Wire form: `pg_<base58>`.
     * @type {string}
     * @memberof CreateChat
     */
    page_id?: string;
    /**
     * 
     * @type {string}
     * @memberof CreateChat
     */
    title?: string;
    /**
     * 
     * @type {string}
     * @memberof CreateChat
     */
    external_user_id?: string;
    /**
     * 
     * @type {object}
     * @memberof CreateChat
     */
    metadata?: object;
}
/**
 * 
 * @export
 * @interface CreateChatBranch
 */
export interface CreateChatBranch {
    /**
     * Prefixed resource ID. Wire form: `msg_<base58>`.
     * @type {string}
     * @memberof CreateChatBranch
     */
    message_id: string;
    /**
     * 
     * @type {string}
     * @memberof CreateChatBranch
     */
    branch_name?: string;
}
/**
 * 
 * @export
 * @interface CreateChatResponse
 */
export interface CreateChatResponse {
    /**
     * 
     * @type {string}
     * @memberof CreateChatResponse
     */
    input?: string;
    /**
     * 
     * @type {string}
     * @memberof CreateChatResponse
     */
    model?: string;
    /**
     * 
     * @type {boolean}
     * @memberof CreateChatResponse
     */
    stream?: boolean;
    /**
     * Prefixed resource ID. Wire form: `wi_<base58>`.
     * @type {string}
     * @memberof CreateChatResponse
     */
    matter_id?: string;
    /**
     * Prefixed resource ID. Wire form: `cth_<base58>`.
     * @type {string}
     * @memberof CreateChatResponse
     */
    thread_id?: string;
    /**
     * 
     * @type {string}
     * @memberof CreateChatResponse
     */
    system?: string;
    /**
     * 
     * @type {number}
     * @memberof CreateChatResponse
     */
    temperature?: number;
    /**
     * 
     * @type {number}
     * @memberof CreateChatResponse
     */
    max_tokens?: number;
    /**
     * 
     * @type {Array<CreateChatResponseToolsInner>}
     * @memberof CreateChatResponse
     */
    tools?: Array<CreateChatResponseToolsInner>;
    /**
     * 
     * @type {CreateChatResponseToolChoice}
     * @memberof CreateChatResponse
     */
    tool_choice?: CreateChatResponseToolChoice;
}
/**
 * 
 * @export
 * @interface CreateChatResponseToolChoice
 */
export interface CreateChatResponseToolChoice {
    /**
     * 
     * @type {string}
     * @memberof CreateChatResponseToolChoice
     */
    type: CreateChatResponseToolChoiceTypeEnum;
    /**
     * 
     * @type {string}
     * @memberof CreateChatResponseToolChoice
     */
    name: string;
}


/**
 * @export
 */
export const CreateChatResponseToolChoiceTypeEnum = {
    tool: 'tool'
} as const;
export type CreateChatResponseToolChoiceTypeEnum = typeof CreateChatResponseToolChoiceTypeEnum[keyof typeof CreateChatResponseToolChoiceTypeEnum];

/**
 * 
 * @export
 * @interface CreateChatResponseToolChoiceAnyOf
 */
export interface CreateChatResponseToolChoiceAnyOf {
    /**
     * 
     * @type {string}
     * @memberof CreateChatResponseToolChoiceAnyOf
     */
    type: CreateChatResponseToolChoiceAnyOfTypeEnum;
    /**
     * 
     * @type {string}
     * @memberof CreateChatResponseToolChoiceAnyOf
     */
    name: string;
}


/**
 * @export
 */
export const CreateChatResponseToolChoiceAnyOfTypeEnum = {
    tool: 'tool'
} as const;
export type CreateChatResponseToolChoiceAnyOfTypeEnum = typeof CreateChatResponseToolChoiceAnyOfTypeEnum[keyof typeof CreateChatResponseToolChoiceAnyOfTypeEnum];

/**
 * 
 * @export
 * @interface CreateChatResponseToolsInner
 */
export interface CreateChatResponseToolsInner {
    /**
     * 
     * @type {string}
     * @memberof CreateChatResponseToolsInner
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof CreateChatResponseToolsInner
     */
    description: string;
    /**
     * 
     * @type {CreateChatResponseToolsInnerInputSchema}
     * @memberof CreateChatResponseToolsInner
     */
    input_schema: CreateChatResponseToolsInnerInputSchema;
}
/**
 * 
 * @export
 * @interface CreateChatResponseToolsInnerInputSchema
 */
export interface CreateChatResponseToolsInnerInputSchema {
    /**
     * 
     * @type {string}
     * @memberof CreateChatResponseToolsInnerInputSchema
     */
    type: CreateChatResponseToolsInnerInputSchemaTypeEnum;
    /**
     * 
     * @type {object}
     * @memberof CreateChatResponseToolsInnerInputSchema
     */
    properties?: object;
    /**
     * 
     * @type {Array<string>}
     * @memberof CreateChatResponseToolsInnerInputSchema
     */
    required: Array<string>;
}


/**
 * @export
 */
export const CreateChatResponseToolsInnerInputSchemaTypeEnum = {
    object: 'object'
} as const;
export type CreateChatResponseToolsInnerInputSchemaTypeEnum = typeof CreateChatResponseToolsInnerInputSchemaTypeEnum[keyof typeof CreateChatResponseToolsInnerInputSchemaTypeEnum];

/**
 * 
 * @export
 * @interface CreateComment
 */
export interface CreateComment {
    /**
     * 
     * @type {string}
     * @memberof CreateComment
     */
    content: string;
    /**
     * Prefixed resource ID. Wire form: `wi_<base58>`.
     * @type {string}
     * @memberof CreateComment
     */
    work_item_id: string;
    /**
     * 
     * @type {Array<string>}
     * @memberof CreateComment
     */
    mentions?: Array<string>;
}
/**
 * 
 * @export
 * @interface CreateFeatureRequest
 */
export interface CreateFeatureRequest {
    /**
     * 
     * @type {string}
     * @memberof CreateFeatureRequest
     */
    title: string;
    /**
     * 
     * @type {string}
     * @memberof CreateFeatureRequest
     */
    description?: string;
    /**
     * 
     * @type {{ [key: string]: string; }}
     * @memberof CreateFeatureRequest
     */
    metadata?: { [key: string]: string; };
}
/**
 * 
 * @export
 * @interface CreateFeatureRequestComment
 */
export interface CreateFeatureRequestComment {
    /**
     * 
     * @type {string}
     * @memberof CreateFeatureRequestComment
     */
    body: string;
    /**
     * 
     * @type {string}
     * @memberof CreateFeatureRequestComment
     */
    author_name?: string;
}
/**
 * 
 * @export
 * @interface CreateFinding
 */
export interface CreateFinding {
    /**
     * 
     * @type {string}
     * @memberof CreateFinding
     */
    content: string;
    /**
     * 
     * @type {string}
     * @memberof CreateFinding
     */
    title?: string;
    /**
     * 
     * @type {CreateFindingSource}
     * @memberof CreateFinding
     */
    source: CreateFindingSource;
    /**
     * 
     * @type {Array<string>}
     * @memberof CreateFinding
     */
    tags?: Array<string>;
}
/**
 * 
 * @export
 * @interface CreateFindingSet
 */
export interface CreateFindingSet {
    /**
     * 
     * @type {string}
     * @memberof CreateFindingSet
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof CreateFindingSet
     */
    description?: string;
    /**
     * 
     * @type {Array<string>}
     * @memberof CreateFindingSet
     */
    finding_ids: Array<string>;
}
/**
 * 
 * @export
 * @interface CreateFindingSource
 */
export interface CreateFindingSource {
    /**
     * 
     * @type {string}
     * @memberof CreateFindingSource
     */
    type: CreateFindingSourceTypeEnum;
    /**
     * Prefixed resource ID. Wire form: `msg_<base58>`.
     * @type {string}
     * @memberof CreateFindingSource
     */
    message_id?: string;
    /**
     * Prefixed resource ID. Wire form: `chat_<base58>`.
     * @type {string}
     * @memberof CreateFindingSource
     */
    chat_id?: string;
    /**
     * 
     * @type {string}
     * @memberof CreateFindingSource
     */
    timestamp?: string;
    /**
     * 
     * @type {number}
     * @memberof CreateFindingSource
     */
    selection_start?: number;
    /**
     * 
     * @type {number}
     * @memberof CreateFindingSource
     */
    selection_end?: number;
}


/**
 * @export
 */
export const CreateFindingSourceTypeEnum = {
    chat_message: 'chat-message',
    text_selection: 'text-selection'
} as const;
export type CreateFindingSourceTypeEnum = typeof CreateFindingSourceTypeEnum[keyof typeof CreateFindingSourceTypeEnum];

/**
 * 
 * @export
 * @interface CreateFolder
 */
export interface CreateFolder {
    /**
     * 
     * @type {string}
     * @memberof CreateFolder
     */
    name: string;
    /**
     * Prefixed resource ID. Wire form: `fld_<base58>`.
     * @type {string}
     * @memberof CreateFolder
     */
    parent_id?: string;
    /**
     * Prefixed resource ID. Wire form: `wi_<base58>`.
     * @type {string}
     * @memberof CreateFolder
     */
    matter_id?: string;
    /**
     * 
     * @type {object}
     * @memberof CreateFolder
     */
    icon?: object;
    /**
     * 
     * @type {boolean}
     * @memberof CreateFolder
     */
    is_personal?: boolean;
    /**
     * Prefixed resource ID. Wire form: `ws_<base58>`.
     * @type {string}
     * @memberof CreateFolder
     */
    workspace_id?: string;
}
/**
 * 
 * @export
 * @interface CreateGroup
 */
export interface CreateGroup {
    /**
     * 
     * @type {string}
     * @memberof CreateGroup
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof CreateGroup
     */
    description?: string;
}
/**
 * 
 * @export
 * @interface CreateIteration
 */
export interface CreateIteration {
    /**
     * 
     * @type {string}
     * @memberof CreateIteration
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof CreateIteration
     */
    goal?: string;
    /**
     * Prefixed resource ID. Wire form: `ws_<base58>`.
     * @type {string}
     * @memberof CreateIteration
     */
    workspace_id?: string;
    /**
     * 
     * @type {string}
     * @memberof CreateIteration
     */
    start_date?: string;
    /**
     * 
     * @type {string}
     * @memberof CreateIteration
     */
    end_date?: string;
}
/**
 * 
 * @export
 * @interface CreateKgEntity
 */
export interface CreateKgEntity {
    /**
     * 
     * @type {string}
     * @memberof CreateKgEntity
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof CreateKgEntity
     */
    type: CreateKgEntityTypeEnum;
    /**
     * 
     * @type {string}
     * @memberof CreateKgEntity
     */
    description?: string | null;
}


/**
 * @export
 */
export const CreateKgEntityTypeEnum = {
    concept: 'concept',
    person: 'person',
    organization: 'organization',
    location: 'location',
    topic: 'topic',
    technology: 'technology',
    document: 'document',
    event: 'event',
    term: 'term'
} as const;
export type CreateKgEntityTypeEnum = typeof CreateKgEntityTypeEnum[keyof typeof CreateKgEntityTypeEnum];

/**
 * 
 * @export
 * @interface CreateKgRelationship
 */
export interface CreateKgRelationship {
    /**
     * 
     * @type {string}
     * @memberof CreateKgRelationship
     */
    source_entity_id: string;
    /**
     * 
     * @type {string}
     * @memberof CreateKgRelationship
     */
    target_entity_id: string;
    /**
     * 
     * @type {string}
     * @memberof CreateKgRelationship
     */
    type: CreateKgRelationshipTypeEnum;
    /**
     * 
     * @type {number}
     * @memberof CreateKgRelationship
     */
    weight?: number;
}


/**
 * @export
 */
export const CreateKgRelationshipTypeEnum = {
    mentions: 'mentions',
    references: 'references',
    related_to: 'related_to',
    part_of: 'part_of',
    authored_by: 'authored_by',
    located_in: 'located_in',
    depends_on: 'depends_on',
    contradicts: 'contradicts',
    supports: 'supports',
    defines: 'defines',
    example_of: 'example_of',
    caused_by: 'caused_by',
    precedes: 'precedes',
    derived_from: 'derived_from'
} as const;
export type CreateKgRelationshipTypeEnum = typeof CreateKgRelationshipTypeEnum[keyof typeof CreateKgRelationshipTypeEnum];

/**
 * 
 * @export
 * @interface CreateLabel
 */
export interface CreateLabel {
    /**
     * 
     * @type {string}
     * @memberof CreateLabel
     */
    key: string;
    /**
     * 
     * @type {string}
     * @memberof CreateLabel
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof CreateLabel
     */
    color?: string;
    /**
     * 
     * @type {string}
     * @memberof CreateLabel
     */
    description?: string;
}
/**
 * 
 * @export
 * @interface CreateNotificationSubscription
 */
export interface CreateNotificationSubscription {
    /**
     * 
     * @type {string}
     * @memberof CreateNotificationSubscription
     */
    event_type: CreateNotificationSubscriptionEventTypeEnum;
    /**
     * 
     * @type {string}
     * @memberof CreateNotificationSubscription
     */
    scope_type?: CreateNotificationSubscriptionScopeTypeEnum;
    /**
     * 
     * @type {string}
     * @memberof CreateNotificationSubscription
     */
    scope_id?: string;
}


/**
 * @export
 */
export const CreateNotificationSubscriptionEventTypeEnum = {
    work_item_assigned: 'work_item.assigned',
    work_item_state_changed: 'work_item.state_changed',
    work_item_commented: 'work_item.commented',
    work_item_mentioned: 'work_item.mentioned',
    comment_replied: 'comment.replied',
    feature_request_shipped: 'feature_request.shipped',
    feature_request_commented: 'feature_request.commented'
} as const;
export type CreateNotificationSubscriptionEventTypeEnum = typeof CreateNotificationSubscriptionEventTypeEnum[keyof typeof CreateNotificationSubscriptionEventTypeEnum];

/**
 * @export
 */
export const CreateNotificationSubscriptionScopeTypeEnum = {
    work_item: 'work_item',
    comment: 'comment',
    feature_request: 'feature_request'
} as const;
export type CreateNotificationSubscriptionScopeTypeEnum = typeof CreateNotificationSubscriptionScopeTypeEnum[keyof typeof CreateNotificationSubscriptionScopeTypeEnum];

/**
 * `owner_email` present → public signup path (creates or finds the account and makes it the owner). Absent → authed path; the caller's account becomes the owner and the endpoint requires a JWT.
 * @export
 * @interface CreateOrganization
 */
export interface CreateOrganization {
    /**
     * 
     * @type {string}
     * @memberof CreateOrganization
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof CreateOrganization
     */
    billing_email?: string;
    /**
     * 
     * @type {string}
     * @memberof CreateOrganization
     */
    owner_email?: string;
    /**
     * 
     * @type {string}
     * @memberof CreateOrganization
     */
    owner_full_name?: string;
}
/**
 * 
 * @export
 * @interface CreatePage
 */
export interface CreatePage {
    /**
     * 
     * @type {string}
     * @memberof CreatePage
     */
    title?: string;
    /**
     * 
     * @type {string}
     * @memberof CreatePage
     */
    content?: string;
    /**
     * Prefixed resource ID. Wire form: `fld_<base58>`.
     * @type {string}
     * @memberof CreatePage
     */
    folder_id?: string;
    /**
     * Prefixed resource ID. Wire form: `wi_<base58>`.
     * @type {string}
     * @memberof CreatePage
     */
    matter_id?: string;
    /**
     * 
     * @type {object}
     * @memberof CreatePage
     */
    icon?: object;
    /**
     * 
     * @type {object}
     * @memberof CreatePage
     */
    cover?: object;
    /**
     * 
     * @type {boolean}
     * @memberof CreatePage
     */
    is_personal?: boolean;
    /**
     * Prefixed resource ID. Wire form: `ws_<base58>`.
     * @type {string}
     * @memberof CreatePage
     */
    workspace_id?: string;
}
/**
 * 
 * @export
 * @interface CreatePolicy
 */
export interface CreatePolicy {
    /**
     * 
     * @type {string}
     * @memberof CreatePolicy
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof CreatePolicy
     */
    description?: string;
    /**
     * 
     * @type {string}
     * @memberof CreatePolicy
     */
    display_name?: string;
    /**
     * 
     * @type {string}
     * @memberof CreatePolicy
     */
    category?: string;
    /**
     * 
     * @type {string}
     * @memberof CreatePolicy
     */
    effect: string;
    /**
     * 
     * @type {Array<string>}
     * @memberof CreatePolicy
     */
    actions: Array<string>;
    /**
     * 
     * @type {Array<string>}
     * @memberof CreatePolicy
     */
    resources: Array<string>;
    /**
     * 
     * @type {object}
     * @memberof CreatePolicy
     */
    conditions?: object;
    /**
     * 
     * @type {string}
     * @memberof CreatePolicy
     */
    seed_role?: string;
}
/**
 * 
 * @export
 * @interface CreateRelation
 */
export interface CreateRelation {
    /**
     * Prefixed resource ID. Wire form: `wi_<base58>`.
     * @type {string}
     * @memberof CreateRelation
     */
    source_work_item_id: string;
    /**
     * Prefixed resource ID. Wire form: `wi_<base58>`.
     * @type {string}
     * @memberof CreateRelation
     */
    target_work_item_id: string;
    /**
     * 
     * @type {string}
     * @memberof CreateRelation
     */
    relation_type: CreateRelationRelationTypeEnum;
}


/**
 * @export
 */
export const CreateRelationRelationTypeEnum = {
    blocks: 'blocks',
    blocked_by: 'blocked_by',
    duplicates: 'duplicates',
    duplicated_by: 'duplicated_by',
    relates_to: 'relates_to',
    caused_by: 'caused_by',
    causes: 'causes'
} as const;
export type CreateRelationRelationTypeEnum = typeof CreateRelationRelationTypeEnum[keyof typeof CreateRelationRelationTypeEnum];

/**
 * @type CreateResponse
 * 
 * @export
 */
export type CreateResponse = CreateResponseOneOf | CreateResponseOneOf1;
/**
 * 
 * @export
 * @interface CreateResponseOneOf
 */
export interface CreateResponseOneOf {
    /**
     * 
     * @type {string}
     * @memberof CreateResponseOneOf
     */
    ask: CreateResponseOneOfAskEnum;
    /**
     * 
     * @type {CreateResponseOneOfInput}
     * @memberof CreateResponseOneOf
     */
    input: CreateResponseOneOfInput;
    /**
     * 
     * @type {Array<CreateResponseOneOfContextRefsInner>}
     * @memberof CreateResponseOneOf
     */
    context_refs?: Array<CreateResponseOneOfContextRefsInner>;
    /**
     * 
     * @type {CreateResponseOneOfResponseFormat}
     * @memberof CreateResponseOneOf
     */
    response_format?: CreateResponseOneOfResponseFormat;
    /**
     * 
     * @type {string}
     * @memberof CreateResponseOneOf
     */
    model?: string;
}


/**
 * @export
 */
export const CreateResponseOneOfAskEnum = {
    text: 'text'
} as const;
export type CreateResponseOneOfAskEnum = typeof CreateResponseOneOfAskEnum[keyof typeof CreateResponseOneOfAskEnum];

/**
 * 
 * @export
 * @interface CreateResponseOneOf1
 */
export interface CreateResponseOneOf1 {
    /**
     * 
     * @type {string}
     * @memberof CreateResponseOneOf1
     */
    ask: CreateResponseOneOf1AskEnum;
    /**
     * 
     * @type {CreateResponseOneOf1Input}
     * @memberof CreateResponseOneOf1
     */
    input: CreateResponseOneOf1Input;
    /**
     * 
     * @type {string}
     * @memberof CreateResponseOneOf1
     */
    model?: string;
}


/**
 * @export
 */
export const CreateResponseOneOf1AskEnum = {
    founder_brief: 'founder_brief'
} as const;
export type CreateResponseOneOf1AskEnum = typeof CreateResponseOneOf1AskEnum[keyof typeof CreateResponseOneOf1AskEnum];

/**
 * 
 * @export
 * @interface CreateResponseOneOf1Input
 */
export interface CreateResponseOneOf1Input {
    /**
     * 
     * @type {string}
     * @memberof CreateResponseOneOf1Input
     */
    horizon: CreateResponseOneOf1InputHorizonEnum;
}


/**
 * @export
 */
export const CreateResponseOneOf1InputHorizonEnum = {
    this_week: 'this_week'
} as const;
export type CreateResponseOneOf1InputHorizonEnum = typeof CreateResponseOneOf1InputHorizonEnum[keyof typeof CreateResponseOneOf1InputHorizonEnum];

/**
 * @type CreateResponseOneOfContextRefsInner
 * 
 * @export
 */
export type CreateResponseOneOfContextRefsInner = CreateResponseOneOfContextRefsInnerOneOf | CreateResponseOneOfContextRefsInnerOneOf1;
/**
 * 
 * @export
 * @interface CreateResponseOneOfContextRefsInnerOneOf
 */
export interface CreateResponseOneOfContextRefsInnerOneOf {
    /**
     * 
     * @type {string}
     * @memberof CreateResponseOneOfContextRefsInnerOneOf
     */
    type: CreateResponseOneOfContextRefsInnerOneOfTypeEnum;
    /**
     * Prefixed resource ID. Wire form: `wi_<base58>`.
     * @type {string}
     * @memberof CreateResponseOneOfContextRefsInnerOneOf
     */
    id: string;
}


/**
 * @export
 */
export const CreateResponseOneOfContextRefsInnerOneOfTypeEnum = {
    work_item: 'work_item'
} as const;
export type CreateResponseOneOfContextRefsInnerOneOfTypeEnum = typeof CreateResponseOneOfContextRefsInnerOneOfTypeEnum[keyof typeof CreateResponseOneOfContextRefsInnerOneOfTypeEnum];

/**
 * 
 * @export
 * @interface CreateResponseOneOfContextRefsInnerOneOf1
 */
export interface CreateResponseOneOfContextRefsInnerOneOf1 {
    /**
     * 
     * @type {string}
     * @memberof CreateResponseOneOfContextRefsInnerOneOf1
     */
    type: CreateResponseOneOfContextRefsInnerOneOf1TypeEnum;
    /**
     * Prefixed resource ID. Wire form: `it_<base58>`.
     * @type {string}
     * @memberof CreateResponseOneOfContextRefsInnerOneOf1
     */
    id: string;
}


/**
 * @export
 */
export const CreateResponseOneOfContextRefsInnerOneOf1TypeEnum = {
    iteration: 'iteration'
} as const;
export type CreateResponseOneOfContextRefsInnerOneOf1TypeEnum = typeof CreateResponseOneOfContextRefsInnerOneOf1TypeEnum[keyof typeof CreateResponseOneOfContextRefsInnerOneOf1TypeEnum];

/**
 * 
 * @export
 * @interface CreateResponseOneOfInput
 */
export interface CreateResponseOneOfInput {
    /**
     * 
     * @type {string}
     * @memberof CreateResponseOneOfInput
     */
    question: string;
}
/**
 * 
 * @export
 * @interface CreateResponseOneOfResponseFormat
 */
export interface CreateResponseOneOfResponseFormat {
    /**
     * 
     * @type {string}
     * @memberof CreateResponseOneOfResponseFormat
     */
    type?: CreateResponseOneOfResponseFormatTypeEnum;
}


/**
 * @export
 */
export const CreateResponseOneOfResponseFormatTypeEnum = {
    text: 'text'
} as const;
export type CreateResponseOneOfResponseFormatTypeEnum = typeof CreateResponseOneOfResponseFormatTypeEnum[keyof typeof CreateResponseOneOfResponseFormatTypeEnum];

/**
 * Create a share + initial grant set in one call. `scope` is the resource kind (`artifact` / `folder` / `project` / `page`); `grants` is the initial principal → role mapping.
 * @export
 * @interface CreateShare
 */
export interface CreateShare {
    /**
     * 
     * @type {string}
     * @memberof CreateShare
     */
    scope: string;
    /**
     * 
     * @type {string}
     * @memberof CreateShare
     */
    resource_id: string;
    /**
     * 
     * @type {Array<CreateShareGrantsInner>}
     * @memberof CreateShare
     */
    grants: Array<CreateShareGrantsInner>;
    /**
     * 
     * @type {boolean}
     * @memberof CreateShare
     */
    inherits?: boolean;
    /**
     * 
     * @type {string}
     * @memberof CreateShare
     */
    message?: string;
    /**
     * 
     * @type {string}
     * @memberof CreateShare
     */
    expires_at?: string;
}
/**
 * 
 * @export
 * @interface CreateShareGrant
 */
export interface CreateShareGrant {
    /**
     * 
     * @type {string}
     * @memberof CreateShareGrant
     */
    principal_type: string;
    /**
     * 
     * @type {string}
     * @memberof CreateShareGrant
     */
    principal_id: string;
    /**
     * 
     * @type {string}
     * @memberof CreateShareGrant
     */
    role: string;
}
/**
 * 
 * @export
 * @interface CreateShareGrantsInner
 */
export interface CreateShareGrantsInner {
    /**
     * 
     * @type {string}
     * @memberof CreateShareGrantsInner
     */
    principal_type: string;
    /**
     * 
     * @type {string}
     * @memberof CreateShareGrantsInner
     */
    principal_id: string;
    /**
     * 
     * @type {string}
     * @memberof CreateShareGrantsInner
     */
    role: string;
}
/**
 * 
 * @export
 * @interface CreateUserApiToken
 */
export interface CreateUserApiToken {
    /**
     * 
     * @type {string}
     * @memberof CreateUserApiToken
     */
    name: string;
    /**
     * 
     * @type {number}
     * @memberof CreateUserApiToken
     */
    expires_in_days?: number;
}
/**
 * Attach a provider API key. The key itself is verified by the pre-flight probe in `ProviderKeyTester` and then stored encrypted in the vault. The raw value is NEVER echoed back on any subsequent response — see `UserLlmCredential.key_last4`.
 * @export
 * @interface CreateUserLlmCredential
 */
export interface CreateUserLlmCredential {
    /**
     * 
     * @type {string}
     * @memberof CreateUserLlmCredential
     */
    provider: CreateUserLlmCredentialProviderEnum;
    /**
     * 
     * @type {string}
     * @memberof CreateUserLlmCredential
     */
    api_key: string;
    /**
     * 
     * @type {string}
     * @memberof CreateUserLlmCredential
     */
    label?: string;
}


/**
 * @export
 */
export const CreateUserLlmCredentialProviderEnum = {
    anthropic: 'anthropic',
    openai: 'openai'
} as const;
export type CreateUserLlmCredentialProviderEnum = typeof CreateUserLlmCredentialProviderEnum[keyof typeof CreateUserLlmCredentialProviderEnum];

/**
 * 
 * @export
 * @interface CreateView
 */
export interface CreateView {
    /**
     * 
     * @type {string}
     * @memberof CreateView
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof CreateView
     */
    kind: CreateViewKindEnum;
    /**
     * 
     * @type {string}
     * @memberof CreateView
     */
    visibility?: CreateViewVisibilityEnum;
    /**
     * 
     * @type {object}
     * @memberof CreateView
     */
    query?: object;
}


/**
 * @export
 */
export const CreateViewKindEnum = {
    work_items: 'work_items'
} as const;
export type CreateViewKindEnum = typeof CreateViewKindEnum[keyof typeof CreateViewKindEnum];

/**
 * @export
 */
export const CreateViewVisibilityEnum = {
    private: 'private',
    shared: 'shared'
} as const;
export type CreateViewVisibilityEnum = typeof CreateViewVisibilityEnum[keyof typeof CreateViewVisibilityEnum];

/**
 * Body for creating a webhook endpoint. Only `url` is required; every other field has a sensible default (no filter, no channel filter, uncapped rate, not disabled).
 * @export
 * @interface CreateWebhookEndpoint
 */
export interface CreateWebhookEndpoint {
    /**
     * 
     * @type {string}
     * @memberof CreateWebhookEndpoint
     */
    url: string;
    /**
     * 
     * @type {string}
     * @memberof CreateWebhookEndpoint
     */
    description?: string;
    /**
     * 
     * @type {Array<string>}
     * @memberof CreateWebhookEndpoint
     */
    filter_types?: Array<string> | null;
    /**
     * 
     * @type {Array<string>}
     * @memberof CreateWebhookEndpoint
     */
    channels?: Array<string> | null;
    /**
     * 
     * @type {number}
     * @memberof CreateWebhookEndpoint
     */
    rate_limit?: number | null;
    /**
     * 
     * @type {boolean}
     * @memberof CreateWebhookEndpoint
     */
    disabled?: boolean;
}
/**
 * 
 * @export
 * @interface CreateWorkItem
 */
export interface CreateWorkItem {
    /**
     * 
     * @type {string}
     * @memberof CreateWorkItem
     */
    title: string;
    /**
     * 
     * @type {string}
     * @memberof CreateWorkItem
     */
    subject?: string;
    /**
     * 
     * @type {string}
     * @memberof CreateWorkItem
     */
    description?: string;
    /**
     * Prefixed resource ID. Wire form: `ws_<base58>`.
     * @type {string}
     * @memberof CreateWorkItem
     */
    workspace_id?: string;
    /**
     * 
     * @type {string}
     * @memberof CreateWorkItem
     */
    state_key?: string;
    /**
     * 
     * @type {string}
     * @memberof CreateWorkItem
     */
    type_key?: string;
    /**
     * 
     * @type {string}
     * @memberof CreateWorkItem
     */
    priority?: CreateWorkItemPriorityEnum;
    /**
     * 
     * @type {string}
     * @memberof CreateWorkItem
     */
    due_date?: string;
    /**
     * 
     * @type {number}
     * @memberof CreateWorkItem
     */
    estimate?: number;
    /**
     * 
     * @type {string}
     * @memberof CreateWorkItem
     */
    assignee_id?: string;
    /**
     * 
     * @type {string}
     * @memberof CreateWorkItem
     */
    assignee_name?: string;
    /**
     * 
     * @type {string}
     * @memberof CreateWorkItem
     */
    dri_id?: string;
    /**
     * 
     * @type {string}
     * @memberof CreateWorkItem
     */
    dri_name?: string;
    /**
     * Prefixed resource ID. Wire form: `wi_<base58>`.
     * @type {string}
     * @memberof CreateWorkItem
     */
    parent_id?: string;
    /**
     * Prefixed resource ID. Wire form: `it_<base58>`.
     * @type {string}
     * @memberof CreateWorkItem
     */
    iteration_id?: string;
    /**
     * 
     * @type {Array<string>}
     * @memberof CreateWorkItem
     */
    label_ids?: Array<string>;
    /**
     * Prefixed resource ID. Wire form: `fld_<base58>`.
     * @type {string}
     * @memberof CreateWorkItem
     */
    folder_id?: string;
}


/**
 * @export
 */
export const CreateWorkItemPriorityEnum = {
    none: 'none',
    low: 'low',
    medium: 'medium',
    high: 'high',
    urgent: 'urgent'
} as const;
export type CreateWorkItemPriorityEnum = typeof CreateWorkItemPriorityEnum[keyof typeof CreateWorkItemPriorityEnum];

/**
 * 
 * @export
 * @interface CreateWorkItemType
 */
export interface CreateWorkItemType {
    /**
     * 
     * @type {string}
     * @memberof CreateWorkItemType
     */
    key: string;
    /**
     * 
     * @type {string}
     * @memberof CreateWorkItemType
     */
    name: string;
    /**
     * Prefixed resource ID. Wire form: `wf_<base58>`.
     * @type {string}
     * @memberof CreateWorkItemType
     */
    default_workflow_id: string;
}
/**
 * 
 * @export
 * @interface CreateWorkflow
 */
export interface CreateWorkflow {
    /**
     * 
     * @type {string}
     * @memberof CreateWorkflow
     */
    name: string;
    /**
     * 
     * @type {boolean}
     * @memberof CreateWorkflow
     */
    is_default?: boolean;
    /**
     * 
     * @type {Array<CreateWorkflowStatesInner>}
     * @memberof CreateWorkflow
     */
    states?: Array<CreateWorkflowStatesInner>;
}
/**
 * 
 * @export
 * @interface CreateWorkflowState
 */
export interface CreateWorkflowState {
    /**
     * 
     * @type {string}
     * @memberof CreateWorkflowState
     */
    key: string;
    /**
     * 
     * @type {string}
     * @memberof CreateWorkflowState
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof CreateWorkflowState
     */
    category: CreateWorkflowStateCategoryEnum;
    /**
     * 
     * @type {number}
     * @memberof CreateWorkflowState
     */
    position?: number;
}


/**
 * @export
 */
export const CreateWorkflowStateCategoryEnum = {
    not_started: 'not_started',
    active: 'active',
    done: 'done',
    dead: 'dead'
} as const;
export type CreateWorkflowStateCategoryEnum = typeof CreateWorkflowStateCategoryEnum[keyof typeof CreateWorkflowStateCategoryEnum];

/**
 * 
 * @export
 * @interface CreateWorkflowStatesInner
 */
export interface CreateWorkflowStatesInner {
    /**
     * 
     * @type {string}
     * @memberof CreateWorkflowStatesInner
     */
    key: string;
    /**
     * 
     * @type {string}
     * @memberof CreateWorkflowStatesInner
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof CreateWorkflowStatesInner
     */
    category: CreateWorkflowStatesInnerCategoryEnum;
    /**
     * 
     * @type {number}
     * @memberof CreateWorkflowStatesInner
     */
    position?: number;
}


/**
 * @export
 */
export const CreateWorkflowStatesInnerCategoryEnum = {
    not_started: 'not_started',
    active: 'active',
    done: 'done',
    dead: 'dead'
} as const;
export type CreateWorkflowStatesInnerCategoryEnum = typeof CreateWorkflowStatesInnerCategoryEnum[keyof typeof CreateWorkflowStatesInnerCategoryEnum];

/**
 * Create a workspace inside the caller’s organization. The organization is resolved from the JWT — the body carries no tenancy. Rejects with `workspace_quota_exhausted` (409) if the org is at its `max_workspaces` quota.
 * @export
 * @interface CreateWorkspace
 */
export interface CreateWorkspace {
    /**
     * 
     * @type {string}
     * @memberof CreateWorkspace
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof CreateWorkspace
     */
    key: string;
    /**
     * 
     * @type {{ [key: string]: string; }}
     * @memberof CreateWorkspace
     */
    metadata?: { [key: string]: string; };
}
/**
 * Wraps the projected credential row plus the verification outcome. Returned by both `POST /v1/user/llm_credentials` (initial probe) and `POST /v1/user/llm_credentials/:id/test` (re-probe).
 * @export
 * @interface CredentialTestResponse
 */
export interface CredentialTestResponse {
    /**
     * 
     * @type {UserLlmCredential}
     * @memberof CredentialTestResponse
     */
    credential: UserLlmCredential;
    /**
     * ProviderKeyTester result code (e.g. `ok` / `unauthorized` / `network_error`).
     * @type {string}
     * @memberof CredentialTestResponse
     */
    test_result: string;
    /**
     * 
     * @type {string}
     * @memberof CredentialTestResponse
     */
    message: string;
}
/**
 * A KG entity row — extracted, structural, or hand-curated (`origin`). Hand-created entities have `mention_count: 0`.
 * @export
 * @interface CuratedKgEntity
 */
export interface CuratedKgEntity {
    /**
     * 
     * @type {string}
     * @memberof CuratedKgEntity
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof CuratedKgEntity
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof CuratedKgEntity
     */
    type: string;
    /**
     * 
     * @type {string}
     * @memberof CuratedKgEntity
     */
    description: string | null;
    /**
     * 
     * @type {string}
     * @memberof CuratedKgEntity
     */
    origin: CuratedKgEntityOriginEnum;
    /**
     * 
     * @type {number}
     * @memberof CuratedKgEntity
     */
    mention_count: number;
    /**
     * 
     * @type {number}
     * @memberof CuratedKgEntity
     */
    community_id: number | null;
    /**
     * 
     * @type {string}
     * @memberof CuratedKgEntity
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof CuratedKgEntity
     */
    updated_at: string;
}


/**
 * @export
 */
export const CuratedKgEntityOriginEnum = {
    structural: 'structural',
    extracted: 'extracted',
    manual: 'manual'
} as const;
export type CuratedKgEntityOriginEnum = typeof CuratedKgEntityOriginEnum[keyof typeof CuratedKgEntityOriginEnum];

/**
 * 
 * @export
 * @interface CuratedKgRelationship
 */
export interface CuratedKgRelationship {
    /**
     * 
     * @type {string}
     * @memberof CuratedKgRelationship
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof CuratedKgRelationship
     */
    source_entity_id: string;
    /**
     * 
     * @type {string}
     * @memberof CuratedKgRelationship
     */
    target_entity_id: string;
    /**
     * 
     * @type {string}
     * @memberof CuratedKgRelationship
     */
    type: string;
    /**
     * 
     * @type {number}
     * @memberof CuratedKgRelationship
     */
    weight: number;
    /**
     * 
     * @type {string}
     * @memberof CuratedKgRelationship
     */
    created_at: string;
}
/**
 * `GET /subscriptions/current` — caller's current subscription + org pointer, or `null` + an explanatory `message` when no active subscription exists.
 * @export
 * @interface CurrentSubscriptionResponse
 */
export interface CurrentSubscriptionResponse {
    [key: string]: any | any;
    /**
     * 
     * @type {CurrentSubscriptionResponseSubscription}
     * @memberof CurrentSubscriptionResponse
     */
    subscription: CurrentSubscriptionResponseSubscription;
    /**
     * 
     * @type {CurrentSubscriptionResponseOrganization}
     * @memberof CurrentSubscriptionResponse
     */
    organization: CurrentSubscriptionResponseOrganization;
    /**
     * 
     * @type {string}
     * @memberof CurrentSubscriptionResponse
     */
    message?: string;
}
/**
 * 
 * @export
 * @interface CurrentSubscriptionResponseOrganization
 */
export interface CurrentSubscriptionResponseOrganization {
    /**
     * Prefixed resource ID. Wire form: `org_<base58>`.
     * @type {string}
     * @memberof CurrentSubscriptionResponseOrganization
     */
    id: string;
}
/**
 * 
 * @export
 * @interface CurrentSubscriptionResponseSubscription
 */
export interface CurrentSubscriptionResponseSubscription {
    /**
     * Prefixed resource ID. Wire form: `sub_<base58>`.
     * @type {string}
     * @memberof CurrentSubscriptionResponseSubscription
     */
    id: string;
    /**
     * 
     * @type {SubscriptionPlanType}
     * @memberof CurrentSubscriptionResponseSubscription
     */
    plan_type: SubscriptionPlanType;
    /**
     * 
     * @type {SubscriptionStatus}
     * @memberof CurrentSubscriptionResponseSubscription
     */
    status: SubscriptionStatus;
    /**
     * 
     * @type {BillingInterval}
     * @memberof CurrentSubscriptionResponseSubscription
     */
    billing_interval: BillingInterval;
    /**
     * 
     * @type {number}
     * @memberof CurrentSubscriptionResponseSubscription
     */
    seat_count: number;
    /**
     * 
     * @type {number}
     * @memberof CurrentSubscriptionResponseSubscription
     */
    price_cents: number;
    /**
     * 
     * @type {string}
     * @memberof CurrentSubscriptionResponseSubscription
     */
    currency: string;
    /**
     * 
     * @type {string}
     * @memberof CurrentSubscriptionResponseSubscription
     */
    current_period_start: string;
    /**
     * 
     * @type {string}
     * @memberof CurrentSubscriptionResponseSubscription
     */
    current_period_end: string;
    /**
     * 
     * @type {string}
     * @memberof CurrentSubscriptionResponseSubscription
     */
    trial_end: string;
    /**
     * 
     * @type {UsageMode}
     * @memberof CurrentSubscriptionResponseSubscription
     */
    usage_mode: UsageMode;
    /**
     * 
     * @type {string}
     * @memberof CurrentSubscriptionResponseSubscription
     */
    canceled_at: string;
    /**
     * 
     * @type {string}
     * @memberof CurrentSubscriptionResponseSubscription
     */
    ended_at: string;
    /**
     * 
     * @type {string}
     * @memberof CurrentSubscriptionResponseSubscription
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof CurrentSubscriptionResponseSubscription
     */
    updated_at: string;
}


/**
 * 
 * @export
 * @interface DeleteMyAccountRequest
 */
export interface DeleteMyAccountRequest {
    /**
     * Hard-coded confirmation string. Required to satisfy the Apple App Store + GDPR irreversible-action guards.
     * @type {string}
     * @memberof DeleteMyAccountRequest
     */
    confirmation: DeleteMyAccountRequestConfirmationEnum;
}


/**
 * @export
 */
export const DeleteMyAccountRequestConfirmationEnum = {
    DELETE: 'DELETE'
} as const;
export type DeleteMyAccountRequestConfirmationEnum = typeof DeleteMyAccountRequestConfirmationEnum[keyof typeof DeleteMyAccountRequestConfirmationEnum];

/**
 * 
 * @export
 * @interface DeleteMyOrganizationRequest
 */
export interface DeleteMyOrganizationRequest {
    /**
     * Hard-coded confirmation string. Required to satisfy the Apple App Store + GDPR irreversible-action guards.
     * @type {string}
     * @memberof DeleteMyOrganizationRequest
     */
    confirmation: DeleteMyOrganizationRequestConfirmationEnum;
}


/**
 * @export
 */
export const DeleteMyOrganizationRequestConfirmationEnum = {
    DELETE: 'DELETE'
} as const;
export type DeleteMyOrganizationRequestConfirmationEnum = typeof DeleteMyOrganizationRequestConfirmationEnum[keyof typeof DeleteMyOrganizationRequestConfirmationEnum];

/**
 * Soft / hard-delete acknowledgement. Constant-shape so SDKs can dispatch on `deleted === true` without parsing.
 * @export
 * @interface DeletedAck
 */
export interface DeletedAck {
    /**
     * 
     * @type {boolean}
     * @memberof DeletedAck
     */
    deleted: DeletedAckDeletedEnum;
}


/**
 * @export
 */
export const DeletedAckDeletedEnum = {
    true: true
} as const;
export type DeletedAckDeletedEnum = typeof DeletedAckDeletedEnum[keyof typeof DeletedAckDeletedEnum];

/**
 * Event-management record returned by GET /v1/events/{id} and :redeliver. NOT the delivered webhook payload — webhooks always receive the Stripe v2 thin envelope (no `data`, `previous_attributes`, `api_version`). The management record surfaces the stored snapshot for debugging. Internal columns (svix_message_id, attempts, last_error, next_attempt_at) are intentionally omitted.
 * @export
 * @interface Event
 */
export interface Event {
    [key: string]: any | any;
    /**
     * 
     * @type {string}
     * @memberof Event
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof Event
     */
    type: string;
    /**
     * 
     * @type {string}
     * @memberof Event
     */
    api_version: string;
    /**
     * Prefixed resource ID. Wire form: `org_<base58>`.
     * @type {string}
     * @memberof Event
     */
    organization_id: string;
    /**
     * Prefixed resource ID. Wire form: `ws_<base58>`.
     * @type {string}
     * @memberof Event
     */
    workspace_id: string;
    /**
     * 
     * @type {string}
     * @memberof Event
     */
    aggregate_type: string;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof Event
     */
    aggregate_id: AccountMembershipOrganizationBillingEmail;
    /**
     * 
     * @type {string}
     * @memberof Event
     */
    occurred_at: string;
    /**
     * `pending` / `dispatched` / `failed` / `discarded`.
     * @type {string}
     * @memberof Event
     */
    status: string;
    /**
     * 
     * @type {object}
     * @memberof Event
     */
    data: object;
    /**
     * 
     * @type {AuditEventAfter}
     * @memberof Event
     */
    previous_attributes: AuditEventAfter;
    /**
     * 
     * @type {Array<EventOutcome>}
     * @memberof Event
     */
    outcomes: Array<EventOutcome>;
}
/**
 * 
 * @export
 * @interface EventEnvelope
 */
export interface EventEnvelope {
    /**
     * 
     * @type {Event}
     * @memberof EventEnvelope
     */
    event: Event;
}
/**
 * Closed-loop return leg for a webhook event. Customers POST outcomes back via /v1/events/{event_id}/outcome; outcomes are keyed by stable `event_id` so redelivery doesn't fragment the loop.
 * @export
 * @interface EventOutcome
 */
export interface EventOutcome {
    [key: string]: any | any;
    /**
     * Prefixed resource ID. Wire form: `evto_<base58>`.
     * @type {string}
     * @memberof EventOutcome
     */
    id: string;
    /**
     * 
     * @type {EventOutcomeStatus}
     * @memberof EventOutcome
     */
    status: EventOutcomeStatus;
    /**
     * 
     * @type {AuditEventAfter}
     * @memberof EventOutcome
     */
    result: AuditEventAfter;
    /**
     * 
     * @type {EventOutcomeSubmitterAccountId}
     * @memberof EventOutcome
     */
    submitter_account_id: EventOutcomeSubmitterAccountId;
    /**
     * 
     * @type {string}
     * @memberof EventOutcome
     */
    received_at: string;
}


/**
 * 
 * @export
 * @interface EventOutcomeEnvelope
 */
export interface EventOutcomeEnvelope {
    /**
     * 
     * @type {EventOutcome}
     * @memberof EventOutcomeEnvelope
     */
    outcome: EventOutcome;
}

/**
 * 
 * @export
 */
export const EventOutcomeStatus = {
    succeeded: 'succeeded',
    failed: 'failed',
    skipped: 'skipped'
} as const;
export type EventOutcomeStatus = typeof EventOutcomeStatus[keyof typeof EventOutcomeStatus];

/**
 * 
 * @export
 * @interface EventOutcomeSubmitterAccountId
 */
export interface EventOutcomeSubmitterAccountId {
}
/**
 * 
 * @export
 * @interface EventPage
 */
export interface EventPage {
    /**
     * 
     * @type {Array<Event>}
     * @memberof EventPage
     */
    data: Array<Event>;
    /**
     * 
     * @type {boolean}
     * @memberof EventPage
     */
    has_more: boolean;
    /**
     * 
     * @type {string}
     * @memberof EventPage
     */
    next_page_url: string | null;
    /**
     * 
     * @type {string}
     * @memberof EventPage
     */
    previous_page_url: string | null;
}
/**
 * One subscribable webhook event type. The set delivered to customer endpoints — narrower than the full internal event vocabulary.
 * @export
 * @interface EventType
 */
export interface EventType {
    /**
     * Wire event type in `resource.action` form (e.g. `work_item.created`). Use these values in a webhook endpoint's `filter_types`.
     * @type {string}
     * @memberof EventType
     */
    type: string;
    /**
     * The resource the event concerns (e.g. `work_item`).
     * @type {string}
     * @memberof EventType
     */
    resource: string;
    /**
     * Past-tense action (e.g. `created`).
     * @type {string}
     * @memberof EventType
     */
    action: string;
    /**
     * One-line human description of when the event fires.
     * @type {string}
     * @memberof EventType
     */
    description: string;
}
/**
 * The complete webhook event-type catalog.
 * @export
 * @interface EventTypeList
 */
export interface EventTypeList {
    /**
     * 
     * @type {Array<EventType>}
     * @memberof EventTypeList
     */
    data: Array<EventType>;
}
/**
 * Customer-facing feature-request projection. A facade over the platform `work_item` row, narrowed for public consumption — never exposes assignee, created_by, state_id, workspace_id, etc.
 * @export
 * @interface FeatureRequest
 */
export interface FeatureRequest {
    /**
     * Prefixed resource ID. Wire form: `fr_<base58>`.
     * @type {string}
     * @memberof FeatureRequest
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof FeatureRequest
     */
    title: string;
    /**
     * 
     * @type {string}
     * @memberof FeatureRequest
     */
    description: string | null;
    /**
     * 
     * @type {FeatureRequestState}
     * @memberof FeatureRequest
     */
    state: FeatureRequestState;
    /**
     * 
     * @type {number}
     * @memberof FeatureRequest
     */
    vote_count: number;
    /**
     * 
     * @type {string}
     * @memberof FeatureRequest
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof FeatureRequest
     */
    shipped_at: string | null;
    /**
     * 
     * @type {boolean}
     * @memberof FeatureRequest
     */
    viewer_has_voted: boolean;
}

/**
 * 
 * @export
 */
export const FeatureRequestBoardStateCategory = {
    not_started: 'not_started',
    active: 'active',
    done: 'done',
    dead: 'dead'
} as const;
export type FeatureRequestBoardStateCategory = typeof FeatureRequestBoardStateCategory[keyof typeof FeatureRequestBoardStateCategory];


/**
 * 
 * @export
 */
export const FeatureRequestBoardSurface = {
    feature_requests: 'feature_requests',
    changelog: 'changelog'
} as const;
export type FeatureRequestBoardSurface = typeof FeatureRequestBoardSurface[keyof typeof FeatureRequestBoardSurface];

/**
 * A single comment on a public feature request. The wire surface never exposes anon-cookie ids or account ids — `viewer_can_delete` is the only signal a frontend uses to decide whether to render the delete control.
 * @export
 * @interface FeatureRequestComment
 */
export interface FeatureRequestComment {
    /**
     * Prefixed resource ID. Wire form: `cmt_<base58>`.
     * @type {string}
     * @memberof FeatureRequestComment
     */
    id: string;
    /**
     * Prefixed resource ID. Wire form: `fr_<base58>`.
     * @type {string}
     * @memberof FeatureRequestComment
     */
    feature_request_id: string;
    /**
     * 
     * @type {string}
     * @memberof FeatureRequestComment
     */
    body: string;
    /**
     * 
     * @type {FeatureRequestCommentAuthor}
     * @memberof FeatureRequestComment
     */
    author: FeatureRequestCommentAuthor;
    /**
     * 
     * @type {string}
     * @memberof FeatureRequestComment
     */
    created_at: string;
    /**
     * 
     * @type {boolean}
     * @memberof FeatureRequestComment
     */
    viewer_can_delete: boolean;
}
/**
 * Author projection for a public feature-request comment. Anonymous authors carry the caller-supplied display name (or "Anonymous" if absent); authed authors derive it from their account.
 * @export
 * @interface FeatureRequestCommentAuthor
 */
export interface FeatureRequestCommentAuthor {
    /**
     * 
     * @type {string}
     * @memberof FeatureRequestCommentAuthor
     */
    type: FeatureRequestCommentAuthorTypeEnum;
    /**
     * 
     * @type {string}
     * @memberof FeatureRequestCommentAuthor
     */
    display_name: string;
}


/**
 * @export
 */
export const FeatureRequestCommentAuthorTypeEnum = {
    anonymous: 'anonymous',
    account: 'account'
} as const;
export type FeatureRequestCommentAuthorTypeEnum = typeof FeatureRequestCommentAuthorTypeEnum[keyof typeof FeatureRequestCommentAuthorTypeEnum];

/**
 * 
 * @export
 * @interface FeatureRequestCommentEnvelope
 */
export interface FeatureRequestCommentEnvelope {
    /**
     * 
     * @type {FeatureRequestComment}
     * @memberof FeatureRequestCommentEnvelope
     */
    comment: FeatureRequestComment;
}
/**
 * 
 * @export
 * @interface FeatureRequestCommentListEnvelope
 */
export interface FeatureRequestCommentListEnvelope {
    /**
     * 
     * @type {Array<FeatureRequestComment>}
     * @memberof FeatureRequestCommentListEnvelope
     */
    data: Array<FeatureRequestComment>;
    /**
     * 
     * @type {boolean}
     * @memberof FeatureRequestCommentListEnvelope
     */
    has_more: boolean;
    /**
     * 
     * @type {string}
     * @memberof FeatureRequestCommentListEnvelope
     */
    next_page_url: string | null;
    /**
     * 
     * @type {string}
     * @memberof FeatureRequestCommentListEnvelope
     */
    previous_page_url: string | null;
}
/**
 * 
 * @export
 * @interface FeatureRequestEnvelope
 */
export interface FeatureRequestEnvelope {
    /**
     * 
     * @type {FeatureRequest}
     * @memberof FeatureRequestEnvelope
     */
    feature_request: FeatureRequest;
}
/**
 * 
 * @export
 * @interface FeatureRequestListEnvelope
 */
export interface FeatureRequestListEnvelope {
    /**
     * 
     * @type {Array<FeatureRequest>}
     * @memberof FeatureRequestListEnvelope
     */
    data: Array<FeatureRequest>;
    /**
     * 
     * @type {boolean}
     * @memberof FeatureRequestListEnvelope
     */
    has_more: boolean;
    /**
     * 
     * @type {string}
     * @memberof FeatureRequestListEnvelope
     */
    next_page_url: string | null;
    /**
     * 
     * @type {string}
     * @memberof FeatureRequestListEnvelope
     */
    previous_page_url: string | null;
}
/**
 * `created: false` indicates the caller had already voted — the response is idempotent so the frontend can replay safely.
 * @export
 * @interface FeatureRequestReactionAdded
 */
export interface FeatureRequestReactionAdded {
    /**
     * 
     * @type {boolean}
     * @memberof FeatureRequestReactionAdded
     */
    created: boolean;
    /**
     * 
     * @type {number}
     * @memberof FeatureRequestReactionAdded
     */
    vote_count: number;
}
/**
 * 
 * @export
 * @interface FeatureRequestReactionAddedEnvelope
 */
export interface FeatureRequestReactionAddedEnvelope {
    /**
     * 
     * @type {FeatureRequestReactionAdded}
     * @memberof FeatureRequestReactionAddedEnvelope
     */
    data: FeatureRequestReactionAdded;
}
/**
 * 
 * @export
 * @interface FeatureRequestReactionRemoved
 */
export interface FeatureRequestReactionRemoved {
    /**
     * 
     * @type {boolean}
     * @memberof FeatureRequestReactionRemoved
     */
    removed: boolean;
    /**
     * 
     * @type {number}
     * @memberof FeatureRequestReactionRemoved
     */
    vote_count: number;
}
/**
 * 
 * @export
 * @interface FeatureRequestReactionRemovedEnvelope
 */
export interface FeatureRequestReactionRemovedEnvelope {
    /**
     * 
     * @type {FeatureRequestReactionRemoved}
     * @memberof FeatureRequestReactionRemovedEnvelope
     */
    data: FeatureRequestReactionRemoved;
}
/**
 * Inline workflow-state projection on a feature request. Public callers filter by `state.category` (`not_started`, `active`, `done`, `dead`) without needing tenant-specific state keys.
 * @export
 * @interface FeatureRequestState
 */
export interface FeatureRequestState {
    /**
     * 
     * @type {string}
     * @memberof FeatureRequestState
     */
    key: string;
    /**
     * 
     * @type {string}
     * @memberof FeatureRequestState
     */
    name: string;
    /**
     * 
     * @type {FeatureRequestStateCategory}
     * @memberof FeatureRequestState
     */
    category: FeatureRequestStateCategory;
}



/**
 * 
 * @export
 */
export const FeatureRequestStateCategory = {
    not_started: 'not_started',
    active: 'active',
    done: 'done',
    dead: 'dead'
} as const;
export type FeatureRequestStateCategory = typeof FeatureRequestStateCategory[keyof typeof FeatureRequestStateCategory];

/**
 * A user-clipped snippet with provenance back to its source (chat message or document selection). Excludes `account_id`, `organization_id`, `workspace_id`, `deleted_at` — tenancy / soft-delete plumbing.
 * @export
 * @interface Finding
 */
export interface Finding {
    /**
     * Prefixed resource ID. Wire form: `fnd_<base58>`.
     * @type {string}
     * @memberof Finding
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof Finding
     */
    content: string;
    /**
     * 
     * @type {string}
     * @memberof Finding
     */
    title: string;
    /**
     * 
     * @type {FindingSourceType}
     * @memberof Finding
     */
    source_type: FindingSourceType;
    /**
     * Prefixed resource ID. Wire form: `msg_<base58>`.
     * @type {string}
     * @memberof Finding
     */
    source_message_id: string | null;
    /**
     * Prefixed resource ID. Wire form: `chat_<base58>`.
     * @type {string}
     * @memberof Finding
     */
    chat_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof Finding
     */
    source_timestamp: string | null;
    /**
     * 
     * @type {number}
     * @memberof Finding
     */
    selection_start: number | null;
    /**
     * 
     * @type {number}
     * @memberof Finding
     */
    selection_end: number | null;
    /**
     * 
     * @type {Array<string>}
     * @memberof Finding
     */
    tags: Array<string> | null;
    /**
     * 
     * @type {string}
     * @memberof Finding
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Finding
     */
    updated_at: string;
}


/**
 * 
 * @export
 * @interface FindingEnvelope
 */
export interface FindingEnvelope {
    /**
     * 
     * @type {Finding}
     * @memberof FindingEnvelope
     */
    finding: Finding;
}
/**
 * Stripe v2 cursor-paginated envelope plus the date-bucket `grouped` projection. `data` / `has_more` / `next_page_url` / `previous_page_url` follow the platform-wide pagination shape.
 * @export
 * @interface FindingList
 */
export interface FindingList {
    /**
     * 
     * @type {Array<Finding>}
     * @memberof FindingList
     */
    data: Array<Finding>;
    /**
     * 
     * @type {boolean}
     * @memberof FindingList
     */
    has_more: boolean;
    /**
     * 
     * @type {string}
     * @memberof FindingList
     */
    next_page_url: string | null;
    /**
     * 
     * @type {string}
     * @memberof FindingList
     */
    previous_page_url: string | null;
    /**
     * Date-bucket grouping (`Today`, `Yesterday`, ISO date strings) over the rows on the current page. Walk `next_page_url` to materialize earlier groups.
     * @type {{ [key: string]: Array<Finding>; }}
     * @memberof FindingList
     */
    grouped: { [key: string]: Array<Finding>; };
}
/**
 * A named group of findings (research bundle). Owner-scoped — excludes `account_id`, `organization_id`, `workspace_id` (caller is implicitly the owner).
 * @export
 * @interface FindingSet
 */
export interface FindingSet {
    /**
     * Prefixed resource ID. Wire form: `fset_<base58>`.
     * @type {string}
     * @memberof FindingSet
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof FindingSet
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof FindingSet
     */
    description: string | null;
    /**
     * 
     * @type {string}
     * @memberof FindingSet
     */
    content: string | null;
    /**
     * 
     * @type {Array<string>}
     * @memberof FindingSet
     */
    finding_ids: Array<string>;
    /**
     * 
     * @type {number}
     * @memberof FindingSet
     */
    findings_count: number;
    /**
     * 
     * @type {string}
     * @memberof FindingSet
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof FindingSet
     */
    updated_at: string;
}
/**
 * 
 * @export
 * @interface FindingSetEnvelope
 */
export interface FindingSetEnvelope {
    /**
     * 
     * @type {FindingSet}
     * @memberof FindingSetEnvelope
     */
    finding_set: FindingSet;
}
/**
 * 
 * @export
 * @interface FindingSetList
 */
export interface FindingSetList {
    /**
     * 
     * @type {Array<FindingSet>}
     * @memberof FindingSetList
     */
    data: Array<FindingSet>;
    /**
     * 
     * @type {boolean}
     * @memberof FindingSetList
     */
    has_more: boolean;
    /**
     * 
     * @type {string}
     * @memberof FindingSetList
     */
    next_page_url: string | null;
    /**
     * 
     * @type {string}
     * @memberof FindingSetList
     */
    previous_page_url: string | null;
}
/**
 * A finding-set plus the materialized findings — used by the detail view so the client renders the set without an N+1.
 * @export
 * @interface FindingSetWithFindings
 */
export interface FindingSetWithFindings {
    /**
     * 
     * @type {FindingSet}
     * @memberof FindingSetWithFindings
     */
    finding_set: FindingSet;
    /**
     * 
     * @type {Array<Finding>}
     * @memberof FindingSetWithFindings
     */
    findings: Array<Finding>;
}

/**
 * 
 * @export
 */
export const FindingSourceType = {
    chat_message: 'chat-message',
    text_selection: 'text-selection'
} as const;
export type FindingSourceType = typeof FindingSourceType[keyof typeof FindingSourceType];

/**
 * 
 * @export
 * @interface FindingTrashList
 */
export interface FindingTrashList {
    [key: string]: any | any;
    /**
     * 
     * @type {Array<Finding>}
     * @memberof FindingTrashList
     */
    data: Array<Finding>;
    /**
     * 
     * @type {FindingTrashListMeta}
     * @memberof FindingTrashList
     */
    meta: FindingTrashListMeta;
}
/**
 * 
 * @export
 * @interface FindingTrashListMeta
 */
export interface FindingTrashListMeta {
    /**
     * 
     * @type {number}
     * @memberof FindingTrashListMeta
     */
    total: number;
}
/**
 * A folder — owner-scoped grouping primitive for WorkItems / Pages. Excludes `organization_id`, `workspace_id`, `deleted_at` (RLS / lifecycle plumbing).
 * @export
 * @interface Folder
 */
export interface Folder {
    /**
     * Prefixed resource ID. Wire form: `fld_<base58>`.
     * @type {string}
     * @memberof Folder
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof Folder
     */
    name: string;
    /**
     * Prefixed resource ID. Wire form: `fld_<base58>`.
     * @type {string}
     * @memberof Folder
     */
    parent_id: string | null;
    /**
     * 
     * @type {number}
     * @memberof Folder
     */
    position: number;
    /**
     * 
     * @type {any}
     * @memberof Folder
     */
    icon: any | null;
    /**
     * 
     * @type {any}
     * @memberof Folder
     */
    view_settings: any | null;
    /**
     * 
     * @type {boolean}
     * @memberof Folder
     */
    archived: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof Folder
     */
    in_trash: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof Folder
     */
    pinned: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof Folder
     */
    is_personal: boolean;
    /**
     * Prefixed resource ID. Wire form: `ws_<base58>`.
     * @type {string}
     * @memberof Folder
     */
    workspace_id: string;
    /**
     * 
     * @type {FolderVisibility}
     * @memberof Folder
     */
    visibility: FolderVisibility;
    /**
     * 
     * @type {string}
     * @memberof Folder
     */
    public_slug: string | null;
    /**
     * 
     * @type {any}
     * @memberof Folder
     */
    roadmap_settings: any | null;
    /**
     * Opaque polymorphic actor reference (Actor Contract; see docs/platform/polymorphic-actor-refactor.md) — raw text post-slice-9, not a prefixed-ID.
     * @type {string}
     * @memberof Folder
     */
    owner_id: string;
    /**
     * 
     * @type {string}
     * @memberof Folder
     */
    owner_name: string | null;
    /**
     * 
     * @type {string}
     * @memberof Folder
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Folder
     */
    updated_at: string;
}


/**
 * 
 * @export
 * @interface FolderBacklogView
 */
export interface FolderBacklogView {
    /**
     * 
     * @type {Folder}
     * @memberof FolderBacklogView
     */
    folder: Folder;
    /**
     * 
     * @type {Array<FolderViewWorkItem>}
     * @memberof FolderBacklogView
     */
    tasks: Array<FolderViewWorkItem>;
}
/**
 * 
 * @export
 * @interface FolderBoardView
 */
export interface FolderBoardView {
    /**
     * 
     * @type {Folder}
     * @memberof FolderBoardView
     */
    folder: Folder;
    /**
     * 
     * @type {{ [key: string]: Array<FolderViewWorkItem>; }}
     * @memberof FolderBoardView
     */
    columns: { [key: string]: Array<FolderViewWorkItem>; };
}
/**
 * 
 * @export
 * @interface FolderCalendarView
 */
export interface FolderCalendarView {
    /**
     * 
     * @type {Folder}
     * @memberof FolderCalendarView
     */
    folder: Folder;
    /**
     * 
     * @type {{ [key: string]: Array<FolderViewWorkItem>; }}
     * @memberof FolderCalendarView
     */
    tasks_by_date: { [key: string]: Array<FolderViewWorkItem>; };
}
/**
 * 
 * @export
 * @interface FolderEnvelope
 */
export interface FolderEnvelope {
    /**
     * 
     * @type {Folder}
     * @memberof FolderEnvelope
     */
    folder: Folder;
}

/**
 * 
 * @export
 */
export const FolderScope = {
    personal: 'personal',
    team: 'team'
} as const;
export type FolderScope = typeof FolderScope[keyof typeof FolderScope];

/**
 * Wrapped in `{ data: ... }` per the existing service shape.
 * @export
 * @interface FolderTogglePinResponse
 */
export interface FolderTogglePinResponse {
    /**
     * 
     * @type {Folder}
     * @memberof FolderTogglePinResponse
     */
    data: Folder;
}
/**
 * Minimal projection of a WorkItem as it appears in folder views. Distinct from WorkItem because view services currently join only the state key (shape pending view-service rewrite).
 * @export
 * @interface FolderViewWorkItem
 */
export interface FolderViewWorkItem {
    /**
     * Prefixed resource ID. Wire form: `wi_<base58>`.
     * @type {string}
     * @memberof FolderViewWorkItem
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof FolderViewWorkItem
     */
    title: string;
    /**
     * 
     * @type {string}
     * @memberof FolderViewWorkItem
     */
    status: string;
    /**
     * 
     * @type {string}
     * @memberof FolderViewWorkItem
     */
    priority: FolderViewWorkItemPriorityEnum;
    /**
     * 
     * @type {number}
     * @memberof FolderViewWorkItem
     */
    position: number;
    /**
     * Prefixed resource ID. Wire form: `acc_<base58>`.
     * @type {string}
     * @memberof FolderViewWorkItem
     */
    assignee_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof FolderViewWorkItem
     */
    due_date: string | null;
    /**
     * 
     * @type {string}
     * @memberof FolderViewWorkItem
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof FolderViewWorkItem
     */
    updated_at: string;
}


/**
 * @export
 */
export const FolderViewWorkItemPriorityEnum = {
    none: 'none',
    low: 'low',
    medium: 'medium',
    high: 'high',
    urgent: 'urgent'
} as const;
export type FolderViewWorkItemPriorityEnum = typeof FolderViewWorkItemPriorityEnum[keyof typeof FolderViewWorkItemPriorityEnum];


/**
 * 
 * @export
 */
export const FolderVisibility = {
    private: 'private',
    internal: 'internal',
    public: 'public'
} as const;
export type FolderVisibility = typeof FolderVisibility[keyof typeof FolderVisibility];

/**
 * 
 * @export
 * @interface FoldersEnvelope
 */
export interface FoldersEnvelope {
    /**
     * 
     * @type {Array<Folder>}
     * @memberof FoldersEnvelope
     */
    folders: Array<Folder>;
}
/**
 * 
 * @export
 * @interface FoldersList
 */
export interface FoldersList {
    /**
     * 
     * @type {Array<Folder>}
     * @memberof FoldersList
     */
    data: Array<Folder>;
    /**
     * 
     * @type {boolean}
     * @memberof FoldersList
     */
    has_more: boolean;
    /**
     * 
     * @type {string}
     * @memberof FoldersList
     */
    next_page_url: string | null;
    /**
     * 
     * @type {string}
     * @memberof FoldersList
     */
    previous_page_url: string | null;
}
/**
 * 
 * @export
 * @interface FounderBriefItem
 */
export interface FounderBriefItem {
    /**
     * 
     * @type {string}
     * @memberof FounderBriefItem
     */
    title: string;
    /**
     * 
     * @type {string}
     * @memberof FounderBriefItem
     */
    reason: string;
    /**
     * 
     * @type {string}
     * @memberof FounderBriefItem
     */
    severity: FounderBriefItemSeverityEnum;
    /**
     * 
     * @type {Array<string>}
     * @memberof FounderBriefItem
     */
    sources: Array<string>;
}


/**
 * @export
 */
export const FounderBriefItemSeverityEnum = {
    low: 'low',
    medium: 'medium',
    high: 'high'
} as const;
export type FounderBriefItemSeverityEnum = typeof FounderBriefItemSeverityEnum[keyof typeof FounderBriefItemSeverityEnum];

/**
 * 
 * @export
 * @interface FounderBriefOutput
 */
export interface FounderBriefOutput {
    /**
     * 
     * @type {Array<FounderBriefItem>}
     * @memberof FounderBriefOutput
     */
    top_risks: Array<FounderBriefItem>;
    /**
     * 
     * @type {Array<FounderBriefItem>}
     * @memberof FounderBriefOutput
     */
    blocked_execution: Array<FounderBriefItem>;
    /**
     * 
     * @type {Array<FounderBriefItem>}
     * @memberof FounderBriefOutput
     */
    slipping_commitments: Array<FounderBriefItem>;
    /**
     * 
     * @type {Array<FounderBriefItem>}
     * @memberof FounderBriefOutput
     */
    needs_founder_attention: Array<FounderBriefItem>;
    /**
     * 
     * @type {Array<FounderBriefItem>}
     * @memberof FounderBriefOutput
     */
    missing_context: Array<FounderBriefItem>;
    /**
     * 
     * @type {Array<ResponseSource>}
     * @memberof FounderBriefOutput
     */
    sources: Array<ResponseSource>;
}
/**
 * 
 * @export
 * @interface GrantRole
 */
export interface GrantRole {
    /**
     * Prefixed resource ID. Wire form: `acc_<base58>`.
     * @type {string}
     * @memberof GrantRole
     */
    account_id: string;
    /**
     * 
     * @type {string}
     * @memberof GrantRole
     */
    role: string;
    /**
     * 
     * @type {string}
     * @memberof GrantRole
     */
    expires_at?: string;
}
/**
 * Serialized graphology graph + community metadata + stats. Returned by `GET /v1/search/graph/view`. Internal-shaped bags are surfaced as `unknown` because the wire format is the FE's graphology-import target.
 * @export
 * @interface GraphView
 */
export interface GraphView {
    /**
     * 
     * @type {any}
     * @memberof GraphView
     */
    graph: any | null;
    /**
     * 
     * @type {any}
     * @memberof GraphView
     */
    communities: any | null;
    /**
     * 
     * @type {any}
     * @memberof GraphView
     */
    stats: any | null;
}
/**
 * 
 * @export
 * @interface HybridSearchRequest
 */
export interface HybridSearchRequest {
    /**
     * 
     * @type {string}
     * @memberof HybridSearchRequest
     */
    query: string;
    /**
     * 
     * @type {Array<string>}
     * @memberof HybridSearchRequest
     */
    source_types?: Array<string>;
    /**
     * 
     * @type {number}
     * @memberof HybridSearchRequest
     */
    limit?: number;
    /**
     * 
     * @type {number}
     * @memberof HybridSearchRequest
     */
    offset?: number;
    /**
     * 
     * @type {boolean}
     * @memberof HybridSearchRequest
     */
    enable_fts?: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof HybridSearchRequest
     */
    enable_vector?: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof HybridSearchRequest
     */
    enable_graph?: boolean;
}
/**
 * Hybrid-retrieval response — fused FTS + vector + graph + community ranking. `total_results` is the count returned, not a global cardinality estimate (search is top-k, not paginated).
 * @export
 * @interface HybridSearchResponse
 */
export interface HybridSearchResponse {
    /**
     * 
     * @type {Array<SearchHit>}
     * @memberof HybridSearchResponse
     */
    results: Array<SearchHit>;
    /**
     * 
     * @type {string}
     * @memberof HybridSearchResponse
     */
    query: string;
    /**
     * 
     * @type {number}
     * @memberof HybridSearchResponse
     */
    total_results: number;
    /**
     * 
     * @type {Array<string>}
     * @memberof HybridSearchResponse
     */
    search_methods: Array<string>;
    /**
     * 
     * @type {SearchRerank}
     * @memberof HybridSearchResponse
     */
    rerank: SearchRerank | null;
    /**
     * 
     * @type {SearchTiming}
     * @memberof HybridSearchResponse
     */
    timing: SearchTiming;
}
/**
 * A time-boxed iteration. Three-state lifecycle (`planning` → `active` → `completed`), workspace-scoped, optional start/end dates.
 * @export
 * @interface Iteration
 */
export interface Iteration {
    /**
     * Prefixed resource ID. Wire form: `it_<base58>`.
     * @type {string}
     * @memberof Iteration
     */
    id: string;
    /**
     * Prefixed resource ID. Wire form: `ws_<base58>`.
     * @type {string}
     * @memberof Iteration
     */
    workspace_id: string;
    /**
     * 
     * @type {string}
     * @memberof Iteration
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof Iteration
     */
    goal: string | null;
    /**
     * 
     * @type {IterationStatus}
     * @memberof Iteration
     */
    status: IterationStatus;
    /**
     * 
     * @type {string}
     * @memberof Iteration
     */
    start_date: string | null;
    /**
     * 
     * @type {string}
     * @memberof Iteration
     */
    end_date: string | null;
    /**
     * 
     * @type {number}
     * @memberof Iteration
     */
    position: number;
    /**
     * 
     * @type {string}
     * @memberof Iteration
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Iteration
     */
    updated_at: string;
    /**
     * 
     * @type {string}
     * @memberof Iteration
     */
    completed_at: string | null;
}


/**
 * 
 * @export
 * @interface IterationActiveEnvelope
 */
export interface IterationActiveEnvelope {
    /**
     * 
     * @type {Iteration}
     * @memberof IterationActiveEnvelope
     */
    iteration: Iteration | null;
}
/**
 * 
 * @export
 * @interface IterationEnvelope
 */
export interface IterationEnvelope {
    /**
     * 
     * @type {Iteration}
     * @memberof IterationEnvelope
     */
    iteration: Iteration;
}
/**
 * 
 * @export
 * @interface IterationListEnvelope
 */
export interface IterationListEnvelope {
    /**
     * 
     * @type {Array<Iteration>}
     * @memberof IterationListEnvelope
     */
    data: Array<Iteration>;
    /**
     * 
     * @type {boolean}
     * @memberof IterationListEnvelope
     */
    has_more: boolean;
    /**
     * 
     * @type {string}
     * @memberof IterationListEnvelope
     */
    next_page_url: string | null;
    /**
     * 
     * @type {string}
     * @memberof IterationListEnvelope
     */
    previous_page_url: string | null;
}
/**
 * Snapshot of work-item throughput and estimate totals for an iteration. SDK callers derive their own ratios (progress %, velocity, etc.).
 * @export
 * @interface IterationMetrics
 */
export interface IterationMetrics {
    /**
     * 
     * @type {number}
     * @memberof IterationMetrics
     */
    total_work_items: number;
    /**
     * 
     * @type {number}
     * @memberof IterationMetrics
     */
    completed_work_items: number;
    /**
     * 
     * @type {number}
     * @memberof IterationMetrics
     */
    total_points: number;
    /**
     * 
     * @type {number}
     * @memberof IterationMetrics
     */
    completed_points: number;
}
/**
 * 
 * @export
 * @interface IterationMetricsEnvelope
 */
export interface IterationMetricsEnvelope {
    /**
     * 
     * @type {IterationMetrics}
     * @memberof IterationMetricsEnvelope
     */
    metrics: IterationMetrics;
}

/**
 * 
 * @export
 */
export const IterationStatus = {
    planning: 'planning',
    active: 'active',
    completed: 'completed'
} as const;
export type IterationStatus = typeof IterationStatus[keyof typeof IterationStatus];

/**
 * Entity row + where it is mentioned (joined to task / page titles) + first-degree neighbors. Backs the click-into-node details panel.
 * @export
 * @interface KgEntityDetail
 */
export interface KgEntityDetail {
    [key: string]: any | any;
    /**
     * 
     * @type {KgEntityDetailEntity}
     * @memberof KgEntityDetail
     */
    entity: KgEntityDetailEntity;
    /**
     * 
     * @type {KgEntityDetailCommunity}
     * @memberof KgEntityDetail
     */
    community: KgEntityDetailCommunity;
    /**
     * 
     * @type {Array<KgEntityMention>}
     * @memberof KgEntityDetail
     */
    mentions: Array<KgEntityMention>;
    /**
     * 
     * @type {Array<KgEntityNeighbor>}
     * @memberof KgEntityDetail
     */
    neighbors: Array<KgEntityNeighbor>;
}
/**
 * 
 * @export
 * @interface KgEntityDetailCommunity
 */
export interface KgEntityDetailCommunity {
    /**
     * 
     * @type {number}
     * @memberof KgEntityDetailCommunity
     */
    community_id: number;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof KgEntityDetailCommunity
     */
    title: AccountMembershipOrganizationBillingEmail;
}
/**
 * 
 * @export
 * @interface KgEntityDetailCommunityAnyOf
 */
export interface KgEntityDetailCommunityAnyOf {
    /**
     * 
     * @type {number}
     * @memberof KgEntityDetailCommunityAnyOf
     */
    community_id: number;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof KgEntityDetailCommunityAnyOf
     */
    title: AccountMembershipOrganizationBillingEmail;
}
/**
 * 
 * @export
 * @interface KgEntityDetailEntity
 */
export interface KgEntityDetailEntity {
    /**
     * 
     * @type {string}
     * @memberof KgEntityDetailEntity
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof KgEntityDetailEntity
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof KgEntityDetailEntity
     */
    type: string;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof KgEntityDetailEntity
     */
    description: AccountMembershipOrganizationBillingEmail;
    /**
     * 
     * @type {number}
     * @memberof KgEntityDetailEntity
     */
    mention_count: number;
    /**
     * 
     * @type {SearchHitGraphDepth}
     * @memberof KgEntityDetailEntity
     */
    community_id: SearchHitGraphDepth | null;
    /**
     * 
     * @type {string}
     * @memberof KgEntityDetailEntity
     */
    origin: KgEntityDetailEntityOriginEnum;
}


/**
 * @export
 */
export const KgEntityDetailEntityOriginEnum = {
    structural: 'structural',
    extracted: 'extracted',
    manual: 'manual'
} as const;
export type KgEntityDetailEntityOriginEnum = typeof KgEntityDetailEntityOriginEnum[keyof typeof KgEntityDetailEntityOriginEnum];

/**
 * 
 * @export
 * @interface KgEntityMention
 */
export interface KgEntityMention {
    /**
     * 
     * @type {string}
     * @memberof KgEntityMention
     */
    source_type: string;
    /**
     * 
     * @type {string}
     * @memberof KgEntityMention
     */
    source_id: string;
    /**
     * 
     * @type {string}
     * @memberof KgEntityMention
     */
    title: string | null;
    /**
     * 
     * @type {string}
     * @memberof KgEntityMention
     */
    identifier: string | null;
    /**
     * 
     * @type {string}
     * @memberof KgEntityMention
     */
    created_at: string;
}
/**
 * 
 * @export
 * @interface KgEntityNeighbor
 */
export interface KgEntityNeighbor {
    /**
     * 
     * @type {string}
     * @memberof KgEntityNeighbor
     */
    entity_id: string;
    /**
     * 
     * @type {string}
     * @memberof KgEntityNeighbor
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof KgEntityNeighbor
     */
    entity_type: string;
    /**
     * 
     * @type {string}
     * @memberof KgEntityNeighbor
     */
    relationship_type: string;
    /**
     * 
     * @type {number}
     * @memberof KgEntityNeighbor
     */
    weight: number;
    /**
     * 
     * @type {number}
     * @memberof KgEntityNeighbor
     */
    mention_count: number;
    /**
     * 
     * @type {number}
     * @memberof KgEntityNeighbor
     */
    community_id: number | null;
}
/**
 * A workspace-scoped taxonomy tag for WorkItems. `key` is a stable slug; `name` is the display label.
 * @export
 * @interface Label
 */
export interface Label {
    /**
     * Prefixed resource ID. Wire form: `lbl_<base58>`.
     * @type {string}
     * @memberof Label
     */
    id: string;
    /**
     * Prefixed resource ID. Wire form: `ws_<base58>`.
     * @type {string}
     * @memberof Label
     */
    workspace_id: string;
    /**
     * 
     * @type {string}
     * @memberof Label
     */
    key: string;
    /**
     * 
     * @type {string}
     * @memberof Label
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof Label
     */
    color: string;
    /**
     * 
     * @type {string}
     * @memberof Label
     */
    description: string | null;
    /**
     * 
     * @type {string}
     * @memberof Label
     */
    template_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof Label
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Label
     */
    updated_at: string;
}
/**
 * 
 * @export
 * @interface LabelEnvelope
 */
export interface LabelEnvelope {
    /**
     * 
     * @type {Label}
     * @memberof LabelEnvelope
     */
    label: Label;
}
/**
 * 
 * @export
 * @interface LabelListEnvelope
 */
export interface LabelListEnvelope {
    /**
     * 
     * @type {Array<Label>}
     * @memberof LabelListEnvelope
     */
    data: Array<Label>;
}
/**
 * Public-facing projection of an LLM model. Strips internal fields from the `models` row (per-1k-token pricing, provider credentials, deactivation flags, rate-limit buckets) — `GET /models` is a picker catalog, not an admin view.
 * @export
 * @interface Model
 */
export interface Model {
    /**
     * Canonical model id — what the client sends as `model` on chat / completion requests (e.g. `gpt-5.4-nano`, `claude-haiku-4-5`).
     * @type {string}
     * @memberof Model
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof Model
     */
    display_name: string;
    /**
     * Underlying provider — `openai`, `anthropic`, `mock` (the `mock` provider only appears when `LLM_MOCK_ENABLED=true`).
     * @type {string}
     * @memberof Model
     */
    provider: string;
    /**
     * Maximum context window in tokens.
     * @type {number}
     * @memberof Model
     */
    context_window: number;
    /**
     * 
     * @type {string}
     * @memberof Model
     */
    description: string;
}
/**
 * List-envelope shape matching the Stripe v1/v2 idiom of `{ <resource>: [...] }` — bare list, no pagination metadata (catalog is small enough that pagination isn't worth it).
 * @export
 * @interface ModelList
 */
export interface ModelList {
    /**
     * 
     * @type {Array<Model>}
     * @memberof ModelList
     */
    models: Array<Model>;
}
/**
 * 
 * @export
 * @interface MoveFolder
 */
export interface MoveFolder {
    /**
     * Prefixed resource ID. Wire form: `fld_<base58>`.
     * @type {string}
     * @memberof MoveFolder
     */
    parent_id?: string | null;
    /**
     * 
     * @type {number}
     * @memberof MoveFolder
     */
    position?: number;
}
/**
 * 
 * @export
 * @interface MovePage
 */
export interface MovePage {
    /**
     * Prefixed resource ID. Wire form: `fld_<base58>`.
     * @type {string}
     * @memberof MovePage
     */
    folder_id?: string | null;
    /**
     * 
     * @type {number}
     * @memberof MovePage
     */
    position?: number;
}
/**
 * Per-account opt-in to receive notifications when the matching event fires. `scope_type`+`scope_id` = scoped subscription; omitting both = global subscription for the caller account.
 * @export
 * @interface NotificationSubscription
 */
export interface NotificationSubscription {
    /**
     * Prefixed resource ID. Wire form: `nsub_<base58>`.
     * @type {string}
     * @memberof NotificationSubscription
     */
    id: string;
    /**
     * Opaque polymorphic actor reference (Actor Contract — see docs/platform/polymorphic-actor-refactor.md). Raw text, not a prefixed-ID.
     * @type {string}
     * @memberof NotificationSubscription
     */
    account_id: string;
    /**
     * 
     * @type {string}
     * @memberof NotificationSubscription
     */
    account_name: string | null;
    /**
     * 
     * @type {string}
     * @memberof NotificationSubscription
     */
    event_type: string;
    /**
     * 
     * @type {string}
     * @memberof NotificationSubscription
     */
    scope_type: NotificationSubscriptionScopeTypeEnum | null;
    /**
     * 
     * @type {string}
     * @memberof NotificationSubscription
     */
    scope_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof NotificationSubscription
     */
    created_at: string;
}


/**
 * @export
 */
export const NotificationSubscriptionScopeTypeEnum = {
    work_item: 'work_item',
    comment: 'comment',
    project: 'project',
    feature_request: 'feature_request'
} as const;
export type NotificationSubscriptionScopeTypeEnum = typeof NotificationSubscriptionScopeTypeEnum[keyof typeof NotificationSubscriptionScopeTypeEnum];

/**
 * 
 * @export
 * @interface NotificationSubscriptionEnvelope
 */
export interface NotificationSubscriptionEnvelope {
    /**
     * 
     * @type {NotificationSubscription}
     * @memberof NotificationSubscriptionEnvelope
     */
    subscription: NotificationSubscription;
}
/**
 * 
 * @export
 * @interface NotificationSubscriptionListEnvelope
 */
export interface NotificationSubscriptionListEnvelope {
    /**
     * 
     * @type {Array<NotificationSubscription>}
     * @memberof NotificationSubscriptionListEnvelope
     */
    data: Array<NotificationSubscription>;
}
/**
 * RFC 8414 Authorization Server Metadata. Spec-pinned shape; fields beyond what we surface today are added on demand.
 * @export
 * @interface OauthAuthorizationServerMetadata
 */
export interface OauthAuthorizationServerMetadata {
    /**
     * 
     * @type {string}
     * @memberof OauthAuthorizationServerMetadata
     */
    issuer: string;
    /**
     * 
     * @type {string}
     * @memberof OauthAuthorizationServerMetadata
     */
    authorization_endpoint: string;
    /**
     * 
     * @type {string}
     * @memberof OauthAuthorizationServerMetadata
     */
    token_endpoint: string;
    /**
     * 
     * @type {string}
     * @memberof OauthAuthorizationServerMetadata
     */
    registration_endpoint?: string;
    /**
     * 
     * @type {string}
     * @memberof OauthAuthorizationServerMetadata
     */
    revocation_endpoint?: string;
    /**
     * 
     * @type {string}
     * @memberof OauthAuthorizationServerMetadata
     */
    pushed_authorization_request_endpoint?: string;
    /**
     * 
     * @type {boolean}
     * @memberof OauthAuthorizationServerMetadata
     */
    require_pushed_authorization_requests?: boolean;
    /**
     * 
     * @type {Array<string>}
     * @memberof OauthAuthorizationServerMetadata
     */
    response_types_supported: Array<string>;
    /**
     * 
     * @type {Array<string>}
     * @memberof OauthAuthorizationServerMetadata
     */
    grant_types_supported: Array<string>;
    /**
     * 
     * @type {Array<string>}
     * @memberof OauthAuthorizationServerMetadata
     */
    code_challenge_methods_supported: Array<string>;
    /**
     * 
     * @type {Array<string>}
     * @memberof OauthAuthorizationServerMetadata
     */
    token_endpoint_auth_methods_supported: Array<string>;
    /**
     * 
     * @type {Array<string>}
     * @memberof OauthAuthorizationServerMetadata
     */
    scopes_supported: Array<string>;
    /**
     * 
     * @type {Array<string>}
     * @memberof OauthAuthorizationServerMetadata
     */
    dpop_signing_alg_values_supported?: Array<string>;
}
/**
 * 
 * @export
 * @interface OauthClientRegistrationRequest
 */
export interface OauthClientRegistrationRequest {
    /**
     * 
     * @type {string}
     * @memberof OauthClientRegistrationRequest
     */
    client_name: string;
    /**
     * 
     * @type {Array<string>}
     * @memberof OauthClientRegistrationRequest
     */
    redirect_uris: Array<string>;
    /**
     * 
     * @type {Array<string>}
     * @memberof OauthClientRegistrationRequest
     */
    grant_types?: Array<OauthClientRegistrationRequestGrantTypesEnum>;
    /**
     * 
     * @type {Array<string>}
     * @memberof OauthClientRegistrationRequest
     */
    response_types?: Array<OauthClientRegistrationRequestResponseTypesEnum>;
    /**
     * 
     * @type {string}
     * @memberof OauthClientRegistrationRequest
     */
    token_endpoint_auth_method?: OauthClientRegistrationRequestTokenEndpointAuthMethodEnum;
}


/**
 * @export
 */
export const OauthClientRegistrationRequestGrantTypesEnum = {
    authorization_code: 'authorization_code',
    refresh_token: 'refresh_token'
} as const;
export type OauthClientRegistrationRequestGrantTypesEnum = typeof OauthClientRegistrationRequestGrantTypesEnum[keyof typeof OauthClientRegistrationRequestGrantTypesEnum];

/**
 * @export
 */
export const OauthClientRegistrationRequestResponseTypesEnum = {
    code: 'code'
} as const;
export type OauthClientRegistrationRequestResponseTypesEnum = typeof OauthClientRegistrationRequestResponseTypesEnum[keyof typeof OauthClientRegistrationRequestResponseTypesEnum];

/**
 * @export
 */
export const OauthClientRegistrationRequestTokenEndpointAuthMethodEnum = {
    client_secret_basic: 'client_secret_basic',
    none: 'none'
} as const;
export type OauthClientRegistrationRequestTokenEndpointAuthMethodEnum = typeof OauthClientRegistrationRequestTokenEndpointAuthMethodEnum[keyof typeof OauthClientRegistrationRequestTokenEndpointAuthMethodEnum];

/**
 * RFC 7591 §3.2.1 client registration response. `client_secret` is returned exactly once for confidential clients; public clients (`token_endpoint_auth_method=none`) omit it.
 * @export
 * @interface OauthClientRegistrationResponse
 */
export interface OauthClientRegistrationResponse {
    /**
     * 
     * @type {string}
     * @memberof OauthClientRegistrationResponse
     */
    client_id: string;
    /**
     * 
     * @type {string}
     * @memberof OauthClientRegistrationResponse
     */
    client_secret?: string;
    /**
     * 
     * @type {number}
     * @memberof OauthClientRegistrationResponse
     */
    client_id_issued_at: number;
    /**
     * 
     * @type {string}
     * @memberof OauthClientRegistrationResponse
     */
    client_name: string;
    /**
     * 
     * @type {Array<string>}
     * @memberof OauthClientRegistrationResponse
     */
    redirect_uris: Array<string>;
    /**
     * 
     * @type {Array<string>}
     * @memberof OauthClientRegistrationResponse
     */
    grant_types: Array<string>;
    /**
     * 
     * @type {Array<string>}
     * @memberof OauthClientRegistrationResponse
     */
    response_types: Array<string>;
    /**
     * 
     * @type {string}
     * @memberof OauthClientRegistrationResponse
     */
    token_endpoint_auth_method: string;
}
/**
 * 
 * @export
 * @interface OauthConsentDecision
 */
export interface OauthConsentDecision {
    /**
     * Prefixed resource ID. Wire form: `oapend_<base58>`.
     * @type {string}
     * @memberof OauthConsentDecision
     */
    authorize_id: string;
}
/**
 * Consent-screen boot data. Private contract between this backend and the consent UI in `web-app`. NOT an OAuth-spec shape; fields are snake_case in line with the platform-wide field-naming convention.
 * @export
 * @interface OauthConsentPendingResponse
 */
export interface OauthConsentPendingResponse {
    /**
     * 
     * @type {string}
     * @memberof OauthConsentPendingResponse
     */
    authorize_id: string;
    /**
     * 
     * @type {string}
     * @memberof OauthConsentPendingResponse
     */
    client_id: string;
    /**
     * 
     * @type {string}
     * @memberof OauthConsentPendingResponse
     */
    client_name: string;
    /**
     * 
     * @type {string}
     * @memberof OauthConsentPendingResponse
     */
    redirect_uri: string;
    /**
     * 
     * @type {Array<string>}
     * @memberof OauthConsentPendingResponse
     */
    scope: Array<string>;
    /**
     * 
     * @type {string}
     * @memberof OauthConsentPendingResponse
     */
    resource: string | null;
    /**
     * 
     * @type {string}
     * @memberof OauthConsentPendingResponse
     */
    expires_at: string;
}
/**
 * Fully-built client callback URL. The consent UI navigates the browser to this URL; it carries either the auth `code` (approve) or `error=access_denied` (deny).
 * @export
 * @interface OauthConsentRedirectResponse
 */
export interface OauthConsentRedirectResponse {
    /**
     * 
     * @type {string}
     * @memberof OauthConsentRedirectResponse
     */
    redirect_url: string;
}
/**
 * RFC 6749 §5.2 error envelope. `error` is the spec-defined code (`invalid_grant`, `invalid_client`, `invalid_request`, ...). `error_description` is the human-readable detail.
 * @export
 * @interface OauthErrorResponse
 */
export interface OauthErrorResponse {
    /**
     * 
     * @type {string}
     * @memberof OauthErrorResponse
     */
    error: string;
    /**
     * 
     * @type {string}
     * @memberof OauthErrorResponse
     */
    error_description?: string;
}
/**
 * RFC 9126 Pushed Authorization Request response. The client redirects the browser to `/oauth/authorize?request_uri=...&client_id=...` instead of carrying the full param set on the redirect URL.
 * @export
 * @interface OauthParResponse
 */
export interface OauthParResponse {
    /**
     * 
     * @type {string}
     * @memberof OauthParResponse
     */
    request_uri: string;
    /**
     * 
     * @type {number}
     * @memberof OauthParResponse
     */
    expires_in: number;
}
/**
 * RFC 9728 Protected Resource Metadata.
 * @export
 * @interface OauthProtectedResourceMetadata
 */
export interface OauthProtectedResourceMetadata {
    /**
     * 
     * @type {string}
     * @memberof OauthProtectedResourceMetadata
     */
    resource: string;
    /**
     * 
     * @type {Array<string>}
     * @memberof OauthProtectedResourceMetadata
     */
    authorization_servers: Array<string>;
    /**
     * 
     * @type {Array<string>}
     * @memberof OauthProtectedResourceMetadata
     */
    scopes_supported: Array<string>;
    /**
     * 
     * @type {Array<string>}
     * @memberof OauthProtectedResourceMetadata
     */
    bearer_methods_supported?: Array<string>;
    /**
     * 
     * @type {Array<string>}
     * @memberof OauthProtectedResourceMetadata
     */
    resource_signing_alg_values_supported?: Array<string>;
}
/**
 * RFC 6749 §5.1 token response. `token_type=DPoP` signals the client MUST present a matching DPoP proof on every request to the resource server.
 * @export
 * @interface OauthTokenResponse
 */
export interface OauthTokenResponse {
    /**
     * 
     * @type {string}
     * @memberof OauthTokenResponse
     */
    access_token: string;
    /**
     * 
     * @type {string}
     * @memberof OauthTokenResponse
     */
    token_type: OauthTokenResponseTokenTypeEnum;
    /**
     * 
     * @type {number}
     * @memberof OauthTokenResponse
     */
    expires_in: number;
    /**
     * 
     * @type {string}
     * @memberof OauthTokenResponse
     */
    refresh_token: string;
    /**
     * 
     * @type {string}
     * @memberof OauthTokenResponse
     */
    scope: string;
}


/**
 * @export
 */
export const OauthTokenResponseTokenTypeEnum = {
    Bearer: 'Bearer',
    DPoP: 'DPoP'
} as const;
export type OauthTokenResponseTokenTypeEnum = typeof OauthTokenResponseTokenTypeEnum[keyof typeof OauthTokenResponseTokenTypeEnum];

/**
 * Public projection of a `control.organizations` row. Excludes `account_id` (owner is exposed via the members list) and `graph_visibility_mode` (internal RAG retrieval setting).
 * @export
 * @interface Organization
 */
export interface Organization {
    /**
     * Prefixed resource ID. Wire form: `org_<base58>`.
     * @type {string}
     * @memberof Organization
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof Organization
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof Organization
     */
    billing_email: string | null;
    /**
     * 
     * @type {boolean}
     * @memberof Organization
     */
    allow_overage: boolean;
    /**
     * 
     * @type {{ [key: string]: string; }}
     * @memberof Organization
     */
    metadata: { [key: string]: string; };
    /**
     * 
     * @type {string}
     * @memberof Organization
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Organization
     */
    updated_at: string;
}
/**
 * `OrganizationSignupEnvelope` when the request supplied `owner_email` (public signup); `OrganizationCreatedEnvelope` when the request was authed (existing user spinning up a second tenant).
 * @export
 * @interface OrganizationCreateResponse
 */
export interface OrganizationCreateResponse {
    /**
     * 
     * @type {Organization}
     * @memberof OrganizationCreateResponse
     */
    organization: Organization;
    /**
     * 
     * @type {OrganizationMember}
     * @memberof OrganizationCreateResponse
     */
    membership: OrganizationMember;
    /**
     * 
     * @type {OrganizationSignupEnvelopeOwner}
     * @memberof OrganizationCreateResponse
     */
    owner: OrganizationSignupEnvelopeOwner;
}
/**
 * Authed-create envelope — the caller already knows their own account id, so the freshly-issued membership is enough.
 * @export
 * @interface OrganizationCreatedEnvelope
 */
export interface OrganizationCreatedEnvelope {
    /**
     * 
     * @type {Organization}
     * @memberof OrganizationCreatedEnvelope
     */
    organization: Organization;
    /**
     * 
     * @type {OrganizationMember}
     * @memberof OrganizationCreatedEnvelope
     */
    membership: OrganizationMember;
}
/**
 * Membership row joining an account to an organization with a role. The owner is always present with role=`owner`. `account_email` and `account_full_name` are populated on bulk list (`GET /organizations/:id/members`) but absent from single-row mutation responses.
 * @export
 * @interface OrganizationMember
 */
export interface OrganizationMember {
    /**
     * Prefixed resource ID. Wire form: `mem_<base58>`.
     * @type {string}
     * @memberof OrganizationMember
     */
    id: string;
    /**
     * Prefixed resource ID. Wire form: `acc_<base58>`.
     * @type {string}
     * @memberof OrganizationMember
     */
    account_id: string;
    /**
     * Prefixed resource ID. Wire form: `org_<base58>`.
     * @type {string}
     * @memberof OrganizationMember
     */
    organization_id: string;
    /**
     * 
     * @type {OrganizationMemberRole}
     * @memberof OrganizationMember
     */
    role: OrganizationMemberRole;
    /**
     * Prefixed resource ID. Wire form: `acc_<base58>`.
     * @type {string}
     * @memberof OrganizationMember
     */
    invited_by: string | null;
    /**
     * 
     * @type {string}
     * @memberof OrganizationMember
     */
    invited_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof OrganizationMember
     */
    joined_at: string | null;
    /**
     * 
     * @type {boolean}
     * @memberof OrganizationMember
     */
    is_active: boolean;
    /**
     * 
     * @type {string}
     * @memberof OrganizationMember
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof OrganizationMember
     */
    updated_at: string;
    /**
     * 
     * @type {string}
     * @memberof OrganizationMember
     */
    account_email?: string;
    /**
     * 
     * @type {string}
     * @memberof OrganizationMember
     */
    account_full_name?: string | null;
}



/**
 * 
 * @export
 */
export const OrganizationMemberRole = {
    owner: 'owner',
    admin: 'admin',
    member: 'member',
    billing: 'billing',
    readonly: 'readonly'
} as const;
export type OrganizationMemberRole = typeof OrganizationMemberRole[keyof typeof OrganizationMemberRole];

/**
 * Public-signup envelope — includes the freshly-created owner identity since the caller has no auth token yet and would otherwise have no way to learn the new account id.
 * @export
 * @interface OrganizationSignupEnvelope
 */
export interface OrganizationSignupEnvelope {
    [key: string]: any | any;
    /**
     * 
     * @type {Organization}
     * @memberof OrganizationSignupEnvelope
     */
    organization: Organization;
    /**
     * 
     * @type {OrganizationSignupEnvelopeOwner}
     * @memberof OrganizationSignupEnvelope
     */
    owner: OrganizationSignupEnvelopeOwner;
    /**
     * 
     * @type {OrganizationMember}
     * @memberof OrganizationSignupEnvelope
     */
    membership: OrganizationMember;
}
/**
 * 
 * @export
 * @interface OrganizationSignupEnvelopeOwner
 */
export interface OrganizationSignupEnvelopeOwner {
    /**
     * Prefixed resource ID. Wire form: `acc_<base58>`.
     * @type {string}
     * @memberof OrganizationSignupEnvelopeOwner
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof OrganizationSignupEnvelopeOwner
     */
    email: string;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof OrganizationSignupEnvelopeOwner
     */
    full_name: AccountMembershipOrganizationBillingEmail;
}
/**
 * A page (rich-text document). Excludes `organization_id`, `workspace_id`, `deleted_at` (RLS / lifecycle plumbing).
 * @export
 * @interface Page
 */
export interface Page {
    /**
     * Prefixed resource ID. Wire form: `pg_<base58>`.
     * @type {string}
     * @memberof Page
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof Page
     */
    title: string;
    /**
     * 
     * @type {string}
     * @memberof Page
     */
    content: string;
    /**
     * Prefixed resource ID. Wire form: `fld_<base58>`.
     * @type {string}
     * @memberof Page
     */
    folder_id: string | null;
    /**
     * 
     * @type {any}
     * @memberof Page
     */
    icon: any | null;
    /**
     * 
     * @type {any}
     * @memberof Page
     */
    cover: any | null;
    /**
     * 
     * @type {number}
     * @memberof Page
     */
    version: number;
    /**
     * 
     * @type {number}
     * @memberof Page
     */
    position: number;
    /**
     * 
     * @type {boolean}
     * @memberof Page
     */
    pinned: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof Page
     */
    archived: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof Page
     */
    in_trash: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof Page
     */
    is_personal: boolean;
    /**
     * Prefixed resource ID. Wire form: `ws_<base58>`.
     * @type {string}
     * @memberof Page
     */
    workspace_id: string;
    /**
     * Opaque polymorphic actor reference (Actor Contract; see docs/platform/polymorphic-actor-refactor.md) — raw text post-slice-9, not a prefixed-ID.
     * @type {string}
     * @memberof Page
     */
    owner_id: string;
    /**
     * 
     * @type {string}
     * @memberof Page
     */
    owner_name: string | null;
    /**
     * 
     * @type {string}
     * @memberof Page
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Page
     */
    updated_at: string;
}
/**
 * 
 * @export
 * @interface PageEnvelope
 */
export interface PageEnvelope {
    /**
     * 
     * @type {Page}
     * @memberof PageEnvelope
     */
    page: Page;
}
/**
 * Narrow search-hit projection. Separate from Page because full page content is huge and the search UI only needs the summary.
 * @export
 * @interface PageSearchResult
 */
export interface PageSearchResult {
    /**
     * Prefixed resource ID. Wire form: `pg_<base58>`.
     * @type {string}
     * @memberof PageSearchResult
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof PageSearchResult
     */
    title: string;
    /**
     * 
     * @type {any}
     * @memberof PageSearchResult
     */
    icon: any | null;
    /**
     * 
     * @type {string}
     * @memberof PageSearchResult
     */
    updated_at: string;
}
/**
 * 
 * @export
 * @interface PagesList
 */
export interface PagesList {
    /**
     * 
     * @type {Array<Page>}
     * @memberof PagesList
     */
    data: Array<Page>;
    /**
     * 
     * @type {boolean}
     * @memberof PagesList
     */
    has_more: boolean;
    /**
     * 
     * @type {string}
     * @memberof PagesList
     */
    next_page_url: string | null;
    /**
     * 
     * @type {string}
     * @memberof PagesList
     */
    previous_page_url: string | null;
}
/**
 * 
 * @export
 * @interface PagesSearchResponse
 */
export interface PagesSearchResponse {
    /**
     * 
     * @type {Array<PageSearchResult>}
     * @memberof PagesSearchResponse
     */
    data: Array<PageSearchResult>;
}

/**
 * Closed enum of dispatchable pending-action types. Each type has exactly one registered `PendingActionHandler` in its owning domain module; approval flips the row to `approved` AND executes the handler in the deciding user’s authenticated context (the OWASP LLM06 mitigation).
 * @export
 */
export const PendingActionType = {
    page_update: 'page.update',
    page_create: 'page.create',
    sprint_create: 'sprint.create',
    work_items_cleanup: 'work_items.cleanup'
} as const;
export type PendingActionType = typeof PendingActionType[keyof typeof PendingActionType];

/**
 * A pending agent-proposed write awaiting human approval. Mitigates OWASP LLM06 (Excessive Agency): the agent proposes; a deciding human approves; the system executes the registered handler in the deciding user’s context. `args` is opaque — shape varies per `action_type`.
 * @export
 * @interface PendingAgentAction
 */
export interface PendingAgentAction {
    /**
     * Prefixed resource ID. Wire form: `pact_<base58>`.
     * @type {string}
     * @memberof PendingAgentAction
     */
    id: string;
    /**
     * Prefixed resource ID. Wire form: `agt_<base58>`.
     * @type {string}
     * @memberof PendingAgentAction
     */
    agent_token_id: string;
    /**
     * 
     * @type {PendingActionType}
     * @memberof PendingAgentAction
     */
    action_type: PendingActionType;
    /**
     * 
     * @type {string}
     * @memberof PendingAgentAction
     */
    resource_type: string;
    /**
     * 
     * @type {string}
     * @memberof PendingAgentAction
     */
    resource_id: string;
    /**
     * 
     * @type {any}
     * @memberof PendingAgentAction
     */
    args: any | null;
    /**
     * 
     * @type {string}
     * @memberof PendingAgentAction
     */
    status: PendingAgentActionStatusEnum;
    /**
     * 
     * @type {string}
     * @memberof PendingAgentAction
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof PendingAgentAction
     */
    expires_at: string;
    /**
     * 
     * @type {string}
     * @memberof PendingAgentAction
     */
    decided_at: string | null;
    /**
     * Prefixed resource ID. Wire form: `acc_<base58>`.
     * @type {string}
     * @memberof PendingAgentAction
     */
    decided_by_account_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof PendingAgentAction
     */
    reject_reason: string | null;
}


/**
 * @export
 */
export const PendingAgentActionStatusEnum = {
    pending: 'pending',
    approved: 'approved',
    rejected: 'rejected',
    expired: 'expired'
} as const;
export type PendingAgentActionStatusEnum = typeof PendingAgentActionStatusEnum[keyof typeof PendingAgentActionStatusEnum];

/**
 * `action` is the post-approval row (status flipped, `decided_by_account_id` + `decided_at` stamped). `result` is the handler’s opaque return — surfaced verbatim so the in-app UI / MCP elicitation client can display "what just happened". Each handler defines its own `result` shape; consumers branch on `action.action_type`.
 * @export
 * @interface PendingAgentActionApprovedEnvelope
 */
export interface PendingAgentActionApprovedEnvelope {
    /**
     * 
     * @type {PendingAgentAction}
     * @memberof PendingAgentActionApprovedEnvelope
     */
    action: PendingAgentAction;
    /**
     * 
     * @type {any}
     * @memberof PendingAgentActionApprovedEnvelope
     */
    result: any | null;
}
/**
 * 
 * @export
 * @interface PendingAgentActionEnvelope
 */
export interface PendingAgentActionEnvelope {
    /**
     * 
     * @type {PendingAgentAction}
     * @memberof PendingAgentActionEnvelope
     */
    pending_action: PendingAgentAction;
}
/**
 * `{ data }` envelope without cursor pagination — the pending queue is naturally bounded (max-1h TTL, small per-org).
 * @export
 * @interface PendingAgentActionListEnvelope
 */
export interface PendingAgentActionListEnvelope {
    /**
     * 
     * @type {Array<PendingAgentAction>}
     * @memberof PendingAgentActionListEnvelope
     */
    data: Array<PendingAgentAction>;
}
/**
 * 
 * @export
 * @interface PendingAgentActionRejectedEnvelope
 */
export interface PendingAgentActionRejectedEnvelope {
    /**
     * 
     * @type {PendingAgentAction}
     * @memberof PendingAgentActionRejectedEnvelope
     */
    action: PendingAgentAction;
}
/**
 * Result of `POST /permissions/check`. The decision (`allowed`) is echoed alongside the `action` + `resource` the caller asked about so SDKs can dispatch on the response shape alone.
 * @export
 * @interface PermissionCheck
 */
export interface PermissionCheck {
    /**
     * 
     * @type {boolean}
     * @memberof PermissionCheck
     */
    allowed: boolean;
    /**
     * 
     * @type {string}
     * @memberof PermissionCheck
     */
    action: string;
    /**
     * 
     * @type {string}
     * @memberof PermissionCheck
     */
    resource: string;
}
/**
 * Projection of a role grant for an account at a given scope. Mirrors `GrantResponseDto` (which itself wraps the service-layer `UserGrant` projection — no Drizzle row leaks here).
 * @export
 * @interface PermissionGrant
 */
export interface PermissionGrant {
    /**
     * Prefixed resource ID. Wire form: `grant_<base58>`.
     * @type {string}
     * @memberof PermissionGrant
     */
    id: string;
    /**
     * Prefixed resource ID. Wire form: `acc_<base58>`.
     * @type {string}
     * @memberof PermissionGrant
     */
    account_id: string;
    /**
     * 
     * @type {string}
     * @memberof PermissionGrant
     */
    scope_type: string;
    /**
     * 
     * @type {string}
     * @memberof PermissionGrant
     */
    scope_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof PermissionGrant
     */
    role: string;
    /**
     * 
     * @type {boolean}
     * @memberof PermissionGrant
     */
    is_active: boolean;
}
/**
 * 
 * @export
 * @interface PermissionGrantEnvelope
 */
export interface PermissionGrantEnvelope {
    /**
     * 
     * @type {PermissionGrant}
     * @memberof PermissionGrantEnvelope
     */
    grant: PermissionGrant;
}
/**
 * 
 * @export
 * @interface PermissionGrantList
 */
export interface PermissionGrantList {
    /**
     * 
     * @type {Array<PermissionGrant>}
     * @memberof PermissionGrantList
     */
    data: Array<PermissionGrant>;
}
/**
 * Public projection of a `permission_groups` row. Excludes `organization_id` (auth-scoped) and `created_by` (internal accountability). `member_count` is included on list/detail endpoints, omitted on plain envelope responses. Mirrors `PermissionGroupResponseDto`.
 * @export
 * @interface PermissionGroup
 */
export interface PermissionGroup {
    /**
     * Prefixed resource ID. Wire form: `pgrp_<base58>`.
     * @type {string}
     * @memberof PermissionGroup
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof PermissionGroup
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof PermissionGroup
     */
    description: string | null;
    /**
     * 
     * @type {boolean}
     * @memberof PermissionGroup
     */
    is_default: boolean;
    /**
     * 
     * @type {string}
     * @memberof PermissionGroup
     */
    default_role: string | null;
    /**
     * 
     * @type {number}
     * @memberof PermissionGroup
     */
    member_count?: number;
    /**
     * 
     * @type {string}
     * @memberof PermissionGroup
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof PermissionGroup
     */
    updated_at: string;
}
/**
 * Constant-shape ack — `added: true` returned by member / policy attach endpoints so SDKs can dispatch on shape alone.
 * @export
 * @interface PermissionGroupAddedAck
 */
export interface PermissionGroupAddedAck {
    /**
     * 
     * @type {boolean}
     * @memberof PermissionGroupAddedAck
     */
    added: PermissionGroupAddedAckAddedEnum;
}


/**
 * @export
 */
export const PermissionGroupAddedAckAddedEnum = {
    true: true
} as const;
export type PermissionGroupAddedAckAddedEnum = typeof PermissionGroupAddedAckAddedEnum[keyof typeof PermissionGroupAddedAckAddedEnum];

/**
 * Composite group + members + policies shape for `GET /groups/:id`. Mirrors `PermissionGroupDetailResponseDto`.
 * @export
 * @interface PermissionGroupDetail
 */
export interface PermissionGroupDetail {
    /**
     * 
     * @type {PermissionGroup}
     * @memberof PermissionGroupDetail
     */
    group: PermissionGroup;
    /**
     * 
     * @type {Array<PermissionGroupMember>}
     * @memberof PermissionGroupDetail
     */
    members: Array<PermissionGroupMember>;
    /**
     * 
     * @type {Array<PermissionGroupPolicy>}
     * @memberof PermissionGroupDetail
     */
    policies: Array<PermissionGroupPolicy>;
}
/**
 * 
 * @export
 * @interface PermissionGroupEnvelope
 */
export interface PermissionGroupEnvelope {
    /**
     * 
     * @type {PermissionGroup}
     * @memberof PermissionGroupEnvelope
     */
    group: PermissionGroup;
}
/**
 * 
 * @export
 * @interface PermissionGroupList
 */
export interface PermissionGroupList {
    /**
     * 
     * @type {Array<PermissionGroup>}
     * @memberof PermissionGroupList
     */
    data: Array<PermissionGroup>;
}
/**
 * Group-member projection joined with the `accounts` row for display. Mirrors `GroupMemberResponseDto`.
 * @export
 * @interface PermissionGroupMember
 */
export interface PermissionGroupMember {
    /**
     * Prefixed resource ID. Wire form: `acc_<base58>`.
     * @type {string}
     * @memberof PermissionGroupMember
     */
    account_id: string;
    /**
     * 
     * @type {string}
     * @memberof PermissionGroupMember
     */
    email: string;
    /**
     * 
     * @type {string}
     * @memberof PermissionGroupMember
     */
    full_name: string | null;
    /**
     * 
     * @type {string}
     * @memberof PermissionGroupMember
     */
    added_at: string;
}
/**
 * 
 * @export
 * @interface PermissionGroupMemberList
 */
export interface PermissionGroupMemberList {
    /**
     * 
     * @type {Array<PermissionGroupMember>}
     * @memberof PermissionGroupMemberList
     */
    data: Array<PermissionGroupMember>;
}
/**
 * Group-policy projection joined from `permission_policies`. Differs from `PermissionPolicy` by including `is_active` — the group-attached view surfaces it because attachments outlive the policy soft-delete. Mirrors `GroupPolicyResponseDto`.
 * @export
 * @interface PermissionGroupPolicy
 */
export interface PermissionGroupPolicy {
    /**
     * Prefixed resource ID. Wire form: `pol_<base58>`.
     * @type {string}
     * @memberof PermissionGroupPolicy
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof PermissionGroupPolicy
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof PermissionGroupPolicy
     */
    description: string | null;
    /**
     * 
     * @type {string}
     * @memberof PermissionGroupPolicy
     */
    display_name: string | null;
    /**
     * 
     * @type {string}
     * @memberof PermissionGroupPolicy
     */
    category: string | null;
    /**
     * 
     * @type {string}
     * @memberof PermissionGroupPolicy
     */
    effect: string;
    /**
     * 
     * @type {Array<string>}
     * @memberof PermissionGroupPolicy
     */
    actions: Array<string>;
    /**
     * 
     * @type {Array<string>}
     * @memberof PermissionGroupPolicy
     */
    resources: Array<string>;
    /**
     * 
     * @type {string}
     * @memberof PermissionGroupPolicy
     */
    seed_role: string | null;
    /**
     * 
     * @type {any}
     * @memberof PermissionGroupPolicy
     */
    conditions: any | null;
    /**
     * 
     * @type {boolean}
     * @memberof PermissionGroupPolicy
     */
    is_active: boolean;
    /**
     * 
     * @type {string}
     * @memberof PermissionGroupPolicy
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof PermissionGroupPolicy
     */
    updated_at: string;
}
/**
 * 
 * @export
 * @interface PermissionGroupPolicyList
 */
export interface PermissionGroupPolicyList {
    /**
     * 
     * @type {Array<PermissionGroupPolicy>}
     * @memberof PermissionGroupPolicyList
     */
    data: Array<PermissionGroupPolicy>;
}
/**
 * Public projection of a `permission_policies` row. Excludes `organization_id` (caller tenancy is implicit from auth context) and `is_active` (deletes are soft; only active rows are ever returned). Mirrors `PolicyResponseDto`.
 * @export
 * @interface PermissionPolicy
 */
export interface PermissionPolicy {
    [key: string]: any | any;
    /**
     * Prefixed resource ID. Wire form: `pol_<base58>`.
     * @type {string}
     * @memberof PermissionPolicy
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof PermissionPolicy
     */
    name: string;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof PermissionPolicy
     */
    description: AccountMembershipOrganizationBillingEmail;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof PermissionPolicy
     */
    display_name: AccountMembershipOrganizationBillingEmail;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof PermissionPolicy
     */
    category: AccountMembershipOrganizationBillingEmail;
    /**
     * 
     * @type {string}
     * @memberof PermissionPolicy
     */
    effect: string;
    /**
     * 
     * @type {Array<string>}
     * @memberof PermissionPolicy
     */
    actions: Array<string>;
    /**
     * 
     * @type {Array<string>}
     * @memberof PermissionPolicy
     */
    resources: Array<string>;
    /**
     * 
     * @type {AuditEventAfter}
     * @memberof PermissionPolicy
     */
    conditions: AuditEventAfter;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof PermissionPolicy
     */
    seed_role: AccountMembershipOrganizationBillingEmail;
    /**
     * 
     * @type {string}
     * @memberof PermissionPolicy
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof PermissionPolicy
     */
    updated_at: string;
}
/**
 * Static catalog of policy categories — surfaced so the FE can render category pickers without hard-coding the enum.
 * @export
 * @interface PermissionPolicyCategoryList
 */
export interface PermissionPolicyCategoryList {
    /**
     * 
     * @type {Array<string>}
     * @memberof PermissionPolicyCategoryList
     */
    data: Array<string>;
}
/**
 * 
 * @export
 * @interface PermissionPolicyEnvelope
 */
export interface PermissionPolicyEnvelope {
    /**
     * 
     * @type {PermissionPolicy}
     * @memberof PermissionPolicyEnvelope
     */
    policy: PermissionPolicy;
}
/**
 * 
 * @export
 * @interface PermissionPolicyList
 */
export interface PermissionPolicyList {
    /**
     * 
     * @type {Array<PermissionPolicy>}
     * @memberof PermissionPolicyList
     */
    data: Array<PermissionPolicy>;
}
/**
 * The Stripe v2 thin envelope delivered to customer webhook endpoints via Svix. Stable wire shape — no `data`, no `previous_attributes`, no `api_version`. Consumers fetch the current resource state via `related_object.url`. The full snapshot + outcome history is available out-of-band on the event-management API (`Event` schema above).
 * @export
 * @interface PlatformEvent
 */
export interface PlatformEvent {
    [key: string]: any | any;
    /**
     * Prefixed resource ID. Wire form: `evt_<base58>`.
     * @type {string}
     * @memberof PlatformEvent
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof PlatformEvent
     */
    object: string;
    /**
     * Event-type literal (`work_item.created`, `iteration.started`, …).
     * @type {string}
     * @memberof PlatformEvent
     */
    type: string;
    /**
     * 
     * @type {string}
     * @memberof PlatformEvent
     */
    created: string;
    /**
     * Prefixed resource ID. Wire form: `org_<base58>`.
     * @type {string}
     * @memberof PlatformEvent
     */
    organization_id: string;
    /**
     * Prefixed resource ID. Wire form: `ws_<base58>`.
     * @type {string}
     * @memberof PlatformEvent
     */
    workspace_id: string;
    /**
     * 
     * @type {PlatformEventRelatedObjectOutput}
     * @memberof PlatformEvent
     */
    related_object: PlatformEventRelatedObjectOutput;
    /**
     * 
     * @type {string}
     * @memberof PlatformEvent
     */
    reason: PlatformEventReasonEnum;
}


/**
 * @export
 */
export const PlatformEventReasonEnum = {
    api_request: 'api_request',
    webhook_replay: 'webhook_replay',
    system_job: 'system_job'
} as const;
export type PlatformEventReasonEnum = typeof PlatformEventReasonEnum[keyof typeof PlatformEventReasonEnum];

/**
 * 
 * @export
 * @interface PlatformEventRelatedObject
 */
export interface PlatformEventRelatedObject {
    /**
     * 
     * @type {string}
     * @memberof PlatformEventRelatedObject
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof PlatformEventRelatedObject
     */
    type: string;
    /**
     * Relative URL — resolve against the API base and GET it for the resource's current state.
     * @type {string}
     * @memberof PlatformEventRelatedObject
     */
    url: string;
}
/**
 * 
 * @export
 * @interface PlatformEventRelatedObjectOutput
 */
export interface PlatformEventRelatedObjectOutput {
    [key: string]: any | any;
    /**
     * 
     * @type {string}
     * @memberof PlatformEventRelatedObjectOutput
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof PlatformEventRelatedObjectOutput
     */
    type: string;
    /**
     * Relative URL — resolve against the API base and GET it for the resource's current state.
     * @type {string}
     * @memberof PlatformEventRelatedObjectOutput
     */
    url: string;
}
/**
 * Variable-shape ack — `deleted` is `false` when no row matched (soft-delete is idempotent at the service layer).
 * @export
 * @interface PolicyDeletedAck
 */
export interface PolicyDeletedAck {
    /**
     * 
     * @type {boolean}
     * @memberof PolicyDeletedAck
     */
    deleted: boolean;
}
/**
 * Presigned-URL envelope for direct-to-S3 uploads. Wire shape is snake_case (Stripe v2 convention).
 * @export
 * @interface PresignedUrl
 */
export interface PresignedUrl {
    /**
     * Short-lived (5 min) S3 presigned PUT URL. Client uploads the file directly to this URL — the backend never sees the bytes.
     * @type {string}
     * @memberof PresignedUrl
     */
    upload_url: string;
    /**
     * Durable public URL the client should store / reference in documents and blocks. CDN URL when configured, otherwise the direct S3 object URL.
     * @type {string}
     * @memberof PresignedUrl
     */
    file_url: string;
    /**
     * S3 object key — `uploads/{organizationId}/{uuid}{ext}`.
     * @type {string}
     * @memberof PresignedUrl
     */
    key: string;
}
/**
 * Anonymous-public projection of an FRBC row. Drives the suggest- form / Turnstile / category-filter UX on the renderer. Never exposes underlying organization_id / workspace_id / feedback_workspace_id.
 * @export
 * @interface PublicFeatureRequestBoard
 */
export interface PublicFeatureRequestBoard {
    /**
     * 
     * @type {Array<FeatureRequestBoardSurface>}
     * @memberof PublicFeatureRequestBoard
     */
    enabled_surfaces: Array<FeatureRequestBoardSurface>;
    /**
     * 
     * @type {boolean}
     * @memberof PublicFeatureRequestBoard
     */
    allow_anonymous_submissions: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof PublicFeatureRequestBoard
     */
    require_turnstile: boolean;
    /**
     * 
     * @type {Array<FeatureRequestBoardStateCategory>}
     * @memberof PublicFeatureRequestBoard
     */
    visible_state_categories: Array<FeatureRequestBoardStateCategory>;
}
/**
 * `feature_request_board: null` indicates the site has no FRBC row attached — the renderer should hide all feature-request UI.
 * @export
 * @interface PublicFeatureRequestBoardEnvelope
 */
export interface PublicFeatureRequestBoardEnvelope {
    /**
     * 
     * @type {PublicFeatureRequestBoard}
     * @memberof PublicFeatureRequestBoardEnvelope
     */
    feature_request_board: PublicFeatureRequestBoard | null;
}
/**
 * Anonymous-public projection of a `control.sites` row. Strictly public-surface fields — slug, custom_domain, theme. Never exposes underlying organization_id / workspace_id / metadata.
 * @export
 * @interface PublicSite
 */
export interface PublicSite {
    /**
     * 
     * @type {string}
     * @memberof PublicSite
     */
    slug: string;
    /**
     * 
     * @type {string}
     * @memberof PublicSite
     */
    custom_domain: string | null;
    /**
     * 
     * @type {PublicSiteTheme}
     * @memberof PublicSite
     */
    theme: PublicSiteTheme | null;
}
/**
 * 
 * @export
 * @interface PublicSiteEnvelope
 */
export interface PublicSiteEnvelope {
    /**
     * 
     * @type {PublicSite}
     * @memberof PublicSiteEnvelope
     */
    site: PublicSite;
}
/**
 * 
 * @export
 * @interface PublicSiteTheme
 */
export interface PublicSiteTheme {
    /**
     * 
     * @type {string}
     * @memberof PublicSiteTheme
     */
    primary_color: string | null;
    /**
     * 
     * @type {string}
     * @memberof PublicSiteTheme
     */
    logo_url: string | null;
}
/**
 * @type ReasoningResponse
 * 
 * @export
 */
export type ReasoningResponse = ReasoningResponseOneOf | ReasoningResponseOneOf1;
/**
 * 
 * @export
 * @interface ReasoningResponseOneOf
 */
export interface ReasoningResponseOneOf {
    /**
     * Prefixed resource ID. Wire form: `resp_<base58>`.
     * @type {string}
     * @memberof ReasoningResponseOneOf
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof ReasoningResponseOneOf
     */
    object: ReasoningResponseOneOfObjectEnum;
    /**
     * 
     * @type {string}
     * @memberof ReasoningResponseOneOf
     */
    ask: ReasoningResponseOneOfAskEnum;
    /**
     * 
     * @type {string}
     * @memberof ReasoningResponseOneOf
     */
    model: string;
    /**
     * 
     * @type {ReasoningResponseOneOfOutput}
     * @memberof ReasoningResponseOneOf
     */
    output: ReasoningResponseOneOfOutput;
    /**
     * 
     * @type {Array<ResponseSource>}
     * @memberof ReasoningResponseOneOf
     */
    sources: Array<ResponseSource>;
    /**
     * 
     * @type {ReasoningResponseOneOfUsage}
     * @memberof ReasoningResponseOneOf
     */
    usage: ReasoningResponseOneOfUsage;
}


/**
 * @export
 */
export const ReasoningResponseOneOfObjectEnum = {
    response: 'response'
} as const;
export type ReasoningResponseOneOfObjectEnum = typeof ReasoningResponseOneOfObjectEnum[keyof typeof ReasoningResponseOneOfObjectEnum];

/**
 * @export
 */
export const ReasoningResponseOneOfAskEnum = {
    text: 'text'
} as const;
export type ReasoningResponseOneOfAskEnum = typeof ReasoningResponseOneOfAskEnum[keyof typeof ReasoningResponseOneOfAskEnum];

/**
 * 
 * @export
 * @interface ReasoningResponseOneOf1
 */
export interface ReasoningResponseOneOf1 {
    /**
     * Prefixed resource ID. Wire form: `resp_<base58>`.
     * @type {string}
     * @memberof ReasoningResponseOneOf1
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof ReasoningResponseOneOf1
     */
    object: ReasoningResponseOneOf1ObjectEnum;
    /**
     * 
     * @type {string}
     * @memberof ReasoningResponseOneOf1
     */
    ask: ReasoningResponseOneOf1AskEnum;
    /**
     * 
     * @type {string}
     * @memberof ReasoningResponseOneOf1
     */
    model: string;
    /**
     * 
     * @type {FounderBriefOutput}
     * @memberof ReasoningResponseOneOf1
     */
    output: FounderBriefOutput;
    /**
     * 
     * @type {Array<ResponseSource>}
     * @memberof ReasoningResponseOneOf1
     */
    sources: Array<ResponseSource>;
    /**
     * 
     * @type {ReasoningResponseOneOfUsage}
     * @memberof ReasoningResponseOneOf1
     */
    usage: ReasoningResponseOneOfUsage;
}


/**
 * @export
 */
export const ReasoningResponseOneOf1ObjectEnum = {
    response: 'response'
} as const;
export type ReasoningResponseOneOf1ObjectEnum = typeof ReasoningResponseOneOf1ObjectEnum[keyof typeof ReasoningResponseOneOf1ObjectEnum];

/**
 * @export
 */
export const ReasoningResponseOneOf1AskEnum = {
    founder_brief: 'founder_brief'
} as const;
export type ReasoningResponseOneOf1AskEnum = typeof ReasoningResponseOneOf1AskEnum[keyof typeof ReasoningResponseOneOf1AskEnum];

/**
 * 
 * @export
 * @interface ReasoningResponseOneOfOutput
 */
export interface ReasoningResponseOneOfOutput {
    /**
     * 
     * @type {string}
     * @memberof ReasoningResponseOneOfOutput
     */
    text: string;
}
/**
 * 
 * @export
 * @interface ReasoningResponseOneOfUsage
 */
export interface ReasoningResponseOneOfUsage {
    /**
     * 
     * @type {number}
     * @memberof ReasoningResponseOneOfUsage
     */
    input_tokens: number;
    /**
     * 
     * @type {number}
     * @memberof ReasoningResponseOneOfUsage
     */
    output_tokens: number;
}
/**
 * Soft-fail body returned when the insert silently dropped (logged server-side). The UI should not block on feedback success.
 * @export
 * @interface RecordFeedbackNotRecorded
 */
export interface RecordFeedbackNotRecorded {
    /**
     * 
     * @type {boolean}
     * @memberof RecordFeedbackNotRecorded
     */
    recorded: RecordFeedbackNotRecordedRecordedEnum;
}


/**
 * @export
 */
export const RecordFeedbackNotRecordedRecordedEnum = {
    false: false
} as const;
export type RecordFeedbackNotRecordedRecordedEnum = typeof RecordFeedbackNotRecordedRecordedEnum[keyof typeof RecordFeedbackNotRecordedRecordedEnum];

/**
 * 
 * @export
 * @interface RecordFeedbackRequest
 */
export interface RecordFeedbackRequest {
    /**
     * 
     * @type {string}
     * @memberof RecordFeedbackRequest
     */
    signal: RecordFeedbackRequestSignalEnum;
    /**
     * 
     * @type {string}
     * @memberof RecordFeedbackRequest
     */
    source_type: string;
    /**
     * 
     * @type {string}
     * @memberof RecordFeedbackRequest
     */
    source_id: string;
    /**
     * 
     * @type {string}
     * @memberof RecordFeedbackRequest
     */
    chat_id?: string | null;
    /**
     * 
     * @type {string}
     * @memberof RecordFeedbackRequest
     */
    chat_message_id?: string | null;
    /**
     * 
     * @type {string}
     * @memberof RecordFeedbackRequest
     */
    query_context?: string | null;
    /**
     * 
     * @type {object}
     * @memberof RecordFeedbackRequest
     */
    metadata?: object;
}


/**
 * @export
 */
export const RecordFeedbackRequestSignalEnum = {
    thumbs_up: 'thumbs_up',
    thumbs_down: 'thumbs_down',
    chunk_click: 'chunk_click',
    doc_open: 'doc_open'
} as const;
export type RecordFeedbackRequestSignalEnum = typeof RecordFeedbackRequestSignalEnum[keyof typeof RecordFeedbackRequestSignalEnum];

/**
 * Thin ack of the persisted feedback row. Wire keys are snake_case in line with the platform-wide field-naming convention (Stripe v2 style; see `docs/platform/api-discipline.md` § "Field naming").
 * @export
 * @interface RecordFeedbackResponse
 */
export interface RecordFeedbackResponse {
    /**
     * 
     * @type {string}
     * @memberof RecordFeedbackResponse
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof RecordFeedbackResponse
     */
    signal: string;
    /**
     * 
     * @type {string}
     * @memberof RecordFeedbackResponse
     */
    source_type: string;
    /**
     * 
     * @type {string}
     * @memberof RecordFeedbackResponse
     */
    source_id: string;
    /**
     * 
     * @type {string}
     * @memberof RecordFeedbackResponse
     */
    created_at: string;
}
/**
 * Body for `POST /v1/pending_actions/{id}/reject`. `reason` is optional but supplying one helps the next agent run learn what the human cares about.
 * @export
 * @interface RejectPendingAction
 */
export interface RejectPendingAction {
    /**
     * 
     * @type {string}
     * @memberof RejectPendingAction
     */
    reason?: string;
}
/**
 * A directed edge from one WorkItem to another. Both endpoints are in the same workspace — cross-workspace relations are rejected. Self-relations are rejected at the DB level. The service materializes the inverse on create and deletes both ends on delete, so callers traversing from either end see consistent graph state.
 * @export
 * @interface Relation
 */
export interface Relation {
    /**
     * Prefixed resource ID. Wire form: `rel_<base58>`.
     * @type {string}
     * @memberof Relation
     */
    id: string;
    /**
     * Prefixed resource ID. Wire form: `ws_<base58>`.
     * @type {string}
     * @memberof Relation
     */
    workspace_id: string;
    /**
     * Prefixed resource ID. Wire form: `wi_<base58>`.
     * @type {string}
     * @memberof Relation
     */
    source_work_item_id: string;
    /**
     * Prefixed resource ID. Wire form: `wi_<base58>`.
     * @type {string}
     * @memberof Relation
     */
    target_work_item_id: string;
    /**
     * 
     * @type {RelationType}
     * @memberof Relation
     */
    relation_type: RelationType;
    /**
     * 
     * @type {string}
     * @memberof Relation
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Relation
     */
    updated_at: string;
}


/**
 * POST returns BOTH the forward edge and the auto-materialized inverse so callers can update local graph state in one round-trip.
 * @export
 * @interface RelationCreateEnvelope
 */
export interface RelationCreateEnvelope {
    /**
     * 
     * @type {Relation}
     * @memberof RelationCreateEnvelope
     */
    relation: Relation;
    /**
     * 
     * @type {Relation}
     * @memberof RelationCreateEnvelope
     */
    inverse: Relation;
}
/**
 * 
 * @export
 * @interface RelationEnvelope
 */
export interface RelationEnvelope {
    /**
     * 
     * @type {Relation}
     * @memberof RelationEnvelope
     */
    relation: Relation;
}
/**
 * 
 * @export
 * @interface RelationListEnvelope
 */
export interface RelationListEnvelope {
    /**
     * 
     * @type {Array<Relation>}
     * @memberof RelationListEnvelope
     */
    data: Array<Relation>;
}

/**
 * Directed, typed edge label. Inverses are auto-materialized: `blocks` ↔ `blocked_by`, `duplicates` ↔ `duplicated_by`, `causes` ↔ `caused_by`. `relates_to` is symmetric.
 * @export
 */
export const RelationType = {
    blocks: 'blocks',
    blocked_by: 'blocked_by',
    duplicates: 'duplicates',
    duplicated_by: 'duplicated_by',
    relates_to: 'relates_to',
    caused_by: 'caused_by',
    causes: 'causes'
} as const;
export type RelationType = typeof RelationType[keyof typeof RelationType];

/**
 * 
 * @export
 * @interface RemoveFindingsFromSet
 */
export interface RemoveFindingsFromSet {
    /**
     * 
     * @type {Array<string>}
     * @memberof RemoveFindingsFromSet
     */
    finding_ids: Array<string>;
}
/**
 * 
 * @export
 * @interface ReorderFolders
 */
export interface ReorderFolders {
    /**
     * Prefixed resource ID. Wire form: `fld_<base58>`.
     * @type {string}
     * @memberof ReorderFolders
     */
    parent_id?: string | null;
    /**
     * 
     * @type {Array<string>}
     * @memberof ReorderFolders
     */
    ordered_ids: Array<string>;
}
/**
 * 
 * @export
 * @interface ReorderWorkflowStates
 */
export interface ReorderWorkflowStates {
    /**
     * 
     * @type {Array<ReorderWorkflowStatesOrdersInner>}
     * @memberof ReorderWorkflowStates
     */
    orders: Array<ReorderWorkflowStatesOrdersInner>;
}
/**
 * 
 * @export
 * @interface ReorderWorkflowStatesOrdersInner
 */
export interface ReorderWorkflowStatesOrdersInner {
    /**
     * Prefixed resource ID. Wire form: `wfs_<base58>`.
     * @type {string}
     * @memberof ReorderWorkflowStatesOrdersInner
     */
    id: string;
    /**
     * 
     * @type {number}
     * @memberof ReorderWorkflowStatesOrdersInner
     */
    position: number;
}
/**
 * One HTTP request audit row recorded by the global `RequestAuditInterceptor`. Daily-partitioned, 90-day retention. Distinct from `AuditEvent` (admin/config changes) — request logs cover every authenticated HTTP request, audit events cover semantic operations on tenancy + integration config.
 * @export
 * @interface RequestLog
 */
export interface RequestLog {
    /**
     * Prefixed resource ID. Wire form: `req_<base58>`.
     * @type {string}
     * @memberof RequestLog
     */
    id: string;
    /**
     * Prefixed resource ID. Wire form: `org_<base58>`.
     * @type {string}
     * @memberof RequestLog
     */
    organization_id: string;
    /**
     * Prefixed resource ID. Wire form: `ws_<base58>`.
     * @type {string}
     * @memberof RequestLog
     */
    workspace_id: string;
    /**
     * Prefixed resource ID. Wire form: `ak_<base58>`.
     * @type {string}
     * @memberof RequestLog
     */
    api_key_id: string | null;
    /**
     * Prefixed resource ID. Wire form: `acc_<base58>`.
     * @type {string}
     * @memberof RequestLog
     */
    account_id: string | null;
    /**
     * HTTP method. Uppercase. Examples: `GET`, `POST`.
     * @type {string}
     * @memberof RequestLog
     */
    method: string;
    /**
     * Request path with query string stripped. Captures `req.originalUrl` (post-`setGlobalPrefix`). Query strings are NOT recorded — credentials in `?api_key=...` would leak into the audit row.
     * @type {string}
     * @memberof RequestLog
     */
    path: string;
    /**
     * HTTP status code the response eventually returned. On the error path the value is resolved from the thrown `HttpException`, not from `res.statusCode` (the global exception filter writes it later).
     * @type {number}
     * @memberof RequestLog
     */
    status_code: number;
    /**
     * Wall-clock latency from `RequestAuditInterceptor.intercept` entry to the tap/catchError emission. Includes guards, validation, the handler, and response serialization — matches what the caller saw.
     * @type {number}
     * @memberof RequestLog
     */
    latency_ms: number;
    /**
     * 
     * @type {number}
     * @memberof RequestLog
     */
    request_body_size: number | null;
    /**
     * 
     * @type {number}
     * @memberof RequestLog
     */
    response_body_size: number | null;
    /**
     * 
     * @type {string}
     * @memberof RequestLog
     */
    request_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof RequestLog
     */
    occurred_at: string;
}
/**
 * 
 * @export
 * @interface RequestLogPage
 */
export interface RequestLogPage {
    /**
     * 
     * @type {Array<RequestLog>}
     * @memberof RequestLogPage
     */
    data: Array<RequestLog>;
    /**
     * 
     * @type {boolean}
     * @memberof RequestLogPage
     */
    has_more: boolean;
    /**
     * 
     * @type {string}
     * @memberof RequestLogPage
     */
    next_page_url: string | null;
    /**
     * 
     * @type {string}
     * @memberof RequestLogPage
     */
    previous_page_url: string | null;
}
/**
 * Request a short-lived S3 presigned PUT URL. Allowed MIME types: images (jpeg/png/gif/webp/svg+xml), video (mp4/webm), audio (mpeg/wav/webm), `application/pdf`, Word (.docx), and `text/plain` (LINE chat exports). Max 50 MB.
 * @export
 * @interface RequestPresignedUrl
 */
export interface RequestPresignedUrl {
    /**
     * 
     * @type {string}
     * @memberof RequestPresignedUrl
     */
    file_name: string;
    /**
     * 
     * @type {string}
     * @memberof RequestPresignedUrl
     */
    content_type: RequestPresignedUrlContentTypeEnum;
    /**
     * 
     * @type {number}
     * @memberof RequestPresignedUrl
     */
    size_bytes: number;
}


/**
 * @export
 */
export const RequestPresignedUrlContentTypeEnum = {
    image_jpeg: 'image/jpeg',
    image_png: 'image/png',
    image_gif: 'image/gif',
    image_webp: 'image/webp',
    image_svgxml: 'image/svg+xml',
    video_mp4: 'video/mp4',
    video_webm: 'video/webm',
    audio_mpeg: 'audio/mpeg',
    audio_wav: 'audio/wav',
    audio_webm: 'audio/webm',
    application_pdf: 'application/pdf',
    application_vnd_openxmlformats_officedocument_wordprocessingml_document: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    text_plain: 'text/plain'
} as const;
export type RequestPresignedUrlContentTypeEnum = typeof RequestPresignedUrlContentTypeEnum[keyof typeof RequestPresignedUrlContentTypeEnum];

/**
 * @type ResponseSource
 * 
 * @export
 */
export type ResponseSource = ResponseSourceOneOf | ResponseSourceOneOf1;
/**
 * 
 * @export
 * @interface ResponseSourceOneOf
 */
export interface ResponseSourceOneOf {
    /**
     * 
     * @type {string}
     * @memberof ResponseSourceOneOf
     */
    type: ResponseSourceOneOfTypeEnum;
    /**
     * Prefixed resource ID. Wire form: `wi_<base58>`.
     * @type {string}
     * @memberof ResponseSourceOneOf
     */
    id: string;
    /**
     * 
     * @type {number}
     * @memberof ResponseSourceOneOf
     */
    compressed_context_version: number | null;
}


/**
 * @export
 */
export const ResponseSourceOneOfTypeEnum = {
    work_item: 'work_item'
} as const;
export type ResponseSourceOneOfTypeEnum = typeof ResponseSourceOneOfTypeEnum[keyof typeof ResponseSourceOneOfTypeEnum];

/**
 * 
 * @export
 * @interface ResponseSourceOneOf1
 */
export interface ResponseSourceOneOf1 {
    /**
     * 
     * @type {string}
     * @memberof ResponseSourceOneOf1
     */
    type: ResponseSourceOneOf1TypeEnum;
    /**
     * Prefixed resource ID. Wire form: `it_<base58>`.
     * @type {string}
     * @memberof ResponseSourceOneOf1
     */
    id: string;
    /**
     * 
     * @type {number}
     * @memberof ResponseSourceOneOf1
     */
    compressed_context_version: number | null;
}


/**
 * @export
 */
export const ResponseSourceOneOf1TypeEnum = {
    iteration: 'iteration'
} as const;
export type ResponseSourceOneOf1TypeEnum = typeof ResponseSourceOneOf1TypeEnum[keyof typeof ResponseSourceOneOf1TypeEnum];

/**
 * 
 * @export
 * @interface RevokeRole
 */
export interface RevokeRole {
    /**
     * Prefixed resource ID. Wire form: `acc_<base58>`.
     * @type {string}
     * @memberof RevokeRole
     */
    account_id: string;
    /**
     * 
     * @type {string}
     * @memberof RevokeRole
     */
    role: string;
}
/**
 * 
 * @export
 * @interface RoleRevokedAck
 */
export interface RoleRevokedAck {
    /**
     * 
     * @type {boolean}
     * @memberof RoleRevokedAck
     */
    revoked: boolean;
}
/**
 * One rolling-window usage meter (session 5hr / weekly 7d). Hard throughput caps that smooth the monthly budget across time.
 * @export
 * @interface RollingWindow
 */
export interface RollingWindow {
    /**
     * Stable window key. `session` = rolling 5 hours, `weekly` = rolling 7 days.
     * @type {string}
     * @memberof RollingWindow
     */
    key: RollingWindowKeyEnum;
    /**
     * Human label for panels (e.g. "Session (5hr)").
     * @type {string}
     * @memberof RollingWindow
     */
    label: string;
    /**
     * Window length in hours (rolling, anchored to now).
     * @type {number}
     * @memberof RollingWindow
     */
    hours: number;
    /**
     * USD spend inside the window, in cents.
     * @type {number}
     * @memberof RollingWindow
     */
    spent_cents: number;
    /**
     * Hard cap for the window, in cents — a fraction of the plan's monthly budget (caps scale with tier). 0 = the window never binds (free plan).
     * @type {number}
     * @memberof RollingWindow
     */
    cap_cents: number;
    /**
     * Integer percentage of `cap_cents` consumed, in [0, 100] (capped at 100). Render directly — do NOT multiply by 100.
     * @type {number}
     * @memberof RollingWindow
     */
    percent_used: number;
    /**
     * False when the window is exhausted — LLM-spending requests return 429 `usage_limit_exceeded` with `meta.limitType` set to this window key until usage ages out or the plan is upgraded. Top-up credit does NOT bypass window caps (period cap only).
     * @type {boolean}
     * @memberof RollingWindow
     */
    within_cap: boolean;
    /**
     * 
     * @type {string}
     * @memberof RollingWindow
     */
    resets_at: string | null;
}


/**
 * @export
 */
export const RollingWindowKeyEnum = {
    session: 'session',
    weekly: 'weekly'
} as const;
export type RollingWindowKeyEnum = typeof RollingWindowKeyEnum[keyof typeof RollingWindowKeyEnum];

/**
 * 
 * @export
 * @interface RotateApiKey
 */
export interface RotateApiKey {
    /**
     * 
     * @type {number}
     * @memberof RotateApiKey
     */
    grace_period_hours?: number;
}
/**
 * KG slice (entities + relationships) accompanying the document hits. `source` / `target` are entity ids; `*_name` fields are the human labels denormalized in for prompt-rendering ease.
 * @export
 * @interface SearchContextGraphContext
 */
export interface SearchContextGraphContext {
    [key: string]: any | any;
    /**
     * 
     * @type {Array<SearchContextGraphContextEntitiesInner>}
     * @memberof SearchContextGraphContext
     */
    entities: Array<SearchContextGraphContextEntitiesInner>;
    /**
     * 
     * @type {Array<SearchContextGraphContextRelationshipsInner>}
     * @memberof SearchContextGraphContext
     */
    relationships: Array<SearchContextGraphContextRelationshipsInner>;
}
/**
 * 
 * @export
 * @interface SearchContextGraphContextEntitiesInner
 */
export interface SearchContextGraphContextEntitiesInner {
    /**
     * 
     * @type {string}
     * @memberof SearchContextGraphContextEntitiesInner
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof SearchContextGraphContextEntitiesInner
     */
    type: string;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof SearchContextGraphContextEntitiesInner
     */
    description: AccountMembershipOrganizationBillingEmail;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof SearchContextGraphContextEntitiesInner
     */
    citation: AccountMembershipOrganizationBillingEmail;
}
/**
 * 
 * @export
 * @interface SearchContextGraphContextRelationshipsInner
 */
export interface SearchContextGraphContextRelationshipsInner {
    /**
     * 
     * @type {string}
     * @memberof SearchContextGraphContextRelationshipsInner
     */
    source: string;
    /**
     * 
     * @type {string}
     * @memberof SearchContextGraphContextRelationshipsInner
     */
    target: string;
    /**
     * 
     * @type {string}
     * @memberof SearchContextGraphContextRelationshipsInner
     */
    source_name: string;
    /**
     * 
     * @type {string}
     * @memberof SearchContextGraphContextRelationshipsInner
     */
    target_name: string;
    /**
     * 
     * @type {string}
     * @memberof SearchContextGraphContextRelationshipsInner
     */
    type: string;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof SearchContextGraphContextRelationshipsInner
     */
    description: AccountMembershipOrganizationBillingEmail;
}
/**
 * Documents + optional graph slice — what the chat-completion pipeline assembles before handing context to the LLM. Surfaced directly so external agents can reuse the same retrieval pack.
 * @export
 * @interface SearchContextResponse
 */
export interface SearchContextResponse {
    /**
     * 
     * @type {Array<SearchHit>}
     * @memberof SearchContextResponse
     */
    documents: Array<SearchHit>;
    /**
     * 
     * @type {SearchContextGraphContext}
     * @memberof SearchContextResponse
     */
    graph_context: SearchContextGraphContext | null;
    /**
     * 
     * @type {string}
     * @memberof SearchContextResponse
     */
    query: string;
}
/**
 * A single hybrid-search hit. Heterogeneous — branch on `source_type` to interpret. Per-method scores (`fts_rank`, `vector_score`, `graph_depth`, `community_rank`) are populated when the corresponding retrieval method contributed to the row.
 * @export
 * @interface SearchHit
 */
export interface SearchHit {
    [key: string]: any | any;
    /**
     * The kind of entity this row points at (e.g. `work_item`, `page`, `comment`, `folder`, `kg_community`). Open-ended string — new indexable types ship without a wire-shape change. Callers branch on this to interpret `metadata`.
     * @type {string}
     * @memberof SearchHit
     */
    source_type: string;
    /**
     * 
     * @type {string}
     * @memberof SearchHit
     */
    source_id: string;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof SearchHit
     */
    title: AccountMembershipOrganizationBillingEmail;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof SearchHit
     */
    snippet: AccountMembershipOrganizationBillingEmail;
    /**
     * 
     * @type {number}
     * @memberof SearchHit
     */
    score: number;
    /**
     * Which retrieval methods produced this hit (e.g. `["fts", "vector"]`). Order is unspecified.
     * @type {Array<string>}
     * @memberof SearchHit
     */
    matched_by: Array<string>;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof SearchHit
     */
    fts_rank: AccountMembershipOrganizationBillingEmail;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof SearchHit
     */
    vector_score: AccountMembershipOrganizationBillingEmail;
    /**
     * 
     * @type {SearchHitGraphDepth}
     * @memberof SearchHit
     */
    graph_depth: SearchHitGraphDepth | null;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof SearchHit
     */
    community_rank: AccountMembershipOrganizationBillingEmail;
    /**
     * 
     * @type {AccountMembershipOrganizationBillingEmail}
     * @memberof SearchHit
     */
    community_title: AccountMembershipOrganizationBillingEmail;
    /**
     * 
     * @type {AccountMembershipMembershipInvitedAt}
     * @memberof SearchHit
     */
    updated_at: AccountMembershipMembershipInvitedAt;
    /**
     * 
     * @type {AuditEventAfter}
     * @memberof SearchHit
     */
    metadata: AuditEventAfter;
}
/**
 * 
 * @export
 * @interface SearchHitGraphDepth
 */
export interface SearchHitGraphDepth {
}
/**
 * Cross-encoder rerank diagnostics. `null` on the parent envelope when reranking was disabled or skipped (small candidate pool).
 * @export
 * @interface SearchRerank
 */
export interface SearchRerank {
    /**
     * 
     * @type {boolean}
     * @memberof SearchRerank
     */
    applied: boolean;
    /**
     * 
     * @type {string}
     * @memberof SearchRerank
     */
    reason: string | null;
    /**
     * 
     * @type {number}
     * @memberof SearchRerank
     */
    pool_size: number | null;
    /**
     * 
     * @type {number}
     * @memberof SearchRerank
     */
    rerank_ms: number | null;
}
/**
 * 
 * @export
 * @interface SearchTiming
 */
export interface SearchTiming {
    /**
     * 
     * @type {number}
     * @memberof SearchTiming
     */
    fts_ms: number | null;
    /**
     * 
     * @type {number}
     * @memberof SearchTiming
     */
    vector_ms: number | null;
    /**
     * 
     * @type {number}
     * @memberof SearchTiming
     */
    graph_ms: number | null;
    /**
     * 
     * @type {number}
     * @memberof SearchTiming
     */
    community_ms: number | null;
    /**
     * 
     * @type {number}
     * @memberof SearchTiming
     */
    total_ms: number;
}
/**
 * 
 * @export
 * @interface SetAttributeValue
 */
export interface SetAttributeValue {
    /**
     * 
     * @type {any}
     * @memberof SetAttributeValue
     */
    value: any | null;
}
/**
 * A share row with its joined grant set. `is_active` is omitted because list endpoints already filter on it; soft-deleted shares 404 on direct read. `granted_by` is exposed as a uuid only — no full account row.
 * @export
 * @interface Share
 */
export interface Share {
    /**
     * Prefixed resource ID. Wire form: `shr_<base58>`.
     * @type {string}
     * @memberof Share
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof Share
     */
    scope: string;
    /**
     * 
     * @type {string}
     * @memberof Share
     */
    artifact_id: string | null;
    /**
     * Prefixed resource ID. Wire form: `pg_<base58>`.
     * @type {string}
     * @memberof Share
     */
    page_id: string | null;
    /**
     * Prefixed resource ID. Wire form: `acc_<base58>`.
     * @type {string}
     * @memberof Share
     */
    granted_by: string;
    /**
     * 
     * @type {boolean}
     * @memberof Share
     */
    inherits: boolean;
    /**
     * 
     * @type {string}
     * @memberof Share
     */
    message: string | null;
    /**
     * 
     * @type {string}
     * @memberof Share
     */
    expires_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof Share
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Share
     */
    updated_at: string;
    /**
     * 
     * @type {Array<ShareGrant>}
     * @memberof Share
     */
    grants: Array<ShareGrant>;
}
/**
 * 
 * @export
 * @interface ShareAccessCheckResponse
 */
export interface ShareAccessCheckResponse {
    /**
     * 
     * @type {boolean}
     * @memberof ShareAccessCheckResponse
     */
    has_access: boolean;
    /**
     * 
     * @type {string}
     * @memberof ShareAccessCheckResponse
     */
    resource_id: string;
    /**
     * 
     * @type {string}
     * @memberof ShareAccessCheckResponse
     */
    resource_type: string;
    /**
     * 
     * @type {string}
     * @memberof ShareAccessCheckResponse
     */
    role: string;
}
/**
 * 
 * @export
 * @interface ShareDeletedResponse
 */
export interface ShareDeletedResponse {
    /**
     * 
     * @type {boolean}
     * @memberof ShareDeletedResponse
     */
    deleted: ShareDeletedResponseDeletedEnum;
}


/**
 * @export
 */
export const ShareDeletedResponseDeletedEnum = {
    true: true
} as const;
export type ShareDeletedResponseDeletedEnum = typeof ShareDeletedResponseDeletedEnum[keyof typeof ShareDeletedResponseDeletedEnum];

/**
 * 
 * @export
 * @interface ShareEnvelope
 */
export interface ShareEnvelope {
    /**
     * 
     * @type {Share}
     * @memberof ShareEnvelope
     */
    share: Share;
}
/**
 * 
 * @export
 * @interface ShareGrant
 */
export interface ShareGrant {
    /**
     * Prefixed resource ID. Wire form: `shrg_<base58>`.
     * @type {string}
     * @memberof ShareGrant
     */
    id: string;
    /**
     * Prefixed resource ID. Wire form: `shr_<base58>`.
     * @type {string}
     * @memberof ShareGrant
     */
    share_id: string;
    /**
     * One of `user` / `team` / `org` / `agent`.
     * @type {string}
     * @memberof ShareGrant
     */
    principal_type: string;
    /**
     * 
     * @type {string}
     * @memberof ShareGrant
     */
    principal_id: string;
    /**
     * One of `viewer` / `commenter` / `editor` / `owner`.
     * @type {string}
     * @memberof ShareGrant
     */
    role: string;
    /**
     * 
     * @type {string}
     * @memberof ShareGrant
     */
    granted_at: string;
    /**
     * Prefixed resource ID. Wire form: `acc_<base58>`.
     * @type {string}
     * @memberof ShareGrant
     */
    granted_by: string;
}
/**
 * 
 * @export
 * @interface ShareGrantEnvelope
 */
export interface ShareGrantEnvelope {
    /**
     * 
     * @type {ShareGrant}
     * @memberof ShareGrantEnvelope
     */
    grant: ShareGrant;
}
/**
 * 
 * @export
 * @interface ShareGrantRemovedResponse
 */
export interface ShareGrantRemovedResponse {
    /**
     * 
     * @type {boolean}
     * @memberof ShareGrantRemovedResponse
     */
    removed: boolean;
}
/**
 * 
 * @export
 * @interface ShareListEnvelope
 */
export interface ShareListEnvelope {
    /**
     * 
     * @type {Array<Share>}
     * @memberof ShareListEnvelope
     */
    data: Array<Share>;
}
/**
 * 
 * @export
 * @interface SharePrincipalInfo
 */
export interface SharePrincipalInfo {
    /**
     * 
     * @type {string}
     * @memberof SharePrincipalInfo
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof SharePrincipalInfo
     */
    principal_type: string;
    /**
     * 
     * @type {string}
     * @memberof SharePrincipalInfo
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof SharePrincipalInfo
     */
    email?: string;
    /**
     * 
     * @type {string}
     * @memberof SharePrincipalInfo
     */
    avatar_url?: string;
}
/**
 * Aggregated view of who can reach a resource — direct + inherited grant counts and the deduped principal set.
 * @export
 * @interface SharingSummary
 */
export interface SharingSummary {
    /**
     * 
     * @type {string}
     * @memberof SharingSummary
     */
    resource_id: string;
    /**
     * 
     * @type {string}
     * @memberof SharingSummary
     */
    resource_type: string;
    /**
     * 
     * @type {number}
     * @memberof SharingSummary
     */
    total_shares: number;
    /**
     * 
     * @type {number}
     * @memberof SharingSummary
     */
    direct_grants: number;
    /**
     * 
     * @type {number}
     * @memberof SharingSummary
     */
    inherited_grants: number;
    /**
     * 
     * @type {Array<SharePrincipalInfo>}
     * @memberof SharingSummary
     */
    principals: Array<SharePrincipalInfo>;
}
/**
 * Maps an inbound Host header to the site’s public slug. Used by tenant-owned frontends running on a `custom_domain` to translate `Host: roadmap.acme.com` → `{ slug }` and proxy/render against the regular slug-rooted endpoints.
 * @export
 * @interface SiteResolveByHostEnvelope
 */
export interface SiteResolveByHostEnvelope {
    /**
     * 
     * @type {string}
     * @memberof SiteResolveByHostEnvelope
     */
    slug: string;
}
/**
 * 
 * @export
 * @interface StartIteration
 */
export interface StartIteration {
    /**
     * 
     * @type {string}
     * @memberof StartIteration
     */
    start_date?: string;
    /**
     * 
     * @type {string}
     * @memberof StartIteration
     */
    end_date?: string;
}
/**
 * Closed-loop outcome submission. We don't impose a result schema — different customers want different outcome detail.
 * @export
 * @interface SubmitEventOutcome
 */
export interface SubmitEventOutcome {
    /**
     * 
     * @type {EventOutcomeStatus}
     * @memberof SubmitEventOutcome
     */
    status: EventOutcomeStatus;
    /**
     * 
     * @type {object}
     * @memberof SubmitEventOutcome
     */
    result?: object;
}


/**
 * Public projection of a `subscriptions` row. Excludes `stripe_subscription_id` and `stripe_customer_id` — leaking those to the browser hands over billing control. Also excludes `organization_id` (the caller already knows it from their auth context). `seat_count` is the billed quantity, the member-roster cap, and the pooled-LLM-allowance multiplier.
 * @export
 * @interface Subscription
 */
export interface Subscription {
    /**
     * Prefixed resource ID. Wire form: `sub_<base58>`.
     * @type {string}
     * @memberof Subscription
     */
    id: string;
    /**
     * 
     * @type {SubscriptionPlanType}
     * @memberof Subscription
     */
    plan_type: SubscriptionPlanType;
    /**
     * 
     * @type {SubscriptionStatus}
     * @memberof Subscription
     */
    status: SubscriptionStatus;
    /**
     * 
     * @type {BillingInterval}
     * @memberof Subscription
     */
    billing_interval: BillingInterval;
    /**
     * 
     * @type {number}
     * @memberof Subscription
     */
    seat_count: number;
    /**
     * 
     * @type {number}
     * @memberof Subscription
     */
    price_cents: number;
    /**
     * 
     * @type {string}
     * @memberof Subscription
     */
    currency: string;
    /**
     * 
     * @type {string}
     * @memberof Subscription
     */
    current_period_start: string;
    /**
     * 
     * @type {string}
     * @memberof Subscription
     */
    current_period_end: string;
    /**
     * 
     * @type {string}
     * @memberof Subscription
     */
    trial_end: string | null;
    /**
     * 
     * @type {UsageMode}
     * @memberof Subscription
     */
    usage_mode: UsageMode;
    /**
     * 
     * @type {string}
     * @memberof Subscription
     */
    canceled_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof Subscription
     */
    ended_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof Subscription
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Subscription
     */
    updated_at: string;
}



/**
 * 
 * @export
 */
export const SubscriptionPlanType = {
    free: 'free',
    team: 'team'
} as const;
export type SubscriptionPlanType = typeof SubscriptionPlanType[keyof typeof SubscriptionPlanType];


/**
 * 
 * @export
 */
export const SubscriptionStatus = {
    active: 'active',
    scheduled_cancel: 'scheduled_cancel',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'unpaid',
    incomplete: 'incomplete',
    incomplete_expired: 'incomplete_expired',
    trialing: 'trialing'
} as const;
export type SubscriptionStatus = typeof SubscriptionStatus[keyof typeof SubscriptionStatus];

/**
 * AIP-136 custom action body — `organization_id` of the membership to switch into. The server mints a fresh access/refresh pair bound to that organization.
 * @export
 * @interface SwitchOrganization
 */
export interface SwitchOrganization {
    /**
     * Prefixed resource ID. Wire form: `org_<base58>`.
     * @type {string}
     * @memberof SwitchOrganization
     */
    organization_id: string;
}
/**
 * 
 * @export
 * @interface UpdateAccount
 */
export interface UpdateAccount {
    /**
     * 
     * @type {string}
     * @memberof UpdateAccount
     */
    full_name?: string;
    /**
     * 
     * @type {string}
     * @memberof UpdateAccount
     */
    avatar_url?: string;
}
/**
 * 
 * @export
 * @interface UpdateAttributeDefinition
 */
export interface UpdateAttributeDefinition {
    [key: string]: any | any;
    /**
     * 
     * @type {string}
     * @memberof UpdateAttributeDefinition
     */
    key?: string;
    /**
     * 
     * @type {string}
     * @memberof UpdateAttributeDefinition
     */
    name?: string;
    /**
     * 
     * @type {boolean}
     * @memberof UpdateAttributeDefinition
     */
    required?: boolean;
    /**
     * 
     * @type {number}
     * @memberof UpdateAttributeDefinition
     */
    position?: number;
    /**
     * 
     * @type {UpdateAttributeDefinitionEnrichment}
     * @memberof UpdateAttributeDefinition
     */
    enrichment?: UpdateAttributeDefinitionEnrichment;
}
/**
 * 
 * @export
 * @interface UpdateAttributeDefinitionEnrichment
 */
export interface UpdateAttributeDefinitionEnrichment {
    /**
     * 
     * @type {string}
     * @memberof UpdateAttributeDefinitionEnrichment
     */
    prompt: string;
    /**
     * 
     * @type {string}
     * @memberof UpdateAttributeDefinitionEnrichment
     */
    refreshPolicy: string;
}
/**
 * 
 * @export
 * @interface UpdateAttributeDefinitionEnrichmentAnyOf
 */
export interface UpdateAttributeDefinitionEnrichmentAnyOf {
    /**
     * 
     * @type {string}
     * @memberof UpdateAttributeDefinitionEnrichmentAnyOf
     */
    prompt: string;
    /**
     * 
     * @type {string}
     * @memberof UpdateAttributeDefinitionEnrichmentAnyOf
     */
    refreshPolicy: string;
}
/**
 * 
 * @export
 * @interface UpdateChat
 */
export interface UpdateChat {
    /**
     * 
     * @type {string}
     * @memberof UpdateChat
     */
    title?: string;
    /**
     * 
     * @type {object}
     * @memberof UpdateChat
     */
    metadata?: object;
}
/**
 * 
 * @export
 * @interface UpdateComment
 */
export interface UpdateComment {
    /**
     * 
     * @type {string}
     * @memberof UpdateComment
     */
    content?: string;
    /**
     * 
     * @type {Array<string>}
     * @memberof UpdateComment
     */
    mentions?: Array<string>;
}
/**
 * 
 * @export
 * @interface UpdateFinding
 */
export interface UpdateFinding {
    /**
     * 
     * @type {string}
     * @memberof UpdateFinding
     */
    title?: string;
    /**
     * 
     * @type {string}
     * @memberof UpdateFinding
     */
    content?: string;
    /**
     * 
     * @type {Array<string>}
     * @memberof UpdateFinding
     */
    tags?: Array<string>;
}
/**
 * 
 * @export
 * @interface UpdateFindingSet
 */
export interface UpdateFindingSet {
    /**
     * 
     * @type {string}
     * @memberof UpdateFindingSet
     */
    name?: string;
    /**
     * 
     * @type {string}
     * @memberof UpdateFindingSet
     */
    description?: string;
    /**
     * 
     * @type {Array<string>}
     * @memberof UpdateFindingSet
     */
    finding_ids?: Array<string>;
}
/**
 * 
 * @export
 * @interface UpdateFolder
 */
export interface UpdateFolder {
    /**
     * 
     * @type {string}
     * @memberof UpdateFolder
     */
    name?: string;
    /**
     * 
     * @type {object}
     * @memberof UpdateFolder
     */
    icon?: object;
    /**
     * 
     * @type {boolean}
     * @memberof UpdateFolder
     */
    archived?: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof UpdateFolder
     */
    pinned?: boolean;
}
/**
 * 
 * @export
 * @interface UpdateFolderViewSettings
 */
export interface UpdateFolderViewSettings {
    /**
     * 
     * @type {UpdateFolderViewSettingsBoard}
     * @memberof UpdateFolderViewSettings
     */
    board?: UpdateFolderViewSettingsBoard;
    /**
     * 
     * @type {UpdateFolderViewSettingsBacklog}
     * @memberof UpdateFolderViewSettings
     */
    backlog?: UpdateFolderViewSettingsBacklog;
    /**
     * 
     * @type {UpdateFolderViewSettingsCalendar}
     * @memberof UpdateFolderViewSettings
     */
    calendar?: UpdateFolderViewSettingsCalendar;
}
/**
 * 
 * @export
 * @interface UpdateFolderViewSettingsBacklog
 */
export interface UpdateFolderViewSettingsBacklog {
    /**
     * 
     * @type {string}
     * @memberof UpdateFolderViewSettingsBacklog
     */
    group_by?: string;
}
/**
 * 
 * @export
 * @interface UpdateFolderViewSettingsBoard
 */
export interface UpdateFolderViewSettingsBoard {
    /**
     * 
     * @type {Array<string>}
     * @memberof UpdateFolderViewSettingsBoard
     */
    columns?: Array<string>;
}
/**
 * 
 * @export
 * @interface UpdateFolderViewSettingsCalendar
 */
export interface UpdateFolderViewSettingsCalendar {
    /**
     * 
     * @type {string}
     * @memberof UpdateFolderViewSettingsCalendar
     */
    default_view?: string;
}
/**
 * 
 * @export
 * @interface UpdateGroup
 */
export interface UpdateGroup {
    /**
     * 
     * @type {string}
     * @memberof UpdateGroup
     */
    name?: string;
    /**
     * 
     * @type {string}
     * @memberof UpdateGroup
     */
    description?: string;
}
/**
 * 
 * @export
 * @interface UpdateIteration
 */
export interface UpdateIteration {
    /**
     * 
     * @type {string}
     * @memberof UpdateIteration
     */
    name?: string;
    /**
     * 
     * @type {string}
     * @memberof UpdateIteration
     */
    goal?: string | null;
    /**
     * 
     * @type {string}
     * @memberof UpdateIteration
     */
    start_date?: string | null;
    /**
     * 
     * @type {string}
     * @memberof UpdateIteration
     */
    end_date?: string | null;
    /**
     * 
     * @type {string}
     * @memberof UpdateIteration
     */
    status?: UpdateIterationStatusEnum;
}


/**
 * @export
 */
export const UpdateIterationStatusEnum = {
    planning: 'planning',
    active: 'active',
    completed: 'completed'
} as const;
export type UpdateIterationStatusEnum = typeof UpdateIterationStatusEnum[keyof typeof UpdateIterationStatusEnum];

/**
 * 
 * @export
 * @interface UpdateKgEntity
 */
export interface UpdateKgEntity {
    /**
     * 
     * @type {string}
     * @memberof UpdateKgEntity
     */
    name?: string;
    /**
     * 
     * @type {string}
     * @memberof UpdateKgEntity
     */
    type?: UpdateKgEntityTypeEnum;
    /**
     * 
     * @type {string}
     * @memberof UpdateKgEntity
     */
    description?: string | null;
}


/**
 * @export
 */
export const UpdateKgEntityTypeEnum = {
    concept: 'concept',
    person: 'person',
    organization: 'organization',
    location: 'location',
    topic: 'topic',
    technology: 'technology',
    document: 'document',
    event: 'event',
    term: 'term'
} as const;
export type UpdateKgEntityTypeEnum = typeof UpdateKgEntityTypeEnum[keyof typeof UpdateKgEntityTypeEnum];

/**
 * 
 * @export
 * @interface UpdateLabel
 */
export interface UpdateLabel {
    /**
     * 
     * @type {string}
     * @memberof UpdateLabel
     */
    key?: string;
    /**
     * 
     * @type {string}
     * @memberof UpdateLabel
     */
    name?: string;
    /**
     * 
     * @type {string}
     * @memberof UpdateLabel
     */
    color?: string;
    /**
     * 
     * @type {string}
     * @memberof UpdateLabel
     */
    description?: string | null;
}
/**
 * 
 * @export
 * @interface UpdateOrganization
 */
export interface UpdateOrganization {
    /**
     * 
     * @type {string}
     * @memberof UpdateOrganization
     */
    name?: string;
    /**
     * 
     * @type {string}
     * @memberof UpdateOrganization
     */
    billing_email?: string;
    /**
     * 
     * @type {boolean}
     * @memberof UpdateOrganization
     */
    allow_overage?: boolean;
}
/**
 * 
 * @export
 * @interface UpdateOrganizationMemberRole
 */
export interface UpdateOrganizationMemberRole {
    /**
     * 
     * @type {string}
     * @memberof UpdateOrganizationMemberRole
     */
    role: UpdateOrganizationMemberRoleRoleEnum;
}


/**
 * @export
 */
export const UpdateOrganizationMemberRoleRoleEnum = {
    owner: 'owner',
    admin: 'admin',
    member: 'member',
    billing: 'billing',
    readonly: 'readonly'
} as const;
export type UpdateOrganizationMemberRoleRoleEnum = typeof UpdateOrganizationMemberRoleRoleEnum[keyof typeof UpdateOrganizationMemberRoleRoleEnum];

/**
 * 
 * @export
 * @interface UpdatePage
 */
export interface UpdatePage {
    /**
     * 
     * @type {string}
     * @memberof UpdatePage
     */
    title?: string;
    /**
     * 
     * @type {string}
     * @memberof UpdatePage
     */
    content?: string;
    /**
     * 
     * @type {object}
     * @memberof UpdatePage
     */
    icon?: object;
    /**
     * 
     * @type {object}
     * @memberof UpdatePage
     */
    cover?: object;
    /**
     * 
     * @type {boolean}
     * @memberof UpdatePage
     */
    archived?: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof UpdatePage
     */
    pinned?: boolean;
    /**
     * 
     * @type {number}
     * @memberof UpdatePage
     */
    expected_version?: number;
}
/**
 * Patch a share row. Toggle `is_active` to soft-delete; nullable `expires_at` and `message` are also editable.
 * @export
 * @interface UpdateShare
 */
export interface UpdateShare {
    /**
     * 
     * @type {boolean}
     * @memberof UpdateShare
     */
    inherits?: boolean;
    /**
     * 
     * @type {string}
     * @memberof UpdateShare
     */
    message?: string;
    /**
     * 
     * @type {string}
     * @memberof UpdateShare
     */
    expires_at?: string;
    /**
     * 
     * @type {boolean}
     * @memberof UpdateShare
     */
    is_active?: boolean;
}
/**
 * 
 * @export
 * @interface UpdateView
 */
export interface UpdateView {
    /**
     * 
     * @type {string}
     * @memberof UpdateView
     */
    name?: string;
    /**
     * 
     * @type {string}
     * @memberof UpdateView
     */
    visibility?: UpdateViewVisibilityEnum;
    /**
     * 
     * @type {object}
     * @memberof UpdateView
     */
    query?: object;
}


/**
 * @export
 */
export const UpdateViewVisibilityEnum = {
    private: 'private',
    shared: 'shared'
} as const;
export type UpdateViewVisibilityEnum = typeof UpdateViewVisibilityEnum[keyof typeof UpdateViewVisibilityEnum];

/**
 * PATCH semantics — fields omitted from the body keep their existing value. Nullable fields (`filter_types`, `channels`, `rate_limit`) accept explicit `null` to clear the setting.
 * @export
 * @interface UpdateWebhookEndpoint
 */
export interface UpdateWebhookEndpoint {
    /**
     * 
     * @type {string}
     * @memberof UpdateWebhookEndpoint
     */
    url?: string;
    /**
     * 
     * @type {string}
     * @memberof UpdateWebhookEndpoint
     */
    description?: string;
    /**
     * 
     * @type {Array<string>}
     * @memberof UpdateWebhookEndpoint
     */
    filter_types?: Array<string> | null;
    /**
     * 
     * @type {Array<string>}
     * @memberof UpdateWebhookEndpoint
     */
    channels?: Array<string> | null;
    /**
     * 
     * @type {number}
     * @memberof UpdateWebhookEndpoint
     */
    rate_limit?: number | null;
    /**
     * 
     * @type {boolean}
     * @memberof UpdateWebhookEndpoint
     */
    disabled?: boolean;
}
/**
 * 
 * @export
 * @interface UpdateWorkItem
 */
export interface UpdateWorkItem {
    /**
     * 
     * @type {string}
     * @memberof UpdateWorkItem
     */
    title?: string;
    /**
     * 
     * @type {string}
     * @memberof UpdateWorkItem
     */
    subject?: string | null;
    /**
     * 
     * @type {string}
     * @memberof UpdateWorkItem
     */
    description?: string | null;
    /**
     * 
     * @type {string}
     * @memberof UpdateWorkItem
     */
    state_key?: string;
    /**
     * 
     * @type {string}
     * @memberof UpdateWorkItem
     */
    priority?: UpdateWorkItemPriorityEnum;
    /**
     * 
     * @type {string}
     * @memberof UpdateWorkItem
     */
    due_date?: string | null;
    /**
     * 
     * @type {number}
     * @memberof UpdateWorkItem
     */
    estimate?: number | null;
    /**
     * 
     * @type {string}
     * @memberof UpdateWorkItem
     */
    assignee_id?: string | null;
    /**
     * 
     * @type {string}
     * @memberof UpdateWorkItem
     */
    assignee_name?: string | null;
    /**
     * 
     * @type {string}
     * @memberof UpdateWorkItem
     */
    dri_id?: string | null;
    /**
     * 
     * @type {string}
     * @memberof UpdateWorkItem
     */
    dri_name?: string | null;
    /**
     * Prefixed resource ID. Wire form: `wi_<base58>`.
     * @type {string}
     * @memberof UpdateWorkItem
     */
    parent_id?: string | null;
    /**
     * 
     * @type {number}
     * @memberof UpdateWorkItem
     */
    position?: number;
    /**
     * Prefixed resource ID. Wire form: `it_<base58>`.
     * @type {string}
     * @memberof UpdateWorkItem
     */
    iteration_id?: string | null;
    /**
     * Prefixed resource ID. Wire form: `fld_<base58>`.
     * @type {string}
     * @memberof UpdateWorkItem
     */
    folder_id?: string | null;
}


/**
 * @export
 */
export const UpdateWorkItemPriorityEnum = {
    none: 'none',
    low: 'low',
    medium: 'medium',
    high: 'high',
    urgent: 'urgent'
} as const;
export type UpdateWorkItemPriorityEnum = typeof UpdateWorkItemPriorityEnum[keyof typeof UpdateWorkItemPriorityEnum];

/**
 * 
 * @export
 * @interface UpdateWorkItemType
 */
export interface UpdateWorkItemType {
    /**
     * 
     * @type {string}
     * @memberof UpdateWorkItemType
     */
    key?: string;
    /**
     * 
     * @type {string}
     * @memberof UpdateWorkItemType
     */
    name?: string;
    /**
     * Prefixed resource ID. Wire form: `wf_<base58>`.
     * @type {string}
     * @memberof UpdateWorkItemType
     */
    default_workflow_id?: string;
}
/**
 * 
 * @export
 * @interface UpdateWorkflow
 */
export interface UpdateWorkflow {
    /**
     * 
     * @type {string}
     * @memberof UpdateWorkflow
     */
    name?: string;
    /**
     * 
     * @type {boolean}
     * @memberof UpdateWorkflow
     */
    is_default?: boolean;
}
/**
 * 
 * @export
 * @interface UpdateWorkflowState
 */
export interface UpdateWorkflowState {
    /**
     * 
     * @type {string}
     * @memberof UpdateWorkflowState
     */
    key?: string;
    /**
     * 
     * @type {string}
     * @memberof UpdateWorkflowState
     */
    name?: string;
    /**
     * 
     * @type {string}
     * @memberof UpdateWorkflowState
     */
    category?: UpdateWorkflowStateCategoryEnum;
    /**
     * 
     * @type {number}
     * @memberof UpdateWorkflowState
     */
    position?: number;
}


/**
 * @export
 */
export const UpdateWorkflowStateCategoryEnum = {
    not_started: 'not_started',
    active: 'active',
    done: 'done',
    dead: 'dead'
} as const;
export type UpdateWorkflowStateCategoryEnum = typeof UpdateWorkflowStateCategoryEnum[keyof typeof UpdateWorkflowStateCategoryEnum];

/**
 * Partial update. Renaming `key` does NOT rewrite existing work-item identifiers (identifiers are frozen at creation time, same posture as Linear / Jira).
 * @export
 * @interface UpdateWorkspace
 */
export interface UpdateWorkspace {
    /**
     * 
     * @type {string}
     * @memberof UpdateWorkspace
     */
    name?: string;
    /**
     * 
     * @type {string}
     * @memberof UpdateWorkspace
     */
    key?: string;
    /**
     * 
     * @type {{ [key: string]: string; }}
     * @memberof UpdateWorkspace
     */
    metadata?: { [key: string]: string; };
}
/**
 * Per-workspace / per-model / per-day / per-api-key / per-member / per-operation-type spend breakdown for the dashboard. The `data` array shape mirrors the `group_by` request param so the chart code branches on a single field.
 * @export
 * @interface UsageBreakdown
 */
export interface UsageBreakdown {
    /**
     * Prefixed resource ID. Wire form: `org_<base58>`.
     * @type {string}
     * @memberof UsageBreakdown
     */
    organization_id: string;
    /**
     * 
     * @type {string}
     * @memberof UsageBreakdown
     */
    group_by: UsageBreakdownGroupByEnum;
    /**
     * 
     * @type {string}
     * @memberof UsageBreakdown
     */
    period_start: string;
    /**
     * 
     * @type {string}
     * @memberof UsageBreakdown
     */
    period_end: string;
    /**
     * 
     * @type {UsageBreakdownData}
     * @memberof UsageBreakdown
     */
    data: UsageBreakdownData;
}


/**
 * @export
 */
export const UsageBreakdownGroupByEnum = {
    workspace: 'workspace',
    model: 'model',
    day: 'day',
    api_key: 'api_key',
    member: 'member',
    operation_type: 'operation_type'
} as const;
export type UsageBreakdownGroupByEnum = typeof UsageBreakdownGroupByEnum[keyof typeof UsageBreakdownGroupByEnum];

/**
 * 
 * @export
 * @interface UsageBreakdownData
 */
export interface UsageBreakdownData {
}
/**
 * Per-key billing attribution row. Sorted by `total_cost_cents` descending so the heaviest spender is at index 0. The `null` lump row (when present) appears last.
 * @export
 * @interface UsageByApiKey
 */
export interface UsageByApiKey {
    /**
     * 
     * @type {string}
     * @memberof UsageByApiKey
     */
    api_key_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof UsageByApiKey
     */
    name: string | null;
    /**
     * 
     * @type {string}
     * @memberof UsageByApiKey
     */
    last4: string | null;
    /**
     * Sum of tokens charged to this key in the period.
     * @type {number}
     * @memberof UsageByApiKey
     */
    token_count: number;
    /**
     * USD spend attributed to this key in the period, in cents.
     * @type {number}
     * @memberof UsageByApiKey
     */
    total_cost_cents: number;
}
/**
 * 
 * @export
 * @interface UsageByDay
 */
export interface UsageByDay {
    /**
     * 
     * @type {string}
     * @memberof UsageByDay
     */
    day: string;
    /**
     * 
     * @type {number}
     * @memberof UsageByDay
     */
    token_count: number;
    /**
     * 
     * @type {number}
     * @memberof UsageByDay
     */
    total_cost_cents: number;
}
/**
 * Per-member spend attribution row ("which member spent what") — the OpenAI `group_by=user_id` equivalent. `account_id` / `name` / `email` are `null` on the "no member" lump aggregating system / cron / api-key-without-Acting-User spend; that row is pinned last, member rows sort by spend descending.
 * @export
 * @interface UsageByMember
 */
export interface UsageByMember {
    /**
     * Prefixed resource ID. Wire form: `acc_<base58>`.
     * @type {string}
     * @memberof UsageByMember
     */
    account_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof UsageByMember
     */
    name: string | null;
    /**
     * 
     * @type {string}
     * @memberof UsageByMember
     */
    email: string | null;
    /**
     * 
     * @type {number}
     * @memberof UsageByMember
     */
    token_count: number;
    /**
     * 
     * @type {number}
     * @memberof UsageByMember
     */
    total_cost_cents: number;
}
/**
 * 
 * @export
 * @interface UsageByModel
 */
export interface UsageByModel {
    /**
     * 
     * @type {string}
     * @memberof UsageByModel
     */
    model_id: string;
    /**
     * 
     * @type {string}
     * @memberof UsageByModel
     */
    display_name: string | null;
    /**
     * 
     * @type {string}
     * @memberof UsageByModel
     */
    provider: string | null;
    /**
     * 
     * @type {number}
     * @memberof UsageByModel
     */
    token_count: number;
    /**
     * 
     * @type {number}
     * @memberof UsageByModel
     */
    total_cost_cents: number;
}
/**
 * "What kind of work is consuming the budget" row (chat, graph_build, embedding, rerank, lens extraction, …). Vendor-paid operation types are excluded so the card reconciles with the budget + window meters.
 * @export
 * @interface UsageByOperationType
 */
export interface UsageByOperationType {
    /**
     * 
     * @type {string}
     * @memberof UsageByOperationType
     */
    operation_type: string;
    /**
     * 
     * @type {number}
     * @memberof UsageByOperationType
     */
    token_count: number;
    /**
     * 
     * @type {number}
     * @memberof UsageByOperationType
     */
    total_cost_cents: number;
}
/**
 * Per-organization spend row in the Account-level consolidated usage view. Each row carries the org’s own period window — orgs on different plans bill on different cycles.
 * @export
 * @interface UsageByOrganization
 */
export interface UsageByOrganization {
    /**
     * Prefixed resource ID. Wire form: `org_<base58>`.
     * @type {string}
     * @memberof UsageByOrganization
     */
    organization_id: string;
    /**
     * 
     * @type {string}
     * @memberof UsageByOrganization
     */
    name: string;
    /**
     * 
     * @type {number}
     * @memberof UsageByOrganization
     */
    token_count: number;
    /**
     * 
     * @type {number}
     * @memberof UsageByOrganization
     */
    total_cost_cents: number;
    /**
     * 
     * @type {string}
     * @memberof UsageByOrganization
     */
    period_start: string | null;
    /**
     * 
     * @type {string}
     * @memberof UsageByOrganization
     */
    period_end: string | null;
}
/**
 * 
 * @export
 * @interface UsageByWorkspace
 */
export interface UsageByWorkspace {
    /**
     * Prefixed resource ID. Wire form: `ws_<base58>`.
     * @type {string}
     * @memberof UsageByWorkspace
     */
    workspace_id: string;
    /**
     * 
     * @type {string}
     * @memberof UsageByWorkspace
     */
    name: string | null;
    /**
     * 
     * @type {string}
     * @memberof UsageByWorkspace
     */
    key: string | null;
    /**
     * 
     * @type {number}
     * @memberof UsageByWorkspace
     */
    token_count: number;
    /**
     * 
     * @type {number}
     * @memberof UsageByWorkspace
     */
    total_cost_cents: number;
}

/**
 * `inference_included` (platform keys, debited from balance lots) vs `byok` (user attaches own LLM provider key; platform never debits inference tokens).
 * @export
 */
export const UsageMode = {
    inference_included: 'inference_included',
    byok: 'byok'
} as const;
export type UsageMode = typeof UsageMode[keyof typeof UsageMode];

/**
 * Composite "current period at a glance" payload. Combines the budget cap snapshot with the realised spend / token count + a per-api-key breakdown for cost attribution.
 * @export
 * @interface UsageSummary
 */
export interface UsageSummary {
    /**
     * The caller's OWN organization id (echoed for client-side multi-org dropdown correlation). Never a cross-tenant reference — the controller resolves it from the auth token.
     * @type {string}
     * @memberof UsageSummary
     */
    organization_id: string;
    /**
     * 
     * @type {Budget}
     * @memberof UsageSummary
     */
    budget: Budget;
    /**
     * Rolling-window meters (session 5hr / weekly 7d). Empty array when no window caps are configured for this environment.
     * @type {Array<RollingWindow>}
     * @memberof UsageSummary
     */
    windows: Array<RollingWindow>;
    /**
     * 
     * @type {string}
     * @memberof UsageSummary
     */
    projected_exhaustion_at: string | null;
    /**
     * 
     * @type {UsageSummaryUsage}
     * @memberof UsageSummary
     */
    usage: UsageSummaryUsage;
    /**
     * Per-api-key spend breakdown for the same period covered by `usage`. Sums across all entries equal `usage.total_cost_cents` and `usage.token_count`. Empty array when no spend yet.
     * @type {Array<UsageByApiKey>}
     * @memberof UsageSummary
     */
    by_api_key: Array<UsageByApiKey>;
}
/**
 * 
 * @export
 * @interface UsageSummaryUsage
 */
export interface UsageSummaryUsage {
    /**
     * Sum of input + output tokens consumed in the current period. RAW token count — NOT cents, NOT dollars.
     * @type {number}
     * @memberof UsageSummaryUsage
     */
    token_count: number;
    /**
     * USD spend in the current period, in cents.
     * @type {number}
     * @memberof UsageSummaryUsage
     */
    total_cost_cents: number;
}
/**
 * Result of pre-flighting an LLM-billed action against the caller's budget. `allowed=false` means the request would be rejected by the LLM token enforcer with HTTP 429.
 * @export
 * @interface UsageValidation
 */
export interface UsageValidation {
    /**
     * 
     * @type {boolean}
     * @memberof UsageValidation
     */
    allowed: boolean;
    /**
     * 
     * @type {string}
     * @memberof UsageValidation
     */
    reason?: string;
    /**
     * 
     * @type {string}
     * @memberof UsageValidation
     */
    selected_model: string;
    /**
     * 
     * @type {string}
     * @memberof UsageValidation
     */
    estimated_cost: string;
    /**
     * 
     * @type {number}
     * @memberof UsageValidation
     */
    remaining_cents: number;
    /**
     * 
     * @type {number}
     * @memberof UsageValidation
     */
    usage_percentage: number;
    /**
     * 
     * @type {boolean}
     * @memberof UsageValidation
     */
    fallback_used: boolean;
    /**
     * 
     * @type {string}
     * @memberof UsageValidation
     */
    warning_message?: string;
}
/**
 * Management projection of a personal-access-token row. Hashed token, owning account id, and tenancy ids are deliberately excluded — they are either secrets or implied by the caller session. `token` is set on issuance only; lists / revokes never carry it.
 * @export
 * @interface UserApiToken
 */
export interface UserApiToken {
    /**
     * Prefixed resource ID. Wire form: `uat_<base58>`.
     * @type {string}
     * @memberof UserApiToken
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof UserApiToken
     */
    name: string;
    /**
     * Public, non-secret prefix (e.g. `sk_user_abcd`). Stable across the token's lifetime.
     * @type {string}
     * @memberof UserApiToken
     */
    token_prefix: string;
    /**
     * Last four characters of the raw token. Used together with `token_prefix` to identify a row in the management UI without leaking the secret.
     * @type {string}
     * @memberof UserApiToken
     */
    token_last4: string;
    /**
     * 
     * @type {string}
     * @memberof UserApiToken
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof UserApiToken
     */
    expires_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof UserApiToken
     */
    last_used_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof UserApiToken
     */
    last_used_ip: string | null;
    /**
     * 
     * @type {string}
     * @memberof UserApiToken
     */
    revoked_at: string | null;
    /**
     * The raw `sk_user_...` token. Populated ONLY on the creation response (`POST /v1/user/api_tokens`). After this single echo, the platform cannot recover it — issue a new token if lost.
     * @type {string}
     * @memberof UserApiToken
     */
    token?: string;
}
/**
 * Public projection of a `user_llm_credentials` row. Vault internals (`encryptedKey`, `nonce`, `authTag`, `encryptionKeyVersion`) and the owning `userId` are deliberately excluded.
 * @export
 * @interface UserLlmCredential
 */
export interface UserLlmCredential {
    /**
     * Prefixed resource ID. Wire form: `cred_<base58>`.
     * @type {string}
     * @memberof UserLlmCredential
     */
    id: string;
    /**
     * Provider id (one of the `ByokProvider` values). Stored as a free string on the wire to avoid over-coupling clients to the enum tightening.
     * @type {string}
     * @memberof UserLlmCredential
     */
    provider: string;
    /**
     * 
     * @type {string}
     * @memberof UserLlmCredential
     */
    label: string | null;
    /**
     * First 8 characters of the SHA-256 fingerprint of the key. Stable across sessions; used to identify a credential without leaking the secret.
     * @type {string}
     * @memberof UserLlmCredential
     */
    key_fingerprint_short: string;
    /**
     * Last four characters of the raw key. Together with `key_fingerprint_short`, lets users tell two keys apart in the management UI.
     * @type {string}
     * @memberof UserLlmCredential
     */
    key_last4: string;
    /**
     * 
     * @type {string}
     * @memberof UserLlmCredential
     */
    last_tested_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof UserLlmCredential
     */
    last_test_result: string | null;
    /**
     * 
     * @type {string}
     * @memberof UserLlmCredential
     */
    revoked_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof UserLlmCredential
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof UserLlmCredential
     */
    updated_at: string;
}
/**
 * 
 * @export
 * @interface V1SearchFeedbackPost201Response
 */
export interface V1SearchFeedbackPost201Response {
    /**
     * 
     * @type {string}
     * @memberof V1SearchFeedbackPost201Response
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof V1SearchFeedbackPost201Response
     */
    signal: string;
    /**
     * 
     * @type {string}
     * @memberof V1SearchFeedbackPost201Response
     */
    source_type: string;
    /**
     * 
     * @type {string}
     * @memberof V1SearchFeedbackPost201Response
     */
    source_id: string;
    /**
     * 
     * @type {string}
     * @memberof V1SearchFeedbackPost201Response
     */
    created_at: string;
    /**
     * 
     * @type {boolean}
     * @memberof V1SearchFeedbackPost201Response
     */
    recorded: V1SearchFeedbackPost201ResponseRecordedEnum;
}


/**
 * @export
 */
export const V1SearchFeedbackPost201ResponseRecordedEnum = {
    false: false
} as const;
export type V1SearchFeedbackPost201ResponseRecordedEnum = typeof V1SearchFeedbackPost201ResponseRecordedEnum[keyof typeof V1SearchFeedbackPost201ResponseRecordedEnum];

/**
 * 
 * @export
 * @interface V1ViewsGetOwnerParameter
 */
export interface V1ViewsGetOwnerParameter {
}
/**
 * 
 * @export
 * @interface V1WorkItemsIdSubtasksGet200Response
 */
export interface V1WorkItemsIdSubtasksGet200Response {
    [key: string]: any | any;
    /**
     * 
     * @type {Array<WorkItem>}
     * @memberof V1WorkItemsIdSubtasksGet200Response
     */
    work_items: Array<WorkItem>;
}
/**
 * 
 * @export
 * @interface V1WorkItemsWorkItemIdCommentsPostRequest
 */
export interface V1WorkItemsWorkItemIdCommentsPostRequest {
    /**
     * 
     * @type {string}
     * @memberof V1WorkItemsWorkItemIdCommentsPostRequest
     */
    content: string;
    /**
     * 
     * @type {Array<string>}
     * @memberof V1WorkItemsWorkItemIdCommentsPostRequest
     */
    mentions?: Array<string>;
}
/**
 * 
 * @export
 * @interface ValidateUsage
 */
export interface ValidateUsage {
    /**
     * 
     * @type {string}
     * @memberof ValidateUsage
     */
    action?: string;
    /**
     * 
     * @type {string}
     * @memberof ValidateUsage
     */
    model?: string;
    /**
     * 
     * @type {number}
     * @memberof ValidateUsage
     */
    estimated_tokens?: number;
}
/**
 * A saved query spec for a board / list / backlog / calendar surface.
 * @export
 * @interface View
 */
export interface View {
    /**
     * Prefixed resource ID. Wire form: `view_<base58>`.
     * @type {string}
     * @memberof View
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof View
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof View
     */
    kind: string;
    /**
     * 
     * @type {string}
     * @memberof View
     */
    visibility: ViewVisibilityEnum;
    /**
     * Prefixed resource ID. Wire form: `ws_<base58>`.
     * @type {string}
     * @memberof View
     */
    workspace_id: string;
    /**
     * Opaque polymorphic actor reference (Actor Contract; see docs/platform/polymorphic-actor-refactor.md) — raw text post-slice-9, not a prefixed-ID. Column name preserved.
     * @type {string}
     * @memberof View
     */
    owner_account_id: string;
    /**
     * 
     * @type {string}
     * @memberof View
     */
    owner_name: string | null;
    /**
     * 
     * @type {any}
     * @memberof View
     */
    query: any | null;
    /**
     * 
     * @type {string}
     * @memberof View
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof View
     */
    updated_at: string;
}


/**
 * @export
 */
export const ViewVisibilityEnum = {
    private: 'private',
    shared: 'shared'
} as const;
export type ViewVisibilityEnum = typeof ViewVisibilityEnum[keyof typeof ViewVisibilityEnum];

/**
 * 
 * @export
 * @interface ViewEnvelope
 */
export interface ViewEnvelope {
    /**
     * 
     * @type {View}
     * @memberof ViewEnvelope
     */
    view: View;
}
/**
 * 
 * @export
 * @interface ViewListEnvelope
 */
export interface ViewListEnvelope {
    /**
     * 
     * @type {Array<View>}
     * @memberof ViewListEnvelope
     */
    data: Array<View>;
}

/**
 * 
 * @export
 */
export const Visibility = {
    private: 'private',
    internal: 'internal',
    public: 'public'
} as const;
export type Visibility = typeof Visibility[keyof typeof Visibility];

/**
 * A webhook endpoint subscribed to platform events. The `id` is our prefixed `whep_*` value — internally we mint it on create and pass it as Svix's `uid`, so all subsequent ops route through it. Consumers never see Svix's internal `ep_*` id.
 * @export
 * @interface WebhookEndpoint
 */
export interface WebhookEndpoint {
    /**
     * Prefixed resource ID. Wire form: `whep_<base58>`.
     * @type {string}
     * @memberof WebhookEndpoint
     */
    id: string;
    /**
     * Destination URL Svix POSTs webhook deliveries to.
     * @type {string}
     * @memberof WebhookEndpoint
     */
    url: string;
    /**
     * Human-readable label for the endpoint.
     * @type {string}
     * @memberof WebhookEndpoint
     */
    description: string;
    /**
     * 
     * @type {Array<string>}
     * @memberof WebhookEndpoint
     */
    filter_types: Array<string> | null;
    /**
     * 
     * @type {Array<string>}
     * @memberof WebhookEndpoint
     */
    channels: Array<string> | null;
    /**
     * 
     * @type {number}
     * @memberof WebhookEndpoint
     */
    rate_limit: number | null;
    /**
     * Operator-controlled pause flag. `true` halts delivery without deleting the endpoint.
     * @type {boolean}
     * @memberof WebhookEndpoint
     */
    disabled: boolean;
    /**
     * 
     * @type {string}
     * @memberof WebhookEndpoint
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof WebhookEndpoint
     */
    updated_at: string;
}
/**
 * 
 * @export
 * @interface WebhookEndpointPage
 */
export interface WebhookEndpointPage {
    /**
     * 
     * @type {Array<WebhookEndpoint>}
     * @memberof WebhookEndpointPage
     */
    data: Array<WebhookEndpoint>;
    /**
     * 
     * @type {boolean}
     * @memberof WebhookEndpointPage
     */
    has_more: boolean;
    /**
     * 
     * @type {string}
     * @memberof WebhookEndpointPage
     */
    next_page_url: string | null;
    /**
     * 
     * @type {string}
     * @memberof WebhookEndpointPage
     */
    previous_page_url: string | null;
}
/**
 * Time-limited Svix portal session. Customers open the URL in a new tab to add/manage endpoints, view delivery history, and rotate signing secrets — Svix owns the UX so we don't surface endpoint CRUD ourselves.
 * @export
 * @interface WebhookPortalResponse
 */
export interface WebhookPortalResponse {
    /**
     * Magic link into Svix's hosted app portal (one-hour TTL).
     * @type {string}
     * @memberof WebhookPortalResponse
     */
    url: string;
    /**
     * 
     * @type {string}
     * @memberof WebhookPortalResponse
     */
    expiresAt: string;
}
/**
 * A unit of work. Recursive via `parent_id`. Replaces task / epic / story across vertical templates — see docs/platform/multi-tenant-model.md § work_item.
 * @export
 * @interface WorkItem
 */
export interface WorkItem {
    /**
     * Prefixed resource ID. Wire form: `wi_<base58>`.
     * @type {string}
     * @memberof WorkItem
     */
    id: string;
    /**
     * Workspace-scoped human id (e.g. `GEN-42`).
     * @type {string}
     * @memberof WorkItem
     */
    identifier: string;
    /**
     * 
     * @type {string}
     * @memberof WorkItem
     */
    title: string;
    /**
     * 
     * @type {string}
     * @memberof WorkItem
     */
    subject: string | null;
    /**
     * 
     * @type {string}
     * @memberof WorkItem
     */
    description: string | null;
    /**
     * Prefixed resource ID. Wire form: `ws_<base58>`.
     * @type {string}
     * @memberof WorkItem
     */
    workspace_id: string;
    /**
     * Prefixed resource ID. Wire form: `fld_<base58>`.
     * @type {string}
     * @memberof WorkItem
     */
    folder_id: string | null;
    /**
     * 
     * @type {WorkItemState}
     * @memberof WorkItem
     */
    state: WorkItemState;
    /**
     * 
     * @type {WorkItemType}
     * @memberof WorkItem
     */
    type: WorkItemType;
    /**
     * 
     * @type {WorkItemPriority}
     * @memberof WorkItem
     */
    priority: WorkItemPriority;
    /**
     * 
     * @type {number}
     * @memberof WorkItem
     */
    position: number;
    /**
     * Prefixed resource ID. Wire form: `it_<base58>`.
     * @type {string}
     * @memberof WorkItem
     */
    iteration_id: string | null;
    /**
     * Prefixed resource ID. Wire form: `wi_<base58>`.
     * @type {string}
     * @memberof WorkItem
     */
    parent_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof WorkItem
     */
    assignee_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof WorkItem
     */
    assignee_name: string | null;
    /**
     * 
     * @type {string}
     * @memberof WorkItem
     */
    dri_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof WorkItem
     */
    dri_name: string | null;
    /**
     * Polymorphic actor reference for the creator (slice 2 of the polymorphic-actor refactor). Opaque text the tenant owns; always non-null.
     * @type {string}
     * @memberof WorkItem
     */
    created_by_id: string;
    /**
     * 
     * @type {string}
     * @memberof WorkItem
     */
    created_by_name: string | null;
    /**
     * 
     * @type {string}
     * @memberof WorkItem
     */
    due_date: string | null;
    /**
     * 
     * @type {number}
     * @memberof WorkItem
     */
    estimate: number | null;
    /**
     * 
     * @type {Visibility}
     * @memberof WorkItem
     */
    visibility: Visibility;
    /**
     * Optimistic-concurrency version (AIP-154). Round-trip via `If-Match: W/"v<n>"` on PATCH / DELETE or the mutation rejects with 428.
     * @type {number}
     * @memberof WorkItem
     */
    version: number;
    /**
     * 
     * @type {string}
     * @memberof WorkItem
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof WorkItem
     */
    updated_at: string;
    /**
     * 
     * @type {string}
     * @memberof WorkItem
     */
    completed_at: string | null;
}


/**
 * Bulk-update envelope. The `work_items` key is snake_case in line with the platform-wide field-naming convention.
 * @export
 * @interface WorkItemBulkResponse
 */
export interface WorkItemBulkResponse {
    /**
     * 
     * @type {Array<WorkItem>}
     * @memberof WorkItemBulkResponse
     */
    work_items: Array<WorkItem>;
}
/**
 * Single-row envelope. The `work_item` key is snake_case in line with the platform-wide field-naming convention (Stripe v2 style; see `docs/platform/api-discipline.md` § "Field naming").
 * @export
 * @interface WorkItemEnvelope
 */
export interface WorkItemEnvelope {
    /**
     * 
     * @type {WorkItem}
     * @memberof WorkItemEnvelope
     */
    work_item: WorkItem;
}
/**
 * Junction row from the attach endpoint. The list endpoint on a work item returns joined `Label` rows instead.
 * @export
 * @interface WorkItemLabel
 */
export interface WorkItemLabel {
    /**
     * Prefixed resource ID. Wire form: `wilbl_<base58>`.
     * @type {string}
     * @memberof WorkItemLabel
     */
    id: string;
    /**
     * Prefixed resource ID. Wire form: `wi_<base58>`.
     * @type {string}
     * @memberof WorkItemLabel
     */
    work_item_id: string;
    /**
     * Prefixed resource ID. Wire form: `lbl_<base58>`.
     * @type {string}
     * @memberof WorkItemLabel
     */
    label_id: string;
    /**
     * 
     * @type {string}
     * @memberof WorkItemLabel
     */
    created_at: string;
}
/**
 * 
 * @export
 * @interface WorkItemLabelEnvelope
 */
export interface WorkItemLabelEnvelope {
    /**
     * 
     * @type {WorkItemLabel}
     * @memberof WorkItemLabelEnvelope
     */
    attachment: WorkItemLabel;
}
/**
 * 
 * @export
 * @interface WorkItemListEnvelope
 */
export interface WorkItemListEnvelope {
    /**
     * 
     * @type {Array<WorkItem>}
     * @memberof WorkItemListEnvelope
     */
    data: Array<WorkItem>;
    /**
     * 
     * @type {boolean}
     * @memberof WorkItemListEnvelope
     */
    has_more: boolean;
    /**
     * 
     * @type {string}
     * @memberof WorkItemListEnvelope
     */
    next_page_url: string | null;
    /**
     * 
     * @type {string}
     * @memberof WorkItemListEnvelope
     */
    previous_page_url: string | null;
}

/**
 * 
 * @export
 */
export const WorkItemPriority = {
    none: 'none',
    low: 'low',
    medium: 'medium',
    high: 'high',
    urgent: 'urgent'
} as const;
export type WorkItemPriority = typeof WorkItemPriority[keyof typeof WorkItemPriority];

/**
 * Inline workflow-state projection on a work item. SDK callers filter / group by `state.category` (the platform-wide bucket) without knowing tenant-specific state keys.
 * @export
 * @interface WorkItemState
 */
export interface WorkItemState {
    /**
     * Prefixed resource ID. Wire form: `wfs_<base58>`.
     * @type {string}
     * @memberof WorkItemState
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof WorkItemState
     */
    key: string;
    /**
     * 
     * @type {string}
     * @memberof WorkItemState
     */
    name: string;
    /**
     * 
     * @type {WorkflowStateCategory}
     * @memberof WorkItemState
     */
    category: WorkflowStateCategory;
}


/**
 * Inline work-item-type projection. Surfaced by `key` so vertical templates (Bug / Case / Matter) are first-class on the wire.
 * @export
 * @interface WorkItemType
 */
export interface WorkItemType {
    /**
     * Prefixed resource ID. Wire form: `wit_<base58>`.
     * @type {string}
     * @memberof WorkItemType
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof WorkItemType
     */
    key: string;
    /**
     * 
     * @type {string}
     * @memberof WorkItemType
     */
    name: string;
}
/**
 * Single-row envelope. The `work_item_type` key is snake_case in line with the platform-wide field-naming convention (Stripe v2 style; see `docs/platform/api-discipline.md` § "Field naming").
 * @export
 * @interface WorkItemTypeEnvelope
 */
export interface WorkItemTypeEnvelope {
    /**
     * 
     * @type {WorkItemTypeResource}
     * @memberof WorkItemTypeEnvelope
     */
    work_item_type: WorkItemTypeResource;
}
/**
 * 
 * @export
 * @interface WorkItemTypeListEnvelope
 */
export interface WorkItemTypeListEnvelope {
    /**
     * 
     * @type {Array<WorkItemTypeResource>}
     * @memberof WorkItemTypeListEnvelope
     */
    data: Array<WorkItemTypeResource>;
}
/**
 * Full WorkItemType row. The platform also publishes a minimal inline projection (`WorkItemType` = `{ id, key, name }`) on the `WorkItem` / `Task` shape — that one is the wire-side shorthand for joins, this one is the addressable resource.
 * @export
 * @interface WorkItemTypeResource
 */
export interface WorkItemTypeResource {
    /**
     * Prefixed resource ID. Wire form: `wit_<base58>`.
     * @type {string}
     * @memberof WorkItemTypeResource
     */
    id: string;
    /**
     * Prefixed resource ID. Wire form: `ws_<base58>`.
     * @type {string}
     * @memberof WorkItemTypeResource
     */
    workspace_id: string;
    /**
     * Stable slug (lowercase, digits, underscores, 1–40 chars, starts with a letter). Same grammar as `WorkflowState.key` so SDKs see one slug shape across primitives.
     * @type {string}
     * @memberof WorkItemTypeResource
     */
    key: string;
    /**
     * 
     * @type {string}
     * @memberof WorkItemTypeResource
     */
    name: string;
    /**
     * Workflow new work items of this type are seeded into. Must belong to the same workspace; cross-workspace binds reject with `workflow_wrong_workspace`.
     * @type {string}
     * @memberof WorkItemTypeResource
     */
    default_workflow_id: string;
    /**
     * 
     * @type {string}
     * @memberof WorkItemTypeResource
     */
    template_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof WorkItemTypeResource
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof WorkItemTypeResource
     */
    updated_at: string;
}
/**
 * A state machine scoped to a workspace. Owns an ordered set of `WorkflowState`s; consumed by `WorkItemType` (default workflow per type) and `WorkItem` (current state).
 * @export
 * @interface Workflow
 */
export interface Workflow {
    /**
     * Prefixed resource ID. Wire form: `wf_<base58>`.
     * @type {string}
     * @memberof Workflow
     */
    id: string;
    /**
     * Prefixed resource ID. Wire form: `ws_<base58>`.
     * @type {string}
     * @memberof Workflow
     */
    workspace_id: string;
    /**
     * 
     * @type {string}
     * @memberof Workflow
     */
    name: string;
    /**
     * 
     * @type {boolean}
     * @memberof Workflow
     */
    is_default: boolean;
    /**
     * 
     * @type {string}
     * @memberof Workflow
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Workflow
     */
    updated_at: string;
}
/**
 * 
 * @export
 * @interface WorkflowEnvelope
 */
export interface WorkflowEnvelope {
    /**
     * 
     * @type {Workflow}
     * @memberof WorkflowEnvelope
     */
    workflow: Workflow;
}
/**
 * 
 * @export
 * @interface WorkflowListEnvelope
 */
export interface WorkflowListEnvelope {
    /**
     * 
     * @type {Array<Workflow>}
     * @memberof WorkflowListEnvelope
     */
    data: Array<Workflow>;
}
/**
 * One node in a workflow's state machine. `category` is a platform-wide semantic bucket (not_started / active / done / dead) so downstream primitives reason about progress without knowing tenant-specific `key` or `name`.
 * @export
 * @interface WorkflowState
 */
export interface WorkflowState {
    /**
     * Prefixed resource ID. Wire form: `wfs_<base58>`.
     * @type {string}
     * @memberof WorkflowState
     */
    id: string;
    /**
     * Prefixed resource ID. Wire form: `wf_<base58>`.
     * @type {string}
     * @memberof WorkflowState
     */
    workflow_id: string;
    /**
     * Stable slug (lowercase, digits, underscores, 1–40 chars). Rename-safe — clients identify states by `key` even though internal joins go through `id`.
     * @type {string}
     * @memberof WorkflowState
     */
    key: string;
    /**
     * 
     * @type {string}
     * @memberof WorkflowState
     */
    name: string;
    /**
     * 
     * @type {WorkflowStateCategory}
     * @memberof WorkflowState
     */
    category: WorkflowStateCategory;
    /**
     * 
     * @type {number}
     * @memberof WorkflowState
     */
    position: number;
    /**
     * 
     * @type {string}
     * @memberof WorkflowState
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof WorkflowState
     */
    updated_at: string;
}



/**
 * 
 * @export
 */
export const WorkflowStateCategory = {
    not_started: 'not_started',
    active: 'active',
    done: 'done',
    dead: 'dead'
} as const;
export type WorkflowStateCategory = typeof WorkflowStateCategory[keyof typeof WorkflowStateCategory];

/**
 * 
 * @export
 * @interface WorkflowStateEnvelope
 */
export interface WorkflowStateEnvelope {
    /**
     * 
     * @type {WorkflowState}
     * @memberof WorkflowStateEnvelope
     */
    state: WorkflowState;
}
/**
 * 
 * @export
 * @interface WorkflowStateListEnvelope
 */
export interface WorkflowStateListEnvelope {
    /**
     * 
     * @type {Array<WorkflowState>}
     * @memberof WorkflowStateListEnvelope
     */
    data: Array<WorkflowState>;
}
/**
 * A workflow plus its ordered states. Returned on single-workflow GET / POST so the SDK can render the state machine without a second round-trip.
 * @export
 * @interface WorkflowWithStates
 */
export interface WorkflowWithStates {
    /**
     * 
     * @type {Workflow}
     * @memberof WorkflowWithStates
     */
    workflow: Workflow;
    /**
     * 
     * @type {Array<WorkflowState>}
     * @memberof WorkflowWithStates
     */
    states: Array<WorkflowState>;
}
/**
 * Customer-facing projection of a `control.workspaces` row. Workspace is the SOLE data-isolation boundary — RLS on every `app.*` table gates on `(organization_id, workspace_id)`. Uniform isolated universe; no mode / livemode / sandbox / prod discriminator.
 * @export
 * @interface Workspace
 */
export interface Workspace {
    /**
     * Prefixed resource ID. Wire form: `ws_<base58>`.
     * @type {string}
     * @memberof Workspace
     */
    id: string;
    /**
     * Prefixed resource ID. Wire form: `org_<base58>`.
     * @type {string}
     * @memberof Workspace
     */
    organization_id: string;
    /**
     * 
     * @type {string}
     * @memberof Workspace
     */
    name: string;
    /**
     * Short uppercase identifier code (2-10 chars, A-Z/0-9, starts with a letter). Used as the prefix for work-item identifiers (e.g. `SALES-42`). Customer-editable; unique within the organization (soft-delete aware).
     * @type {string}
     * @memberof Workspace
     */
    key: string;
    /**
     * 
     * @type {{ [key: string]: string; }}
     * @memberof Workspace
     */
    metadata: { [key: string]: string; };
    /**
     * Platform-owned module discriminators (`sales`, `legal`, …) stamped by workspace-template application. Read-only over the wire; consumers derive an organization’s enabled module surfaces from the union across its workspaces.
     * @type {Array<string>}
     * @memberof Workspace
     */
    module_keys: Array<string>;
    /**
     * 
     * @type {string}
     * @memberof Workspace
     */
    expires_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof Workspace
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Workspace
     */
    updated_at: string;
}
/**
 * 
 * @export
 * @interface WorkspaceListResponse
 */
export interface WorkspaceListResponse {
    /**
     * 
     * @type {Array<Workspace>}
     * @memberof WorkspaceListResponse
     */
    workspaces: Array<Workspace>;
}
