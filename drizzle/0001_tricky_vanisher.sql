ALTER TABLE "activities" DROP CONSTRAINT "activities_entity_id_records_id_fk";
--> statement-breakpoint
ALTER TABLE "record_types" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "record_types" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "record_types" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_stages" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_stages" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "workflows" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "workflows" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;