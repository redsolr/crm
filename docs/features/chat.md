# Chat & Research

> AI chat with SSE streaming, conversation branching, key findings, and model selection.

## Overview

Chat is the core feature. Users send messages, receive streamed AI responses, save insights as "findings", and branch conversations at any point.

## Architecture

### Research Mode vs Normal Mode

| Mode | Trigger | Layout |
|------|---------|--------|
| Normal | Any view except research | Chat in right panel (`ChatSidebar`) |
| Research | Research activity bar tab | Chat in main content (`ResearchView`), findings in right panel |

### Components

| Component | File | Purpose |
|-----------|------|---------|
| `ChatWindow` | `chat/ChatWindow.tsx` | Orchestrator: messages + input + banners |
| `ChatBox` | `chat/ChatBox.tsx` | Input textarea + model selector + send/stop |
| `ModelSelector` | `chat/ModelSelector.tsx` | Dropdown: gpt-5 / gpt-5-mini / gpt-5-nano |
| `MessagesList` | `chat/MessagesList.tsx` | Filters system messages, renders bubbles |
| `UserBubble` | `chat/UserBubble.tsx` | User message with copy/edit actions |
| `LLMBubble` | `chat/LLMBubble.tsx` | AI message with Framer Motion animation |
| `MarkdownRenderer` | `chat/MarkdownRenderer.tsx` | Markdown + syntax highlighting |
| `ChatHistoryPanel` | `chat/ChatHistoryPanel.tsx` | Chat list with rename/delete/branches |
| `ResearchChatHistoryPanel` | `research/ResearchChatHistoryPanel.tsx` | Claude-style sidebar: New Chat + Recents list |
| `TextSelectionMenu` | `chat/TextSelectionMenu.tsx` | Context menu: Ask AI, Copy, Save Finding |
| `WelcomeMessage` | `chat/WelcomeMessage.tsx` | Time-based greeting (Good morning/afternoon/evening) |

### Send Flow

```
User types → ChatBox.onSend(message, model)
  → useChatQuery.sendMessage()
    → validatePermission(model) — POST /accounts/:id/usage/validate
    → createChat() if needed — POST /chat
    → startChatStream() — POST /chat/stream (SSE)
      → Parses events: message_start, content_block_delta, message_stop
      → appendToLastAssistantMessage() on each delta
    → On complete: invalidate query keys
```

### Streaming Protocol (SSE)

```
event: message_start       → { message: { id, role, model, usage } }
event: content_block_start → { index, contentBlock: { type: "text" } }
event: content_block_delta → { delta: { type: "text_delta", text: "chunk" } }
event: content_block_stop  → { index }
event: message_delta       → { usage: { outputTokens }, delta: { stopReason } }
event: message_stop        → end of stream
```

### Branching

Conversations fork at any message:
- `parentChatId` + `branchedFromMessageId`
- Branch copies messages up to branch point
- Multi-level branching supported (branch from a branch)

### Key Findings

Users save AI responses as "findings" via the star icon:
1. Click ⭐ on any assistant message
2. Finding saved via `addFinding()` (localStorage persistence)
3. KeyFindingsPanel shows findings grouped by date
4. Can rename, copy, delete findings

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/chat/stream` | POST | SSE streaming chat |
| `/chat` | POST | Create new chat |
| `/chat/:id/messages` | GET | Load chat history |
| `/chat/:id` | PATCH | Rename chat |
| `/chat/:id` | DELETE | Delete chat |
| `/chat/:id/branch` | POST | Fork conversation |
| `/chat/:id/branches` | GET | List branches |

## Mobile

| Component | File | Purpose |
|-----------|------|---------|
| `MobileChatScreen` | `mobile/MobileChatScreen.tsx` | Full-screen mobile chat |
| `MobileChatInput` | Inside MobileChatScreen | Pill-style input bar with + and mic buttons |
