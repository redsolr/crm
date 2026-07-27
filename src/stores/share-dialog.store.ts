"use client";

import { create } from "zustand";
import type { ShareScope } from "@/lib/sharingApi";

interface ShareDialogState {
  isOpen: boolean;
  resourceId: string;
  resourceType: ShareScope;
  resourceName: string;
}

interface ShareDialogActions {
  open: (params: {
    resourceId: string;
    resourceType: ShareScope;
    resourceName: string;
  }) => void;
  close: () => void;
}

export const useShareDialogStore = create<
  ShareDialogState & ShareDialogActions
>((set) => ({
  isOpen: false,
  resourceId: "",
  resourceType: "artifact",
  resourceName: "",

  open: ({ resourceId, resourceType, resourceName }) =>
    set({ isOpen: true, resourceId, resourceType, resourceName }),

  close: () => set({ isOpen: false }),
}));
