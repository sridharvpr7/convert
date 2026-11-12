// ============================================================
// CONVETER — Premium Configuration Management Module
// Reads/writes config/premium.json with validation, backup,
// and Render ephemeral filesystem handling.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_DIR = path.resolve(__dirname, '../config');
const PREMIUM_CONFIG_PATH = path.join(CONFIG_DIR, 'premium.json');
const PREMIUM_BACKUP_PATH = path.join(CONFIG_DIR, 'premium.backup.json');

// ─────────────────────────────────────────────────────────────
// Default Config
// ─────────────────────────────────────────────────────────────
const DEFAULT_PREMIUM_CONFIG = {
  premium: {
    enabled: true,
    showPremiumButton: true,
    price: {
      amount: 199,
      currency: 'INR',
      billingPeriod: 'month',
      label: '₹199/month',
    },
    features: {
      unlimitedConversions: false,
      batchConversion: true,
      advancedTools: true,
      priorityProcessing: true,
      largeFileSupport: true,
      noAds: true,
    },
    allowedTools: [],
    maintenanceMode: false,
  },
};

// In-memory config (fallback when filesystem is ephemeral)
let memoryConfig = null;

// ─────────────────────────────────────────────────────────────
// File I/O Helpers
// ─────────────────────────────────────────────────────────────
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function readConfigFromDisk() {
  try {
    if (fs.existsSync(PREMIUM_CONFIG_PATH)) {
      const raw = fs.readFileSync(PREMIUM_CONFIG_PATH, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[Premium] Failed to read premium.json:', err.message);
  }
  return null;
}

function writeConfigToDisk(config) {
  ensureConfigDir();
  try {
    fs.writeFileSync(PREMIUM_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.warn('[Premium] Failed to write premium.json (ephemeral FS?):', err.message);
    console.warn('[Premium] Using in-memory config as fallback.');
    return false;
  }
}

function backupConfig() {
  try {
    if (fs.existsSync(PREMIUM_CONFIG_PATH)) {
      fs.copyFileSync(PREMIUM_CONFIG_PATH, PREMIUM_BACKUP_PATH);
    }
  } catch (err) {
    console.warn('[Premium] Failed to create backup:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────
function validateConfig(config) {
  const errors = [];

  if (!config || typeof config !== 'object') {
    return ['Config must be an object'];
  }

  const p = config.premium;
  if (!p || typeof p !== 'object') {
    return ['Config must have a "premium" object'];
  }

  if (typeof p.enabled !== 'boolean') {
    errors.push('"premium.enabled" must be a boolean');
  }

  if (typeof p.showPremiumButton !== 'boolean') {
    errors.push('"premium.showPremiumButton" must be a boolean');
  }

  if (p.price) {
    if (typeof p.price !== 'object') {
      errors.push('"premium.price" must be an object');
    } else {
      if (typeof p.price.amount !== 'number' || p.price.amount < 0) {
        errors.push('"premium.price.amount" must be a non-negative number');
      }
      if (typeof p.price.currency !== 'string' || !p.price.currency) {
        errors.push('"premium.price.currency" must be a non-empty string');
      }
      if (typeof p.price.billingPeriod !== 'string' || !p.price.billingPeriod) {
        errors.push('"premium.price.billingPeriod" must be a non-empty string');
      }
      if (typeof p.price.label !== 'string') {
        errors.push('"premium.price.label" must be a string');
      }
    }
  }

  if (p.features && typeof p.features !== 'object') {
    errors.push('"premium.features" must be an object');
  }

  if (p.allowedTools !== undefined && !Array.isArray(p.allowedTools)) {
    errors.push('"premium.allowedTools" must be an array');
  }

  if (typeof p.maintenanceMode !== 'boolean') {
    errors.push('"premium.maintenanceMode" must be a boolean');
  }

  return errors;
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Initialize premium config. Loads from disk or creates default.
 */
export function initializePremiumConfig() {
  ensureConfigDir();
  const diskConfig = readConfigFromDisk();

  if (diskConfig && diskConfig.premium) {
    memoryConfig = diskConfig;
  } else {
    memoryConfig = structuredClone(DEFAULT_PREMIUM_CONFIG);
    writeConfigToDisk(memoryConfig);
  }
}

/**
 * Get the current premium configuration.
 */
export function getPremiumConfig() {
  if (!memoryConfig) {
    initializePremiumConfig();
  }
  return structuredClone(memoryConfig);
}

/**
 * Get the public-safe subset of premium config (no admin secrets).
 */
export function getPublicPremiumConfig() {
  const config = getPremiumConfig();
  const p = config.premium;
  return {
    enabled: p.enabled,
    showPremiumButton: p.showPremiumButton,
    price: p.price,
    features: p.features,
    maintenanceMode: p.maintenanceMode,
    allowedTools: p.allowedTools,
  };
}

/**
 * Update premium configuration.
 * Returns { success, errors?, config? }
 */
export function updatePremiumConfig(newConfig) {
  // Merge with existing
  const current = getPremiumConfig();
  const merged = {
    premium: {
      ...current.premium,
      ...newConfig.premium,
      price: {
        ...current.premium.price,
        ...(newConfig.premium?.price || {}),
      },
      features: {
        ...current.premium.features,
        ...(newConfig.premium?.features || {}),
      },
    },
  };

  // Preserve array if provided
  if (newConfig.premium?.allowedTools !== undefined) {
    merged.premium.allowedTools = newConfig.premium.allowedTools;
  }

  const errors = validateConfig(merged);
  if (errors.length > 0) {
    return { success: false, errors };
  }

  // Backup before overwrite
  backupConfig();

  memoryConfig = merged;
  writeConfigToDisk(memoryConfig);

  return { success: true, config: structuredClone(memoryConfig) };
}

/**
 * Update which tools are premium-restricted.
 */
export function updatePremiumTools(toolSlugs) {
  if (!Array.isArray(toolSlugs)) {
    return { success: false, errors: ['toolSlugs must be an array'] };
  }

  const config = getPremiumConfig();
  config.premium.allowedTools = toolSlugs;

  backupConfig();
  memoryConfig = config;
  writeConfigToDisk(memoryConfig);

  return { success: true, allowedTools: toolSlugs };
}

/**
 * Check if a specific tool is premium-restricted.
 * A tool is premium-restricted if:
 * - premium is enabled, AND
 * - allowedTools is non-empty, AND
 * - the tool slug is NOT in allowedTools
 */
export function isToolPremiumRestricted(toolSlug) {
  const config = getPremiumConfig();
  const p = config.premium;

  if (!p.enabled) return false;
  if (!p.allowedTools || p.allowedTools.length === 0) return false;

  // If allowedTools has entries, tools NOT in the list are premium-restricted
  return !p.allowedTools.includes(toolSlug);
}

/**
 * Check if premium system is in maintenance mode.
 */
export function isMaintenanceMode() {
  const config = getPremiumConfig();
  return config.premium.maintenanceMode || false;
}
