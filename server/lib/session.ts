import { randomBytes } from "node:crypto";
import { db } from "../db";
import { sessions } from "@shared/schema";
import { eq, lt } from "drizzle-orm";
import { log } from "../utils/logger";

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export interface SessionData {
  userId: string;
  expiresAt: number;
}

/**
 * Create a new session in the database
 * @param userId - The user ID to associate with the session
 * @returns The session ID
 */
export async function createSession(userId: string): Promise<string> {
  const sessionId = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION);

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt,
  });

  return sessionId;
}

/**
 * Get a session from the database
 * @param sessionId - The session ID to retrieve
 * @returns Session data or null if not found or expired
 */
export async function getSession(
  sessionId: string
): Promise<SessionData | null> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  if (!session) {
    return null;
  }

  // Check if session is expired
  if (session.expiresAt < new Date()) {
    await deleteSession(sessionId);
    return null;
  }

  return {
    userId: session.userId,
    expiresAt: session.expiresAt.getTime(),
  };
}

/**
 * Delete a session from the database
 * @param sessionId - The session ID to delete
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/**
 * Cleanup expired sessions from the database
 * This should be run periodically
 */
export async function cleanupExpiredSessions(): Promise<void> {
  const result = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date()));
  log.info("SessionCleanup", "Cleaned up expired sessions");
}

/**
 * Delete all sessions for a specific user
 * @param userId - The user ID whose sessions should be deleted
 */
export async function deleteUserSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/**
 * Get all active sessions for a user
 * @param userId - The user ID to get sessions for
 * @returns Array of session IDs
 */
export async function getUserSessions(userId: string): Promise<string[]> {
  const userSessions = await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, userId));

  return userSessions.filter((s) => s.expiresAt >= new Date()).map((s) => s.id);
}
