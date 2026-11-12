// ============================================================
// CONVET PULSE — Website Visibility & Feature Control System
// Server-side module managing config/site-display.json with
// validation, backup, rollback, and ephemeral FS fallback.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_DIR = path.resolve(__dirname, '../config');
const SITE_DISPLAY_PATH = path.join(CONFIG_DIR, 'site-display.json');
const SITE_DISPLAY_BACKUP_PATH = path.join(CONFIG_DIR, 'site-display.backup.json');

// All 17 canonical tools with category and initial featured flags
const DEFAULT_TOOLS_CATALOG = {
  'compress-pdf': { name: 'Compress PDF', category: 'pdf', visible: true, enabled: true, tier: 'free', featured: true, maintenance: false },
  'merge-pdf': { name: 'Merge PDF', category: 'pdf', visible: true, enabled: true, tier: 'free', featured: true, maintenance: false },
  'split-pdf': { name: 'Split PDF', category: 'pdf', visible: true, enabled: true, tier: 'free', featured: false, maintenance: false },
  'pdf-to-jpg': { name: 'PDF to JPG', category: 'pdf', visible: true, enabled: true, tier: 'free', featured: false, maintenance: false },
  'jpg-to-pdf': { name: 'JPG to PDF', category: 'pdf', visible: true, enabled: true, tier: 'free', featured: true, maintenance: false },
  'image-compressor': { name: 'Image Compressor', category: 'image', visible: true, enabled: true, tier: 'free', featured: true, maintenance: false },
  'image-resizer': { name: 'Image Resizer', category: 'image', visible: true, enabled: true, tier: 'free', featured: false, maintenance: false },
  'image-converter': { name: 'Image Format Converter', category: 'image', visible: true, enabled: true, tier: 'free', featured: true, maintenance: false },
  'csv-to-excel': { name: 'CSV to Excel', category: 'data', visible: true, enabled: true, tier: 'free', featured: true, maintenance: false },
  'excel-to-csv': { name: 'Excel to CSV', category: 'data', visible: true, enabled: true, tier: 'free', featured: false, maintenance: false },
  'csv-to-json': { name: 'CSV to JSON', category: 'data', visible: true, enabled: true, tier: 'free', featured: false, maintenance: false },
  'json-to-csv': { name: 'JSON to CSV', category: 'data', visible: true, enabled: true, tier: 'free', featured: false, maintenance: false },
  'zip-creator': { name: 'ZIP Creator', category: 'archive', visible: true, enabled: true, tier: 'free', featured: false, maintenance: false },
  'zip-extractor': { name: 'ZIP Extractor', category: 'archive', visible: true, enabled: true, tier: 'free', featured: true, maintenance: false },
  'word-counter': { name: 'Word & Character Counter', category: 'utilities', visible: true, enabled: true, tier: 'free', featured: false, maintenance: false },
  'hash-generator': { name: 'Checksum & Hash Generator', category: 'utilities', visible: true, enabled: true, tier: 'free', featured: false, maintenance: false },
  'qr-generator': { name: 'QR Code Generator', category: 'utilities', visible: true, enabled: true, tier: 'free', featured: true, maintenance: false },
};

const DEFAULT_CATEGORIES = {
  pdf: { name: 'PDF Tools', visible: true },
  image: { name: 'Image Tools', visible: true },
  data: { name: 'Data & Spreadsheet Tools', visible: true },
  archive: { name: 'Archive & Compression Tools', visible: true },
  utilities: { name: 'Utility & Text Tools', visible: true },
};

export const DEFAULT_SITE_DISPLAY_CONFIG = {
  version: '1.0.0',
  lastModified: new Date().toISOString(),
  global: {
    maintenanceMode: false,
    showAnnouncementBar: true,
    announcementText: '⚡ CONVET PULSE: Fast, Private, Client-Side Conversions · Zero tracking',
    showHeader: true,
    showFooter: true,
  },
  navigation: {
    showHome: true,
    showTools: true,
    showDashboard: true,
    showPricing: true,
    showPremium: true,
    showAbout: false,
    showContact: false,
  },
  homepage: {
    showHero: true,
    showStatistics: true,
    showFeaturedTools: true,
    showCategories: true,
    showHowItWorks: true,
    showFeatures: true,
    showTestimonials: false,
    showPricing: true,
    showCTA: true,
  },
  features: {
    showSearch: true,
    showFileUpload: true,
    showDragAndDrop: true,
    showLiveAnalytics: true,
    showRecentActivity: true,
    showVisitorCounter: true,
    showThemeToggle: true,
  },
  pricing: {
    showPricingPage: true,
    showFreePlan: true,
    showPremiumPlan: true,
    showPrices: true,
    showUpgradeButtons: true,
  },
  branding: {
    showLogo: true,
    showSocialLinks: true,
    showCopyright: true,
  },
  categories: DEFAULT_CATEGORIES,
  tools: DEFAULT_TOOLS_CATALOG,
};

let memoryConfig = null;

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function readConfigFromDisk() {
  try {
    if (fs.existsSync(SITE_DISPLAY_PATH)) {
      const raw = fs.readFileSync(SITE_DISPLAY_PATH, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[SiteDisplay] Failed to read site-display.json:', err.message);
  }
  return null;
}

function writeConfigToDisk(config) {
  ensureConfigDir();
  try {
    fs.writeFileSync(SITE_DISPLAY_PATH, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.warn('[SiteDisplay] Failed to write site-display.json (ephemeral FS?):', err.message);
    return false;
  }
}

function backupConfig() {
  try {
    if (fs.existsSync(SITE_DISPLAY_PATH)) {
      fs.copyFileSync(SITE_DISPLAY_PATH, SITE_DISPLAY_BACKUP_PATH);
    }
  } catch (err) {
    console.warn('[SiteDisplay] Failed to create backup:', err.message);
  }
}

export function initializeSiteDisplayConfig() {
  ensureConfigDir();
  const diskConfig = readConfigFromDisk();

  if (diskConfig && diskConfig.global) {
    // Merge with any newly added catalog tools or categories
    memoryConfig = {
      ...DEFAULT_SITE_DISPLAY_CONFIG,
      ...diskConfig,
      global: { ...DEFAULT_SITE_DISPLAY_CONFIG.global, ...diskConfig.global },
      navigation: { ...DEFAULT_SITE_DISPLAY_CONFIG.navigation, ...diskConfig.navigation },
      homepage: { ...DEFAULT_SITE_DISPLAY_CONFIG.homepage, ...diskConfig.homepage },
      features: { ...DEFAULT_SITE_DISPLAY_CONFIG.features, ...diskConfig.features },
      pricing: { ...DEFAULT_SITE_DISPLAY_CONFIG.pricing, ...diskConfig.pricing },
      branding: { ...DEFAULT_SITE_DISPLAY_CONFIG.branding, ...diskConfig.branding },
      categories: { ...DEFAULT_CATEGORIES, ...(diskConfig.categories || {}) },
      tools: { ...DEFAULT_TOOLS_CATALOG, ...(diskConfig.tools || {}) },
    };
  } else {
    memoryConfig = structuredClone(DEFAULT_SITE_DISPLAY_CONFIG);
    writeConfigToDisk(memoryConfig);
  }
}

export function getSiteDisplayConfig() {
  if (!memoryConfig) {
    initializeSiteDisplayConfig();
  }
  return structuredClone(memoryConfig);
}

export function getPublicSiteDisplayConfig() {
  const config = getSiteDisplayConfig();
  // Safe sanitized configuration for public consumers
  return {
    version: config.version,
    lastModified: config.lastModified,
    global: config.global,
    navigation: config.navigation,
    homepage: config.homepage,
    features: config.features,
    pricing: config.pricing,
    branding: config.branding,
    categories: config.categories,
    tools: config.tools,
  };
}

export function updateSiteDisplayConfig(partialUpdates) {
  const current = getSiteDisplayConfig();

  // Validate updates
  if (!partialUpdates || typeof partialUpdates !== 'object') {
    return { success: false, error: 'Invalid configuration payload' };
  }

  const updated = {
    ...current,
    lastModified: new Date().toISOString(),
    global: { ...current.global, ...(partialUpdates.global || {}) },
    navigation: { ...current.navigation, ...(partialUpdates.navigation || {}) },
    homepage: { ...current.homepage, ...(partialUpdates.homepage || {}) },
    features: { ...current.features, ...(partialUpdates.features || {}) },
    pricing: { ...current.pricing, ...(partialUpdates.pricing || {}) },
    branding: { ...current.branding, ...(partialUpdates.branding || {}) },
    categories: { ...current.categories, ...(partialUpdates.categories || {}) },
    tools: { ...current.tools, ...(partialUpdates.tools || {}) },
  };

  backupConfig();
  memoryConfig = updated;
  writeConfigToDisk(memoryConfig);

  return { success: true, config: structuredClone(memoryConfig) };
}

export function resetSiteDisplayConfig() {
  backupConfig();
  memoryConfig = structuredClone(DEFAULT_SITE_DISPLAY_CONFIG);
  memoryConfig.lastModified = new Date().toISOString();
  writeConfigToDisk(memoryConfig);
  return { success: true, config: structuredClone(memoryConfig) };
}

// ─────────────────────────────────────────────────────────────
// Functional Access & Visibility Helpers
// ─────────────────────────────────────────────────────────────

export function isToolVisible(slug) {
  const config = getSiteDisplayConfig();
  const tool = config.tools?.[slug];
  if (!tool) return true; // default visible if unknown
  if (tool.visible === false) return false;
  // Also check if its category is visible
  if (tool.category && config.categories?.[tool.category]?.visible === false) {
    return false;
  }
  return true;
}

export function isToolEnabled(slug) {
  const config = getSiteDisplayConfig();
  if (config.global?.maintenanceMode) return false;
  const tool = config.tools?.[slug];
  if (!tool) return true;
  return tool.enabled !== false;
}

export function isToolUnderMaintenance(slug) {
  const config = getSiteDisplayConfig();
  if (config.global?.maintenanceMode) return true;
  const tool = config.tools?.[slug];
  return Boolean(tool?.maintenance);
}

export function isToolPremium(slug) {
  const config = getSiteDisplayConfig();
  const tool = config.tools?.[slug];
  return tool?.tier === 'premium';
}

export function isCategoryVisible(categoryKey) {
  const config = getSiteDisplayConfig();
  return config.categories?.[categoryKey]?.visible !== false;
}

