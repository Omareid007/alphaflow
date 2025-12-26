import { db } from "../db";
import { adminSettings, type AdminSetting, type InsertAdminSetting } from "../shared/schema";
import { eq, and, like } from "drizzle-orm";

export interface SettingsService {
  get: <T = unknown>(namespace: string, key: string) => Promise<T | undefined>;
  set: <T = unknown>(
    namespace: string,
    key: string,
    value: T,
    options?: { description?: string; isSecret?: boolean; isReadOnly?: boolean; userId?: string }
  ) => Promise<AdminSetting>;
  delete: (namespace: string, key: string) => Promise<boolean>;
  list: (namespace?: string) => Promise<AdminSetting[]>;
  getAll: (namespace: string) => Promise<Record<string, unknown>>;
}

export async function getSetting<T = unknown>(
  namespace: string,
  key: string
): Promise<T | undefined> {
  const [result] = await db
    .select()
    .from(adminSettings)
    .where(and(eq(adminSettings.namespace, namespace), eq(adminSettings.key, key)))
    .limit(1);

  if (!result) return undefined;
  return result.value as T;
}

export async function getSettingFull(
  namespace: string,
  key: string
): Promise<AdminSetting | undefined> {
  const [result] = await db
    .select()
    .from(adminSettings)
    .where(and(eq(adminSettings.namespace, namespace), eq(adminSettings.key, key)))
    .limit(1);

  return result || undefined;
}

export async function setSetting<T = unknown>(
  namespace: string,
  key: string,
  value: T,
  options?: {
    description?: string;
    isSecret?: boolean;
    isReadOnly?: boolean;
    userId?: string;
  }
): Promise<AdminSetting> {
  const existing = await db
    .select()
    .from(adminSettings)
    .where(and(eq(adminSettings.namespace, namespace), eq(adminSettings.key, key)))
    .limit(1);

  if (existing.length > 0) {
    if (existing[0].isReadOnly) {
      throw new Error(`Setting ${namespace}:${key} is read-only`);
    }

    const [updated] = await db
      .update(adminSettings)
      .set({
        value: value as Record<string, unknown>,
        description: options?.description ?? existing[0].description,
        updatedBy: options?.userId,
        updatedAt: new Date(),
      })
      .where(eq(adminSettings.id, existing[0].id))
      .returning();

    return updated;
  }

  const [created] = await db
    .insert(adminSettings)
    .values({
      namespace,
      key,
      value: value as Record<string, unknown>,
      description: options?.description,
      isSecret: options?.isSecret ?? false,
      isReadOnly: options?.isReadOnly ?? false,
      updatedBy: options?.userId,
    })
    .returning();

  return created;
}

export async function deleteSetting(namespace: string, key: string): Promise<boolean> {
  const existing = await db
    .select()
    .from(adminSettings)
    .where(and(eq(adminSettings.namespace, namespace), eq(adminSettings.key, key)))
    .limit(1);

  if (existing.length === 0) return false;
  if (existing[0].isReadOnly) {
    throw new Error(`Setting ${namespace}:${key} is read-only`);
  }

  await db
    .delete(adminSettings)
    .where(eq(adminSettings.id, existing[0].id));

  return true;
}

export async function listSettings(namespace?: string): Promise<AdminSetting[]> {
  if (namespace) {
    return db
      .select()
      .from(adminSettings)
      .where(eq(adminSettings.namespace, namespace));
  }
  return db.select().from(adminSettings);
}

export async function getAllSettings(namespace: string): Promise<Record<string, unknown>> {
  const settings = await db
    .select()
    .from(adminSettings)
    .where(eq(adminSettings.namespace, namespace));

  const result: Record<string, unknown> = {};
  for (const setting of settings) {
    if (!setting.isSecret) {
      result[setting.key] = setting.value;
    }
  }
  return result;
}

export function sanitizeSettingForResponse(setting: AdminSetting): AdminSetting {
  if (setting.isSecret) {
    return { ...setting, value: "[REDACTED]" as unknown as Record<string, unknown> };
  }
  return setting;
}

export const settingsService: SettingsService = {
  get: getSetting,
  set: setSetting,
  delete: deleteSetting,
  list: listSettings,
  getAll: getAllSettings,
};
