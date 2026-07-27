"use client";

import React from "react";

// ============================================
// FOLDER ICONS
// ============================================

// Default folder icon
export const FolderIcon = ({
  isOpen,
  color = "#dcb67a",
}: {
  isOpen: boolean;
  color?: string;
}) => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    {isOpen ? (
      <path
        d="M1.5 14h13c.28 0 .5-.22.5-.5v-8c0-.28-.22-.5-.5-.5H7.71l-.85-.85C6.67 4.04 6.34 4 6 4H1.5c-.28 0-.5.22-.5.5v9c0 .28.22.5.5.5zm0-9.5V5h4.79l.85.85c.19.2.45.15.86.15h6.5v7H1.5v-8.5z"
        fill={color}
      />
    ) : (
      <path
        d="M14.5 5H7.71l-.85-.85C6.67 4.04 6.34 4 6 4H1.5c-.28 0-.5.22-.5.5v9c0 .28.22.5.5.5h13c.28 0 .5-.22.5-.5v-8c0-.28-.22-.5-.5-.5zM14 13H2V5h4l1 1h7v7z"
        fill={color}
      />
    )}
  </svg>
);

// Purple folder for personal
export const PersonalFolderIcon = ({ isOpen }: { isOpen: boolean }) => (
  <FolderIcon isOpen={isOpen} color="#9b8cd9" />
);

// ============================================
// DOCUMENT ICONS
// ============================================

// Generic document icon
export const DocumentIcon = ({
  gradientId,
  gradientColors,
  folderColor,
}: {
  gradientId: string;
  gradientColors: [string, string];
  folderColor?: string;
}) => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <defs>
      <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={gradientColors[0]} />
        <stop offset="100%" stopColor={gradientColors[1]} />
      </linearGradient>
    </defs>
    <path
      d="M3 1.5C3 1.22 3.22 1 3.5 1H10L13 4V14.5C13 14.78 12.78 15 12.5 15H3.5C3.22 15 3 14.78 3 14.5V1.5Z"
      fill={`url(#${gradientId})`}
    />
    <path
      d="M10 1V4H13L10 1Z"
      fill={folderColor || gradientColors[0]}
      opacity="0.6"
    />
    <path
      d="M5 6H11M5 8.5H11M5 11H9"
      stroke="#fff"
      strokeWidth="0.8"
      strokeLinecap="round"
      opacity="0.9"
    />
  </svg>
);

// Personal file icon (purple)
export const PersonalFileIcon = () => (
  <DocumentIcon
    gradientId="personalFileGrad"
    gradientColors={["#a78bfa", "#8b5cf6"]}
    folderColor="#c4b5fd"
  />
);

// ============================================
// CONTENT TYPE ICONS (Board, Backlog, Sprint, Timeline, Milestone)
// ============================================

// Kanban board icon
export const BoardIcon = ({ color = "#3b82f6" }: { color?: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <defs>
      <linearGradient id="boardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={color} />
        <stop offset="100%" stopColor={color} />
      </linearGradient>
    </defs>
    <rect
      x="1"
      y="2"
      width="4"
      height="12"
      rx="1"
      fill="url(#boardGrad)"
      opacity="0.9"
    />
    <rect
      x="6"
      y="2"
      width="4"
      height="8"
      rx="1"
      fill="url(#boardGrad)"
      opacity="0.7"
    />
    <rect
      x="11"
      y="2"
      width="4"
      height="10"
      rx="1"
      fill="url(#boardGrad)"
      opacity="0.5"
    />
  </svg>
);

// Personal board icon (purple themed)
export const PersonalBoardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <defs>
      <linearGradient
        id="personalBoardGrad"
        x1="0%"
        y1="0%"
        x2="100%"
        y2="100%"
      >
        <stop offset="0%" stopColor="#c084fc" />
        <stop offset="100%" stopColor="#a855f7" />
      </linearGradient>
    </defs>
    <rect
      x="1"
      y="2"
      width="4"
      height="12"
      rx="1"
      fill="url(#personalBoardGrad)"
      opacity="0.9"
    />
    <rect
      x="6"
      y="2"
      width="4"
      height="8"
      rx="1"
      fill="url(#personalBoardGrad)"
      opacity="0.7"
    />
    <rect
      x="11"
      y="2"
      width="4"
      height="10"
      rx="1"
      fill="url(#personalBoardGrad)"
      opacity="0.5"
    />
  </svg>
);

// Backlog icon
export const BacklogIcon = ({ color = "#3b82f6" }: { color?: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <defs>
      <linearGradient id="backlogGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={color} />
        <stop offset="100%" stopColor={color} />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="12" height="3" rx="1" fill="url(#backlogGrad)" />
    <rect
      x="2"
      y="6.5"
      width="12"
      height="3"
      rx="1"
      fill="url(#backlogGrad)"
      opacity="0.7"
    />
    <rect
      x="2"
      y="11"
      width="12"
      height="3"
      rx="1"
      fill="url(#backlogGrad)"
      opacity="0.4"
    />
  </svg>
);

// Personal backlog icon (purple themed)
export const PersonalBacklogIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <defs>
      <linearGradient
        id="personalBacklogGrad"
        x1="0%"
        y1="0%"
        x2="100%"
        y2="100%"
      >
        <stop offset="0%" stopColor="#a78bfa" />
        <stop offset="100%" stopColor="#7c3aed" />
      </linearGradient>
    </defs>
    <rect
      x="2"
      y="2"
      width="12"
      height="3"
      rx="1"
      fill="url(#personalBacklogGrad)"
    />
    <rect
      x="2"
      y="6.5"
      width="12"
      height="3"
      rx="1"
      fill="url(#personalBacklogGrad)"
      opacity="0.7"
    />
    <rect
      x="2"
      y="11"
      width="12"
      height="3"
      rx="1"
      fill="url(#personalBacklogGrad)"
      opacity="0.4"
    />
  </svg>
);

// Sprint icon
export const SprintIcon = ({ color = "#10b981" }: { color?: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <defs>
      <linearGradient id="sprintGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={color} />
        <stop offset="100%" stopColor={color} />
      </linearGradient>
    </defs>
    <circle
      cx="8"
      cy="8"
      r="6"
      fill="none"
      stroke="url(#sprintGrad)"
      strokeWidth="2"
    />
    <path
      d="M8 4V8L10.5 10.5"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

// Personal sprint icon (purple themed)
export const PersonalSprintIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <defs>
      <linearGradient
        id="personalSprintGrad"
        x1="0%"
        y1="0%"
        x2="100%"
        y2="100%"
      >
        <stop offset="0%" stopColor="#e879f9" />
        <stop offset="100%" stopColor="#d946ef" />
      </linearGradient>
    </defs>
    <circle
      cx="8"
      cy="8"
      r="6"
      fill="none"
      stroke="url(#personalSprintGrad)"
      strokeWidth="2"
    />
    <path
      d="M8 4V8L10.5 10.5"
      stroke="#e879f9"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

// Timeline icon
export const TimelineIcon = ({ color = "#f59e0b" }: { color?: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <defs>
      <linearGradient id="timelineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={color} />
        <stop offset="100%" stopColor={color} />
      </linearGradient>
    </defs>
    <rect x="1" y="7" width="14" height="2" rx="1" fill="url(#timelineGrad)" />
    <circle cx="3" cy="8" r="2" fill={color} />
    <circle cx="8" cy="8" r="2" fill={color} />
    <circle cx="13" cy="8" r="2" fill={color} />
  </svg>
);

// Milestone icon
export const MilestoneIcon = ({ color = "#ef4444" }: { color?: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <defs>
      <linearGradient id="milestoneGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={color} />
        <stop offset="100%" stopColor={color} />
      </linearGradient>
    </defs>
    <path d="M3 2V14" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <path d="M3 3L12 5L3 7V3Z" fill="url(#milestoneGrad)" />
  </svg>
);

// ============================================
// EXECUTIVE/VISION ICONS
// ============================================

// Vision/Star icon
export const VisionIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <defs>
      <linearGradient id="visionGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fcd34d" />
        <stop offset="50%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#d97706" />
      </linearGradient>
    </defs>
    <circle cx="8" cy="8" r="6" fill="#fef3c7" opacity="0.3" />
    <path
      d="M8 2L9.5 6L14 6.5L10.5 9.5L11.5 14L8 11.5L4.5 14L5.5 9.5L2 6.5L6.5 6L8 2Z"
      fill="url(#visionGrad)"
    />
    <circle cx="8" cy="7.5" r="1.5" fill="#fff" opacity="0.8" />
  </svg>
);

// Strategy icon
export const StrategyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <defs>
      <linearGradient id="strategyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#818cf8" />
        <stop offset="100%" stopColor="#6366f1" />
      </linearGradient>
    </defs>
    <path
      d="M3 1.5C3 1.22 3.22 1 3.5 1H10L13 4V14.5C13 14.78 12.78 15 12.5 15H3.5C3.22 15 3 14.78 3 14.5V1.5Z"
      fill="url(#strategyGrad)"
    />
    <path d="M10 1V4H13L10 1Z" fill="#a5b4fc" />
    <path
      d="M5 6L8 9L11 6M8 9V12"
      stroke="#fff"
      strokeWidth="1"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

// Goals/OKR icon
export const GoalsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <defs>
      <linearGradient id="goalsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fb923c" />
        <stop offset="100%" stopColor="#f97316" />
      </linearGradient>
    </defs>
    <circle
      cx="8"
      cy="8"
      r="6"
      fill="none"
      stroke="url(#goalsGrad)"
      strokeWidth="2"
    />
    <circle
      cx="8"
      cy="8"
      r="3.5"
      fill="none"
      stroke="#fdba74"
      strokeWidth="1.5"
    />
    <circle cx="8" cy="8" r="1.5" fill="#f97316" />
  </svg>
);

// Executive document icon (gold)
export const ExecDocIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <defs>
      <linearGradient id="execDocGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fbbf24" />
        <stop offset="100%" stopColor="#f59e0b" />
      </linearGradient>
    </defs>
    <path
      d="M3 1.5C3 1.22 3.22 1 3.5 1H10L13 4V14.5C13 14.78 12.78 15 12.5 15H3.5C3.22 15 3 14.78 3 14.5V1.5Z"
      fill="url(#execDocGrad)"
    />
    <path d="M10 1V4H13L10 1Z" fill="#fde68a" />
    <path
      d="M5 6H11M5 8.5H11M5 11H9"
      stroke="#fff"
      strokeWidth="0.8"
      strokeLinecap="round"
      opacity="0.9"
    />
  </svg>
);

// ============================================
// EXECUTIVE FOLDER ICONS (C-Suite)
// ============================================

// CEO folder - golden crown
export const CEOFolderIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <defs>
      <linearGradient id="ceoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fcd34d" />
        <stop offset="50%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#d97706" />
      </linearGradient>
    </defs>
    <path d="M8 1L5 5L1 3L3 10H13L15 3L11 5L8 1Z" fill="url(#ceoGrad)" />
    <path d="M3 11H13V13H3V11Z" fill="#f59e0b" />
    <circle cx="8" cy="4" r="1" fill="#fff" opacity="0.8" />
    <circle cx="5" cy="5.5" r="0.8" fill="#fff" opacity="0.6" />
    <circle cx="11" cy="5.5" r="0.8" fill="#fff" opacity="0.6" />
  </svg>
);

// CTO folder - tech/gear style
export const CTOFolderIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <defs>
      <linearGradient id="ctoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#60a5fa" />
        <stop offset="100%" stopColor="#3b82f6" />
      </linearGradient>
    </defs>
    <path
      d="M8 1L9.5 3.5H12L10 6L11.5 9H8L4.5 9L6 6L4 3.5H6.5L8 1Z"
      fill="url(#ctoGrad)"
    />
    <circle cx="8" cy="5.5" r="1.5" fill="#1e40af" />
    <rect x="4" y="10" width="8" height="4" rx="1" fill="#3b82f6" />
    <path d="M5 11H11M5 13H11" stroke="#93c5fd" strokeWidth="0.5" />
  </svg>
);

// CFO folder - finance/chart style
export const CFOFolderIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <defs>
      <linearGradient id="cfoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#34d399" />
        <stop offset="100%" stopColor="#10b981" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="12" height="12" rx="1" fill="url(#cfoGrad)" />
    <path
      d="M4 10L6 7L9 9L12 4"
      stroke="#fff"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
    />
    <circle cx="4" cy="10" r="1" fill="#fff" />
    <circle cx="6" cy="7" r="1" fill="#fff" />
    <circle cx="9" cy="9" r="1" fill="#fff" />
    <circle cx="12" cy="4" r="1" fill="#fff" />
  </svg>
);

// COO folder - operations/gears style
export const COOFolderIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <defs>
      <linearGradient id="cooGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f472b6" />
        <stop offset="100%" stopColor="#ec4899" />
      </linearGradient>
    </defs>
    <circle cx="6" cy="6" r="4" fill="url(#cooGrad)" />
    <circle cx="6" cy="6" r="1.5" fill="#831843" />
    <circle cx="11" cy="10" r="3" fill="#f472b6" />
    <circle cx="11" cy="10" r="1" fill="#831843" />
    <path d="M8 8L9 9" stroke="#fce7f3" strokeWidth="1" />
  </svg>
);

// Default executive folder - premium gold
export const ExecutiveFolderIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <defs>
      <linearGradient id="execFolderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fcd34d" />
        <stop offset="100%" stopColor="#f59e0b" />
      </linearGradient>
    </defs>
    {isOpen ? (
      <path
        d="M1.5 14h13c.28 0 .5-.22.5-.5v-8c0-.28-.22-.5-.5-.5H7.71l-.85-.85C6.67 4.04 6.34 4 6 4H1.5c-.28 0-.5.22-.5.5v9c0 .28.22.5.5.5zm0-9.5V5h4.79l.85.85c.19.2.45.15.86.15h6.5v7H1.5v-8.5z"
        fill="url(#execFolderGrad)"
      />
    ) : (
      <path
        d="M14.5 5H7.71l-.85-.85C6.67 4.04 6.34 4 6 4H1.5c-.28 0-.5.22-.5.5v9c0 .28.22.5.5.5h13c.28 0 .5-.22.5-.5v-8c0-.28-.22-.5-.5-.5zM14 13H2V5h4l1 1h7v7z"
        fill="url(#execFolderGrad)"
      />
    )}
  </svg>
);

// Helper to get executive folder icon by name
export const getExecutiveFolderIcon = (folderName: string, isOpen: boolean) => {
  const name = folderName?.toUpperCase();
  switch (name) {
    case "CEO":
      return <CEOFolderIcon />;
    case "CTO":
      return <CTOFolderIcon />;
    case "CFO":
      return <CFOFolderIcon />;
    case "COO":
      return <COOFolderIcon />;
    default:
      return <ExecutiveFolderIcon isOpen={isOpen} />;
  }
};

// Helper to get executive file icon by name
export const getExecutiveFileIcon = (fileName: string) => {
  const nameLower = fileName.toLowerCase();
  if (nameLower === "vision") return <VisionIcon />;
  if (nameLower.includes("strategy") || nameLower.includes("roadmap"))
    return <StrategyIcon />;
  if (
    nameLower.includes("okr") ||
    nameLower.includes("goal") ||
    nameLower.includes("kpi")
  )
    return <GoalsIcon />;
  return <ExecDocIcon />;
};

// ============================================
// BACKLOG EXPLORER ICONS
// ============================================

// Blue board icon for backlog explorer
export const BacklogBoardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <defs>
      <linearGradient id="boardGradBE" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#2563eb" />
      </linearGradient>
    </defs>
    <rect x="1" y="2" width="4" height="12" rx="1" fill="url(#boardGradBE)" />
    <rect x="6" y="2" width="4" height="8" rx="1" fill="#60a5fa" />
    <rect x="11" y="2" width="4" height="5" rx="1" fill="#93c5fd" />
  </svg>
);

// Green backlog icon for backlog explorer
export const BacklogListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <defs>
      <linearGradient id="backlogGradBE" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#22c55e" />
        <stop offset="100%" stopColor="#16a34a" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="12" height="3" rx="1" fill="url(#backlogGradBE)" />
    <rect x="2" y="6.5" width="12" height="3" rx="1" fill="#4ade80" />
    <rect x="2" y="11" width="12" height="3" rx="1" fill="#86efac" />
  </svg>
);

// Pink sprint icon for backlog explorer
export const BacklogSprintIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <defs>
      <linearGradient id="sprintGradBE" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ec4899" />
        <stop offset="100%" stopColor="#db2777" />
      </linearGradient>
    </defs>
    <circle cx="8" cy="8" r="6" fill="none" stroke="#f9a8d4" strokeWidth="2" />
    <path
      d="M8 2A6 6 0 0 1 14 8"
      fill="none"
      stroke="url(#sprintGradBE)"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <circle cx="8" cy="8" r="2" fill="#ec4899" />
  </svg>
);

// Project folder icon
export const ProjectIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <rect x="2" y="3" width="12" height="10" rx="1" fill="#6366f1" />
    <rect x="4" y="1" width="8" height="3" rx="1" fill="#818cf8" />
    <rect x="4" y="6" width="8" height="1.5" rx="0.5" fill="#c7d2fe" />
    <rect x="4" y="9" width="5" height="1.5" rx="0.5" fill="#c7d2fe" />
  </svg>
);

// Orange/amber folder icon
export const AmberFolderIcon = ({ isOpen }: { isOpen: boolean }) => (
  <FolderIcon isOpen={isOpen} color="#f59e0b" />
);

// Helper to get backlog explorer icon
export const getBacklogItemIcon = (
  item: { type: string; name?: string; content_type?: string },
  isOpen: boolean = false,
) => {
  if (item.type === "folder") {
    if (item.name?.toLowerCase() === "projects") return <ProjectIcon />;
    return <AmberFolderIcon isOpen={isOpen} />;
  }

  switch (item.content_type) {
    case "kanban":
      return <BacklogBoardIcon />;
    case "backlog":
      return <BacklogListIcon />;
    case "sprint":
      return <BacklogSprintIcon />;
    default:
      return <BacklogBoardIcon />;
  }
};

// ============================================
// TIMELINE EXPLORER ICONS
// ============================================

// Timeline item icon
export const TimelineItemIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <defs>
      <linearGradient id="timelineItemGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#d97706" />
      </linearGradient>
    </defs>
    <rect
      x="1"
      y="7"
      width="14"
      height="2"
      rx="1"
      fill="url(#timelineItemGrad)"
    />
    <circle cx="3" cy="8" r="2" fill="#f59e0b" />
    <circle cx="8" cy="8" r="2" fill="#fbbf24" />
    <circle cx="13" cy="8" r="2" fill="#fcd34d" />
  </svg>
);

// Milestone item icon
export const MilestoneItemIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <defs>
      <linearGradient
        id="milestoneItemGrad"
        x1="0%"
        y1="0%"
        x2="100%"
        y2="100%"
      >
        <stop offset="0%" stopColor="#ef4444" />
        <stop offset="100%" stopColor="#dc2626" />
      </linearGradient>
    </defs>
    <path d="M3 2V14" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
    <path d="M3 3L12 5L3 7V3Z" fill="url(#milestoneItemGrad)" />
  </svg>
);

// Blue folder for timeline
export const TimelineFolderIcon = ({ isOpen }: { isOpen: boolean }) => (
  <FolderIcon isOpen={isOpen} color="#3b82f6" />
);

// Purple timeline icon for timeline explorer
export const TimelineExplorerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <defs>
      <linearGradient id="timelineGradTE" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#a855f7" />
        <stop offset="100%" stopColor="#7c3aed" />
      </linearGradient>
    </defs>
    <rect
      x="2"
      y="7"
      width="12"
      height="2"
      rx="1"
      fill="url(#timelineGradTE)"
    />
    <circle
      cx="4"
      cy="8"
      r="2.5"
      fill="#c084fc"
      stroke="#7c3aed"
      strokeWidth="1"
    />
    <circle
      cx="8"
      cy="8"
      r="2.5"
      fill="#a855f7"
      stroke="#7c3aed"
      strokeWidth="1"
    />
    <circle
      cx="12"
      cy="8"
      r="2.5"
      fill="#7c3aed"
      stroke="#6d28d9"
      strokeWidth="1"
    />
  </svg>
);

// Milestone icon for timeline explorer
export const TimelineMilestoneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <defs>
      <linearGradient id="milestoneGradTE" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#d97706" />
      </linearGradient>
    </defs>
    <path d="M3 14V2L8 5L3 8" fill="url(#milestoneGradTE)" />
    <rect x="2" y="2" width="2" height="12" rx="0.5" fill="#92400e" />
    <circle
      cx="11"
      cy="8"
      r="4"
      fill="none"
      stroke="#f59e0b"
      strokeWidth="2"
      strokeDasharray="4 2"
    />
    <path
      d="M9.5 8L10.5 9L12.5 7"
      stroke="#f59e0b"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

// Roadmap icon
export const RoadmapIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <path
      d="M2 4h12M2 8h8M2 12h10"
      stroke="#60a5fa"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <circle cx="14" cy="4" r="1.5" fill="#3b82f6" />
    <circle cx="10" cy="8" r="1.5" fill="#3b82f6" />
    <circle cx="12" cy="12" r="1.5" fill="#3b82f6" />
  </svg>
);

// Calendar icon
export const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <rect x="2" y="3" width="12" height="11" rx="1" fill="#ef4444" />
    <rect x="2" y="3" width="12" height="3" rx="1" fill="#dc2626" />
    <rect x="4" y="8" width="2" height="2" rx="0.5" fill="#fecaca" />
    <rect x="7" y="8" width="2" height="2" rx="0.5" fill="#fecaca" />
    <rect x="10" y="8" width="2" height="2" rx="0.5" fill="#fecaca" />
    <rect x="4" y="11" width="2" height="1" rx="0.5" fill="#fecaca" />
    <rect x="7" y="11" width="2" height="1" rx="0.5" fill="#fecaca" />
  </svg>
);

// Purple folder for timeline
export const PurpleFolderIcon = ({ isOpen }: { isOpen: boolean }) => (
  <FolderIcon isOpen={isOpen} color="#a855f7" />
);

// Helper to get timeline explorer icon
export const getTimelineItemIcon = (
  item: { type: string; name?: string; content_type?: string },
  isOpen: boolean = false,
) => {
  if (item.type === "folder") {
    if (item.name?.toLowerCase().includes("roadmap")) return <RoadmapIcon />;
    if (item.name?.toLowerCase().includes("quarter")) return <CalendarIcon />;
    return <PurpleFolderIcon isOpen={isOpen} />;
  }

  switch (item.content_type) {
    case "timeline":
      return <TimelineExplorerIcon />;
    case "milestone":
      return <TimelineMilestoneIcon />;
    default:
      return <TimelineExplorerIcon />;
  }
};
