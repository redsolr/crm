import { create } from "zustand";

export type TeamSection = "members" | "organizations" | "groups";

interface TeamUIState {
  activeSection: TeamSection;
  setActiveSection: (section: TeamSection) => void;
}

export const useTeamUIStore = create<TeamUIState>((set) => ({
  activeSection: "members",
  setActiveSection: (section) => set({ activeSection: section }),
}));
