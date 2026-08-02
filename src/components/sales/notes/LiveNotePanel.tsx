"use client";

/**
 * Live note — the record's co-edited scratch document (Attio-Notes
 * class, keystroke-level): both seats type into the same note during a
 * call, carets and text sync live through the realtime worker's Yjs
 * doc room (`/doc/:recordId`, y-websocket protocol).
 *
 * The note is a working surface, not the archive: "Freeze into call
 * note" hands the text to the existing CreateCallNoteModal (summary
 * prefilled), and on save clears the live note — the call note is the
 * durable record, the live note resets for the next call.
 *
 * Renders nothing when realtime is off (the session probe 204s) — the
 * feature simply doesn't exist without the worker, same as the rest of
 * the presence surface.
 */

import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { peerColorFor } from "@/lib/realtime/peer-color";
import {
  useRealtimeStore,
  type RealtimeSession,
} from "@/lib/realtime/realtime-store";
import type { SalesWorkspaceBundle } from "@/lib/sales/use-sales-workspace";
import type { WorkItem } from "@/lib/workItemsApi";
import { CreateCallNoteModal } from "../CreateCallNoteModal";

export function LiveNotePanel({
  bundle,
  recordId,
  recordTitle,
}: {
  bundle: SalesWorkspaceBundle;
  recordId: string;
  recordTitle: string;
}) {
  // The connection hook (CrmShell) already fetched the session and
  // holds it in the store — no session ⇒ realtime off ⇒ no panel.
  const session = useRealtimeStore((s) => s.session);
  const [open, setOpen] = useState(false);

  if (session === null) return null;

  return (
    <section
      className="live-note-panel crm-panel"
      data-testid="live-note-panel"
    >
      <div className="flex items-center gap-2">
        <h2 className="crm-panel-title">Live note</h2>
        <span className="text-xs text-[var(--theme-text-muted)]">
          co-edited · both seats type together
        </span>
        <div className="flex-1" />
        <button
          type="button"
          className="crm-btn-ghost text-xs"
          data-testid="live-note-toggle"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Close" : "Open"}
        </button>
      </div>
      {open && (
        <LiveNoteEditor
          bundle={bundle}
          recordId={recordId}
          recordTitle={recordTitle}
          session={session}
        />
      )}
    </section>
  );
}

function LiveNoteEditor({
  bundle,
  recordId,
  recordTitle,
  session,
}: {
  bundle: SalesWorkspaceBundle;
  recordId: string;
  recordTitle: string;
  session: RealtimeSession;
}) {
  const [showFreeze, setShowFreeze] = useState(false);

  // Doc + provider live INSIDE the effect (created on mount, destroyed
  // on unmount) and surface through state — a render-time ref here
  // dies permanently under StrictMode's mount→cleanup→mount cycle
  // (cleanup nulls the ref, nothing re-creates it).
  const [collab, setCollab] = useState<{
    doc: Y.Doc;
    provider: WebsocketProvider;
  } | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    // The Y.Doc outlives provider swaps (content is CRDT state; a new
    // provider just re-syncs). The provider is REPLACED when its token
    // dies: socket tokens live 1h and y-websocket reuses its params on
    // every reconnect — after expiry it would retry-401 forever, so on
    // connection errors we re-mint via the session route and rebuild
    // the provider with a fresh token.
    const doc = new Y.Doc();
    let provider: WebsocketProvider | null = null;
    let disposed = false;
    let refreshing = false;

    const attach = (docBaseUrl: string, token: string) => {
      if (disposed) return;
      const next = new WebsocketProvider(docBaseUrl, recordId, doc, {
        params: { token },
      });
      next.on("connection-error", () => void refresh());
      provider = next;
      setCollab({ doc, provider: next });
    };

    const refresh = async () => {
      if (disposed || refreshing) return;
      refreshing = true;
      try {
        // Small delay so a transient network blip settles first.
        await new Promise((r) => setTimeout(r, 3_000));
        if (disposed) return;
        const res = await fetch("/api/realtime/session");
        if (res.status !== 200) return; // feature off / signed out — stay down
        const fresh = (await res.json()) as RealtimeSession;
        provider?.destroy();
        attach(fresh.doc_base_url, fresh.token);
      } catch (err) {
        console.warn("[live-note] token refresh failed:", err);
      } finally {
        refreshing = false;
      }
    };

    attach(sessionRef.current.doc_base_url, sessionRef.current.token);
    return () => {
      disposed = true;
      setCollab(null);
      provider?.destroy();
      doc.destroy();
    };
  }, [recordId]);

  if (collab === null) return null;
  return (
    <LiveNoteEditorInner
      bundle={bundle}
      recordId={recordId}
      recordTitle={recordTitle}
      session={session}
      collab={collab}
      showFreeze={showFreeze}
      setShowFreeze={setShowFreeze}
    />
  );
}

function LiveNoteEditorInner({
  bundle,
  recordId,
  recordTitle,
  session,
  collab,
  showFreeze,
  setShowFreeze,
}: {
  bundle: SalesWorkspaceBundle;
  recordId: string;
  recordTitle: string;
  session: RealtimeSession;
  collab: { doc: Y.Doc; provider: WebsocketProvider };
  showFreeze: boolean;
  setShowFreeze: (v: boolean) => void;
}) {
  const selfName =
    session.self.name ?? session.self.email?.split("@")[0] ?? "Me";

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ undoRedo: false }),
        Collaboration.configure({ document: collab.doc }),
        CollaborationCaret.configure({
          provider: collab.provider,
          user: { name: selfName, color: peerColorFor(session.self.id) },
        }),
      ],
      editorProps: {
        attributes: {
          class:
            "live-note-editor prose prose-invert prose-sm max-w-none min-h-[120px] px-3 py-2 focus:outline-none",
          "data-testid": "live-note-editor",
        },
      },
      immediatelyRender: false,
    },
    [collab],
  );

  // TipTap edits don't re-render React — track emptiness explicitly so
  // the freeze button enables as text (local OR remote) arrives.
  const [empty, setEmpty] = useState(true);
  useEffect(() => {
    if (editor === null) return;
    const update = () => setEmpty(editor.getText().trim() === "");
    update();
    editor.on("update", update);
    return () => {
      editor.off("update", update);
    };
  }, [editor]);

  return (
    <div className="live-note-body mt-3">
      <div className="rounded-lg border border-[var(--theme-border-primary)] bg-[var(--theme-bg-tertiary)]">
        <EditorContent editor={editor} />
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          className="crm-btn-ghost text-xs"
          data-testid="live-note-freeze"
          disabled={editor === null || empty}
          onClick={() => setShowFreeze(true)}
        >
          Freeze into call note
        </button>
      </div>
      {showFreeze && editor !== null && (
        <CreateCallNoteModal
          bundle={bundle}
          parentId={recordId}
          parentTitle={recordTitle}
          initialSummary={editor.getText().trim()}
          onClose={() => setShowFreeze(false)}
          onCreated={() => {
            // The call note is now the durable record — reset the live
            // note for the next call (a shared doc, so it clears for
            // everyone).
            editor.commands.clearContent(true);
            setShowFreeze(false);
          }}
        />
      )}
    </div>
  );
}
