import { useMutation, useQueryClient } from "@tanstack/react-query";
import { knowledgeGraphApi } from "@/lib/knowledge-graph/client";
import type {
  CreateEntityInput,
  CreateRelationshipInput,
  CuratedEntityResponse,
  CuratedRelationshipResponse,
  UpdateEntityInput,
} from "@/lib/knowledge-graph/schemas";
import { queryKeys } from "../query-keys";

/**
 * Mutations for hand-curated graph CRUD. Each mutation invalidates
 * the relevant cache:
 *   - Entity create / update / delete → invalidate the whole-graph
 *     `view` query (every filter combo) AND the affected entity's
 *     detail query so the panel refreshes too.
 *   - Relationship create / delete → same invalidations (the view
 *     adds/removes an edge; the entity detail's neighbor list shifts).
 *
 * We DON'T do optimistic updates — the backend may reject with 409
 * (duplicate name+type), 403 (editing structural/extracted), or
 * other domain errors that need to surface to the user before the
 * UI reflects the change.
 */
function useInvalidateGraph() {
  const qc = useQueryClient();
  return (entity_id?: string) => {
    void qc.invalidateQueries({ queryKey: queryKeys.knowledgeGraph.all });
    if (entity_id != null && entity_id !== "") {
      void qc.invalidateQueries({
        queryKey: queryKeys.knowledgeGraph.entity(entity_id),
      });
    }
  };
}

export function useCreateEntity() {
  const invalidate = useInvalidateGraph();
  return useMutation<CuratedEntityResponse, Error, CreateEntityInput>({
    mutationFn: (input) => knowledgeGraphApi.createEntity(input),
    onSuccess: (created) => invalidate(created.id),
  });
}

export function useUpdateEntity() {
  const invalidate = useInvalidateGraph();
  return useMutation<
    CuratedEntityResponse,
    Error,
    { entity_id: string; input: UpdateEntityInput }
  >({
    mutationFn: ({ entity_id, input }) =>
      knowledgeGraphApi.updateEntity(entity_id, input),
    onSuccess: (updated) => invalidate(updated.id),
  });
}

export function useDeleteEntity() {
  const invalidate = useInvalidateGraph();
  return useMutation<void, Error, string>({
    mutationFn: (entity_id) => knowledgeGraphApi.deleteEntity(entity_id),
    onSuccess: (_unused, entity_id) => invalidate(entity_id),
  });
}

export function useCreateRelationship() {
  const invalidate = useInvalidateGraph();
  return useMutation<
    CuratedRelationshipResponse,
    Error,
    CreateRelationshipInput
  >({
    mutationFn: (input) => knowledgeGraphApi.createRelationship(input),
    onSuccess: (_created, input) => {
      // Both endpoint entities' details need refresh — their neighbor
      // lists just gained an item.
      invalidate(input.source_entity_id);
      invalidate(input.target_entity_id);
    },
  });
}

export function useDeleteRelationship() {
  const invalidate = useInvalidateGraph();
  return useMutation<void, Error, string>({
    mutationFn: (relationshipId) =>
      knowledgeGraphApi.deleteRelationship(relationshipId),
    onSuccess: () => invalidate(),
  });
}
