import { Router, Request, Response } from "express";
import { getSetting, setSetting } from "../admin/settings";
import { badRequest, serverError } from "../lib/standard-errors";
import { log } from "../utils/logger";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";

const router = Router();

// UserSettings interface matching frontend lib/types.ts
interface UserSettings {
  theme: "dark" | "light";
  notifications: {
    trades: boolean;
    aiAlerts: boolean;
    riskWarnings: boolean;
    dailyDigest: boolean;
  };
  riskGuardrails: {
    maxPositionSize: number;
    maxDrawdown: number;
    maxDailyLoss: number;
    requireConfirmation: boolean;
  };
}

// Default settings for new users
const defaultSettings: UserSettings = {
  theme: "dark",
  notifications: {
    trades: true,
    aiAlerts: true,
    riskWarnings: true,
    dailyDigest: false,
  },
  riskGuardrails: {
    maxPositionSize: 0.1,
    maxDrawdown: 0.2,
    maxDailyLoss: 0.05,
    requireConfirmation: true,
  },
};

// Get namespace for user settings
function getUserSettingsNamespace(userId: string): string {
  return `user-settings:${userId}`;
}

/**
 * GET /api/settings
 * Get user settings
 */
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return badRequest(res, "User ID is required");
    }

    const namespace = getUserSettingsNamespace(userId);
    const storedSettings = await getSetting<Partial<UserSettings>>(namespace, "preferences");

    // Merge stored settings with defaults to ensure all fields exist
    const settings: UserSettings = {
      ...defaultSettings,
      ...storedSettings,
      notifications: {
        ...defaultSettings.notifications,
        ...(storedSettings?.notifications || {}),
      },
      riskGuardrails: {
        ...defaultSettings.riskGuardrails,
        ...(storedSettings?.riskGuardrails || {}),
      },
    };

    log.info("Settings", "Fetched user settings", { userId });

    res.json(settings);
  } catch (error) {
    log.error("Settings", "Failed to fetch user settings", { error });
    serverError(res, "Failed to fetch settings");
  }
});

/**
 * PUT /api/settings
 * Update user settings
 */
router.put("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return badRequest(res, "User ID is required");
    }

    const updates = req.body as Partial<UserSettings>;

    // Validate theme if provided
    if (updates.theme !== undefined && !["dark", "light"].includes(updates.theme)) {
      return badRequest(res, "Invalid theme value. Must be 'dark' or 'light'");
    }

    // Validate risk guardrails if provided
    if (updates.riskGuardrails) {
      const { maxPositionSize, maxDrawdown, maxDailyLoss } = updates.riskGuardrails;

      if (maxPositionSize !== undefined && (maxPositionSize < 0 || maxPositionSize > 1)) {
        return badRequest(res, "maxPositionSize must be between 0 and 1");
      }

      if (maxDrawdown !== undefined && (maxDrawdown < 0 || maxDrawdown > 1)) {
        return badRequest(res, "maxDrawdown must be between 0 and 1");
      }

      if (maxDailyLoss !== undefined && (maxDailyLoss < 0 || maxDailyLoss > 1)) {
        return badRequest(res, "maxDailyLoss must be between 0 and 1");
      }
    }

    const namespace = getUserSettingsNamespace(userId);

    // Get existing settings
    const existingSettings = await getSetting<Partial<UserSettings>>(namespace, "preferences");

    // Deep merge updates with existing settings
    const newSettings: UserSettings = {
      ...defaultSettings,
      ...existingSettings,
      ...updates,
      notifications: {
        ...defaultSettings.notifications,
        ...(existingSettings?.notifications || {}),
        ...(updates.notifications || {}),
      },
      riskGuardrails: {
        ...defaultSettings.riskGuardrails,
        ...(existingSettings?.riskGuardrails || {}),
        ...(updates.riskGuardrails || {}),
      },
    };

    // Save to admin_settings table
    await setSetting(namespace, "preferences", newSettings, {
      description: "User preferences and settings",
      userId,
    });

    log.info("Settings", "Updated user settings", {
      userId,
      updatedKeys: Object.keys(updates),
    });

    res.json(newSettings);
  } catch (error) {
    log.error("Settings", "Failed to update user settings", { error });
    serverError(res, "Failed to update settings");
  }
});

export default router;
