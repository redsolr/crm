/**
 * Matter Templates API client — `/api/matter_templates`.
 *
 * Workspace-shared reusable matter blueprints (name + practice type + AI
 * context + an ordered starter-task spine). The spine is replaced wholesale via
 * `PUT /:id/tasks`. Writes carry an Idempotency-Key (platform standard).
 */

import { BaseApiClient } from "./api-client";
import { freshIdempotencyKey } from "./idempotency";

export interface MatterTemplateTaskWire {
  title: string;
  status: string | null;
  description: string | null;
  position: number;
}

export interface MatterTemplateQuestionWire {
  text: string;
  position: number;
}

export interface MatterTemplateWire {
  id: string;
  name: string;
  matter_type: string | null;
  context: string;
  tasks: MatterTemplateTaskWire[];
  questions: MatterTemplateQuestionWire[];
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateTaskInput {
  title: string;
  status?: string;
  description?: string;
}

export interface TemplateQuestionInput {
  text: string;
}

export interface CreateMatterTemplateBody {
  name: string;
  matter_type?: string | null;
  context?: string;
  tasks?: TemplateTaskInput[];
  questions?: TemplateQuestionInput[];
}

export interface UpdateMatterTemplateBody {
  name?: string;
  matter_type?: string | null;
  context?: string;
}

class MatterTemplatesApiClient extends BaseApiClient {
  async list(): Promise<{ matter_templates: MatterTemplateWire[] }> {
    return this.request<{ matter_templates: MatterTemplateWire[] }>(
      "/matter_templates",
    );
  }

  async create(
    body: CreateMatterTemplateBody,
  ): Promise<{ matter_template: MatterTemplateWire }> {
    return this.request<{ matter_template: MatterTemplateWire }>(
      "/matter_templates",
      {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Idempotency-Key": freshIdempotencyKey() },
      },
    );
  }

  async update(
    id: string,
    body: UpdateMatterTemplateBody,
  ): Promise<{ matter_template: MatterTemplateWire }> {
    return this.request<{ matter_template: MatterTemplateWire }>(
      `/matter_templates/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: { "Idempotency-Key": freshIdempotencyKey() },
      },
    );
  }

  async setTasks(
    id: string,
    tasks: TemplateTaskInput[],
  ): Promise<{ matter_template: MatterTemplateWire }> {
    return this.request<{ matter_template: MatterTemplateWire }>(
      `/matter_templates/${id}/tasks`,
      {
        method: "PUT",
        body: JSON.stringify({ tasks }),
        headers: { "Idempotency-Key": freshIdempotencyKey() },
      },
    );
  }

  async setQuestions(
    id: string,
    questions: TemplateQuestionInput[],
  ): Promise<{ matter_template: MatterTemplateWire }> {
    return this.request<{ matter_template: MatterTemplateWire }>(
      `/matter_templates/${id}/questions`,
      {
        method: "PUT",
        body: JSON.stringify({ questions }),
        headers: { "Idempotency-Key": freshIdempotencyKey() },
      },
    );
  }

  async remove(id: string): Promise<void> {
    return this.request<void>(`/matter_templates/${id}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": freshIdempotencyKey() },
    });
  }
}

export const matterTemplatesApi = new MatterTemplatesApiClient();
