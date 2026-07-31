CREATE TABLE "saved_views" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"workspace_id" text NOT NULL,
	"owner_account_id" text NOT NULL,
	"owner_name" text,
	"query" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
