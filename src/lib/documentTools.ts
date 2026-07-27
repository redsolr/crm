/**
 * Document Editing Tools for LLM
 *
 * These tools allow the LLM to edit the currently active document,
 * similar to how Claude Code edits files.
 */

// Import and re-export types from chatApi for backwards compatibility
import type { ToolDefinition, ToolCall, ToolResult } from "./chatApi";
export type { ToolDefinition, ToolCall, ToolResult };

// Document tools that the LLM can use
export const documentTools: ToolDefinition[] = [
  {
    name: "view_document",
    description:
      "View the current content of the active document. Use this to understand what's in the document before making edits.",
    input_schema: {
      type: "object",
      properties: {
        _placeholder: {
          type: "string",
          description: "Not used. This tool takes no input parameters.",
        },
      },
      required: [],
    },
  },
  {
    name: "replace_text",
    description:
      "Find and replace specific text in the document. The old_text must match exactly (including whitespace). Use this for targeted edits.",
    input_schema: {
      type: "object",
      properties: {
        old_text: {
          type: "string",
          description:
            "The exact text to find and replace. Must match exactly.",
        },
        new_text: {
          type: "string",
          description: "The new text to replace it with.",
        },
      },
      required: ["old_text", "new_text"],
    },
  },
  {
    name: "insert_text",
    description:
      "Insert text at a specific location in the document. You can insert after or before specific text.",
    input_schema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The text to insert.",
        },
        position: {
          type: "string",
          description:
            "Where to insert: 'after' to insert after target_text, 'before' to insert before target_text, 'end' to append at document end.",
          enum: ["after", "before", "end"],
        },
        target_text: {
          type: "string",
          description:
            "The text to insert before/after. Required unless position is 'end'.",
        },
      },
      required: ["text", "position"],
    },
  },
  {
    name: "append_text",
    description:
      "Add text to the end of the document. Use this to add new content without modifying existing content.",
    input_schema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The text to append to the document.",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "replace_document",
    description:
      "Replace the entire document content. Use this with caution - only for complete rewrites. The user can undo with Ctrl+Z.",
    input_schema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The new complete content for the document.",
        },
      },
      required: ["content"],
    },
  },
];

// System prompt addition when document editing is available
export const documentEditingSystemPrompt = `
You are a helpful assistant that can edit the user's document.

## When to use tools vs chat
- **USE TOOLS**: User asks to edit/fix/change/add to the document
- **JUST CHAT**: General questions, generating content for user to copy, normal conversation

## Document Tools
- **replace_text**: Find and replace exact text. Use for edits.
- **insert_text**: Insert at position (after/before target, or "end")
- **append_text**: Add to end of document
- **replace_document**: Replace entire document (use sparingly)
- **view_document**: Only if document content not shown below

## Key Rules
1. If document content is provided below, skip view_document and edit directly
2. Use replace_text with EXACT text matches from the document
3. Be concise - just confirm what changed, no lengthy explanations
4. You can call multiple tools in parallel if needed
`;

// Generate tools array for API request
export function getDocumentToolsForAPI(): ToolDefinition[] {
  return documentTools;
}

// Check if a message contains tool use
export function hasToolUse(content: unknown): boolean {
  if (Array.isArray(content)) {
    return content.some((block) => block.type === "tool_use");
  }
  return false;
}

// Extract tool calls from message content
export function extractToolCalls(content: unknown): ToolCall[] {
  if (!Array.isArray(content)) return [];

  return content
    .filter((block) => block.type === "tool_use")
    .map((block) => ({
      id: block.id,
      name: block.name,
      input: block.input,
    }));
}
