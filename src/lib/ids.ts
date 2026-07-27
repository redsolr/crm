/**
 * Prefixed-ID type aliases — mirror the platform's prefix registry at
 * `platform/src/common/ids/prefix-registry.ts`. Each alias is a
 * template literal type that the TS compiler enforces at the wire
 * boundary. Refining `id: string` to `id: WorkItemId` doesn't change
 * runtime behavior — it just catches "passed a project id where a
 * work_item id was expected" bugs at build time.
 *
 * See `docs/platform/api-discipline.md` § A1 for the wire convention.
 */

export type AccountId = `acc_${string}`;
export type OrganizationId = `org_${string}`;
export type OrganizationMemberId = `mem_${string}`;
export type ProjectId = `pr_${string}`;
export type WorkspaceId = `ws_${string}`;
export type ApiKeyId = `ak_${string}`;

export type ActivityId = `act_${string}`;
export type AttributeId = `attr_${string}`;
export type EventId = `evt_${string}`;
export type IterationId = `it_${string}`;
export type LabelId = `lbl_${string}`;
export type PolicyId = `pol_${string}`;
export type RelationId = `rel_${string}`;
export type RoleId = `role_${string}`;
export type ViewId = `view_${string}`;
export type WorkflowId = `wf_${string}`;
export type WorkflowStateId = `wfs_${string}`;
export type WorkItemId = `wi_${string}`;
export type WorkItemReactionId = `rxn_${string}`;
export type WorkItemTypeId = `wit_${string}`;

export type BlockId = `blk_${string}`;
export type CommentId = `cmt_${string}`;
export type FolderId = `fld_${string}`;
export type PageId = `pg_${string}`;
export type LabelTemplateId = `lbltpl_${string}`;

export type FavoriteId = `fav_${string}`;
export type FeatureRequestId = `fr_${string}`;
export type FindingId = `fnd_${string}`;
export type FindingSetId = `fset_${string}`;
export type MemoryId = `memo_${string}`;
export type NotificationId = `ntf_${string}`;
export type PluginId = `plg_${string}`;
export type PluginInstallId = `plgi_${string}`;
export type PluginVersionId = `plgv_${string}`;
export type PluginReviewId = `plgr_${string}`;
export type RecommendationId = `rec_${string}`;
export type ReminderId = `rmd_${string}`;
export type UserPreferenceId = `pref_${string}`;

export type AgentTokenId = `agt_${string}`;
export type CredentialId = `cred_${string}`;
export type InviteLinkId = `inv_${string}`;
export type OAuthClientId = `oac_${string}`;
export type OauthAuthorizePendingId = `oapend_${string}`;
export type PermissionGroupId = `pgrp_${string}`;
export type UserApiTokenId = `uat_${string}`;

export type AgentPlanId = `aplan_${string}`;
export type AgentPlanCheckpointId = `apck_${string}`;

export type BalanceLotId = `bal_${string}`;
export type BillingRecordId = `bill_${string}`;
export type InvoiceId = `inv2_${string}`;
export type PaymentId = `pay_${string}`;
export type PaymentMethodId = `pm_${string}`;
export type SubscriptionId = `sub_${string}`;
export type SubscriptionPlanId = `splan_${string}`;
export type TokenPackageId = `tpk_${string}`;

export type AttributeDefinitionId = `ad_${string}`;
export type AttributeValueId = `av_${string}`;
export type InstructionId = `ins_${string}`;
export type ShareId = `shr_${string}`;
export type SnapshotId = `snap_${string}`;
