// ============================================================
// CONVET PULSE — Central Product Roadmap Registry
// Defines planned and upcoming tools across the 12 studios.
// Serves as the single source of truth for unreleased features.
// ============================================================

import { TOOLS, type ToolCategory } from './tools.ts';
import type { StudioId } from './studios.ts';

export type RoadmapStage = 'planned' | 'in-development' | 'testing';

export interface RoadmapTool {
  id: string;
  name: string;
  plannedSlug: string;
  description: string;
  category: ToolCategory;
  studioId: StudioId;
  icon: string;
  stage: RoadmapStage;
  targetPhase?: string;
  notes?: string;
}

export const ROADMAP_TOOLS: RoadmapTool[] = [
  {
    id: 'epub-converter',
    name: 'EPUB Reader & Converter',
    plannedSlug: 'epub-converter',
    description: 'Read, format, and convert digital e-books between EPUB, PDF, and clean HTML.',
    category: 'utilities',
    studioId: 'document-studio',
    icon: 'BookOpen',
    stage: 'in-development',
    targetPhase: 'Phase 7',
  },
  {
    id: 'pptx-creator',
    name: 'PowerPoint Presentation Creator',
    plannedSlug: 'pptx-creator',
    description: 'Create and edit presentation slides with themes, tables, and PPTX export.',
    category: 'utilities',
    studioId: 'document-studio',
    icon: 'Presentation',
    stage: 'planned',
    targetPhase: 'Phase 7',
  },
  {
    id: 'excel-formula-assistant',
    name: 'Excel Formula Assistant',
    plannedSlug: 'excel-formula-assistant',
    description: 'Analyze spreadsheet formulas, calculate aggregates, and debug syntax visually.',
    category: 'data',
    studioId: 'data-studio',
    icon: 'Table',
    stage: 'planned',
    targetPhase: 'Phase 7',
  },
  {
    id: 'image-background-remover',
    name: 'Image Background Remover',
    plannedSlug: 'image-background-remover',
    description: 'High-precision client-side object segmentation to isolate subjects and remove backgrounds.',
    category: 'image',
    studioId: 'image-studio',
    icon: 'Scissors',
    stage: 'in-development',
    targetPhase: 'Phase 5',
  },
  {
    id: 'audio-transcription',
    name: 'Voice & Audio Transcription',
    plannedSlug: 'audio-transcription',
    description: 'Transcribe spoken audio, lectures, and interviews to timestamped text locally.',
    category: 'utilities',
    studioId: 'audio-video-studio',
    icon: 'Mic',
    stage: 'planned',
    targetPhase: 'Phase 6',
  },
  {
    id: 'video-subtitle-generator',
    name: 'Video Subtitle & Caption Generator',
    plannedSlug: 'video-subtitle-generator',
    description: 'Generate, synchronize, and export SRT and VTT closed captions for video files.',
    category: 'utilities',
    studioId: 'audio-video-studio',
    icon: 'Video',
    stage: 'planned',
    targetPhase: 'Phase 6',
  },
  {
    id: 'qr-designer',
    name: 'Custom QR Code Designer',
    plannedSlug: 'qr-designer',
    description: 'Design branded QR codes with custom colors, embedded logos, and gradient styles.',
    category: 'developer',
    studioId: 'developer-studio',
    icon: 'QrCode',
    stage: 'testing',
    targetPhase: 'Phase 4',
  },
  {
    id: 'batch-converter-pro',
    name: 'Universal Batch Conversion Pipeline',
    plannedSlug: 'batch-converter-pro',
    description: 'Queue and convert hundreds of mixed-format files concurrently with zero quality loss.',
    category: 'utilities',
    studioId: 'universal-converter',
    icon: 'Boxes',
    stage: 'in-development',
    targetPhase: 'Phase 4',
  },
];

/**
 * Returns planned roadmap tools that have not yet been released.
 * Automatically excludes any entry whose slug or ID already exists in the TOOLS registry.
 */
export const getComingSoonTools = (limit?: number): RoadmapTool[] => {
  const releasedSlugs = new Set(TOOLS.map((t) => t.slug));
  const releasedIds = new Set(TOOLS.map((t) => t.id));

  const upcoming = ROADMAP_TOOLS.filter((item) => {
    // Exclude if already released
    if (releasedSlugs.has(item.plannedSlug) || releasedIds.has(item.id)) {
      return false;
    }
    // Only include valid stages
    return item.stage === 'planned' || item.stage === 'in-development' || item.stage === 'testing';
  });

  return limit ? upcoming.slice(0, limit) : upcoming;
};
