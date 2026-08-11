CREATE TABLE "agent_memories" (
	"id" text PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"created_by_id" text NOT NULL,
	"created_by_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
