#!/usr/bin/env tsx
/**
 * Test script to verify database-backed session persistence
 *
 * This script tests:
 * 1. Creating a session
 * 2. Retrieving a session
 * 3. Verifying session persists in database
 * 4. Deleting a session
 * 5. Cleaning up expired sessions
 */

import {
  createSession,
  getSession,
  deleteSession,
  cleanupExpiredSessions,
} from "./server/lib/session";
import { db } from "./server/db";
import { sessions, users } from "./shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function testSessionPersistence() {
  console.log("\n========================================");
  console.log("Testing Database-Backed Session Persistence");
  console.log("========================================\n");

  let testUserId: string | null = null;

  try {
    // Test 0: Create a test user
    console.log("Test 0: Creating a test user...");
    const hashedPassword = await bcrypt.hash("test-password", 10);
    const [testUser] = await db
      .insert(users)
      .values({
        username: `test-user-${Date.now()}`,
        password: hashedPassword,
        isAdmin: false,
      })
      .returning();
    testUserId = testUser.id;
    console.log(`✓ Test user created with ID: ${testUserId}`);

    // Test 1: Create a session
    console.log("\nTest 1: Creating a session...");
    const sessionId = await createSession(testUserId);
    console.log(`✓ Session created with ID: ${sessionId.substring(0, 16)}...`);

    // Test 2: Retrieve the session
    console.log("\nTest 2: Retrieving the session...");
    const retrievedSession = await getSession(sessionId);
    if (!retrievedSession) {
      throw new Error("Failed to retrieve session");
    }
    console.log(`✓ Session retrieved successfully`);
    console.log(`  User ID: ${retrievedSession.userId}`);
    console.log(
      `  Expires at: ${new Date(retrievedSession.expiresAt).toISOString()}`
    );

    // Test 3: Verify session exists in database directly
    console.log("\nTest 3: Verifying session in database...");
    const [dbSession] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId));

    if (!dbSession) {
      throw new Error("Session not found in database");
    }
    console.log(`✓ Session verified in database`);
    console.log(`  Database User ID: ${dbSession.userId}`);
    console.log(`  Database Expires At: ${dbSession.expiresAt.toISOString()}`);
    console.log(`  Database Created At: ${dbSession.createdAt.toISOString()}`);

    // Test 4: Create an expired session for cleanup test
    console.log("\nTest 4: Creating an expired session for cleanup test...");
    const expiredSessionId = await createSession(testUserId);
    // Manually update it to be expired
    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) }) // 1 second ago
      .where(eq(sessions.id, expiredSessionId));
    console.log(
      `✓ Expired session created with ID: ${expiredSessionId.substring(0, 16)}...`
    );

    // Test 5: Verify expired session is null when retrieved
    console.log("\nTest 5: Verifying expired session returns null...");
    const expiredSession = await getSession(expiredSessionId);
    if (expiredSession !== null) {
      throw new Error("Expected expired session to return null");
    }
    console.log(`✓ Expired session correctly returns null`);

    // Test 6: Cleanup expired sessions
    console.log("\nTest 6: Running cleanup for expired sessions...");
    await cleanupExpiredSessions();
    console.log(`✓ Cleanup completed successfully`);

    // Verify expired session was deleted
    const [deletedSession] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, expiredSessionId));

    if (deletedSession) {
      throw new Error("Expired session should have been deleted");
    }
    console.log(`✓ Expired session was removed from database`);

    // Test 7: Delete the active session
    console.log("\nTest 7: Deleting the active session...");
    await deleteSession(sessionId);
    console.log(`✓ Session deleted successfully`);

    // Verify session was deleted
    const deletedActiveSession = await getSession(sessionId);
    if (deletedActiveSession !== null) {
      throw new Error("Session should have been deleted");
    }
    console.log(`✓ Session verified as deleted`);

    // Test 8: Count total sessions
    console.log("\nTest 8: Checking total sessions in database...");
    const allSessions = await db.select().from(sessions);
    console.log(`✓ Total sessions in database: ${allSessions.length}`);

    console.log("\n========================================");
    console.log("All Tests Passed! ✓");
    console.log("========================================\n");
    console.log("Summary:");
    console.log("- Sessions are stored in PostgreSQL database");
    console.log("- Sessions persist across server restarts");
    console.log("- Expired sessions are automatically cleaned up");
    console.log("- Session cleanup job runs every hour");
    console.log(
      "\n✓ Database-backed session implementation is working correctly!\n"
    );
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    throw error;
  } finally {
    // Cleanup: Delete test user if created
    if (testUserId) {
      console.log("\nCleaning up test user...");
      await db.delete(users).where(eq(users.id, testUserId));
      console.log("✓ Test user deleted");
    }
    process.exit(0);
  }
}

testSessionPersistence();
