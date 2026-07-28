CREATE SEQUENCE "public"."record_identifier_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "activities" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"entity_type" text DEFAULT 'work_item' NOT NULL,
	"entity_id" text NOT NULL,
	"entity_identifier" text,
	"actor_id" text,
	"actor_type" text DEFAULT 'user' NOT NULL,
	"actor_name" text,
	"changes" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attribute_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"work_item_type_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"data_type" text NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"config" jsonb,
	"position" integer DEFAULT 0 NOT NULL,
	"enrichment" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attribute_values" (
	"id" text PRIMARY KEY NOT NULL,
	"work_item_id" text NOT NULL,
	"definition_id" text NOT NULL,
	"value" jsonb,
	"source" text DEFAULT 'manual' NOT NULL,
	"computed_at" timestamp with time zone,
	"computed_model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"work_item_id" text NOT NULL,
	"content" text NOT NULL,
	"author_id" text NOT NULL,
	"mentions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "record_types" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"workflow_id" text NOT NULL,
	CONSTRAINT "record_types_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "records" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"title" text NOT NULL,
	"subject" text,
	"description" text,
	"workspace_id" text NOT NULL,
	"type_id" text NOT NULL,
	"state_id" text NOT NULL,
	"priority" text DEFAULT 'none' NOT NULL,
	"position" double precision DEFAULT 0 NOT NULL,
	"parent_id" text,
	"assignee_id" text,
	"assignee_name" text,
	"dri_id" text,
	"dri_name" text,
	"created_by_id" text NOT NULL,
	"created_by_name" text,
	"due_date" timestamp with time zone,
	"estimate" double precision,
	"visibility" text DEFAULT 'internal' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "records_identifier_unique" UNIQUE("identifier")
);
--> statement-breakpoint
CREATE TABLE "workflow_stages" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflows_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_entity_id_records_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribute_definitions" ADD CONSTRAINT "attribute_definitions_work_item_type_id_record_types_id_fk" FOREIGN KEY ("work_item_type_id") REFERENCES "public"."record_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribute_values" ADD CONSTRAINT "attribute_values_work_item_id_records_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribute_values" ADD CONSTRAINT "attribute_values_definition_id_attribute_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."attribute_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_work_item_id_records_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_types" ADD CONSTRAINT "record_types_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_type_id_record_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."record_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_state_id_workflow_stages_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."workflow_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_parent_id_records_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_stages" ADD CONSTRAINT "workflow_stages_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_attribute_definitions_type_key" ON "attribute_definitions" USING btree ("work_item_type_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_attribute_values_item_definition" ON "attribute_values" USING btree ("work_item_id","definition_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_workflow_stages_workflow_key" ON "workflow_stages" USING btree ("workflow_id","key");