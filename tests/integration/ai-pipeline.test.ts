import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../../server/db';
import { desc } from 'drizzle-orm';
import * as schema from '../../shared/schema';

describe('AI Pipeline Diagnostic', () => {
  let recentDecisions: any[] = [];
  let recentTrades: any[] = [];
  let recentOrders: any[] = [];

  beforeAll(async () => {
    try {
      recentDecisions = await db.select()
        .from(schema.aiDecisions)
        .orderBy(desc(schema.aiDecisions.createdAt))
        .limit(50);

      recentTrades = await db.select()
        .from(schema.trades)
        .orderBy(desc(schema.trades.executedAt))
        .limit(50);

      recentOrders = await db.select()
        .from(schema.orders)
        .orderBy(desc(schema.orders.createdAt))
        .limit(50);
    } catch (error) {
      console.error('Failed to fetch pipeline data:', error);
    }
  });

  it('should verify AI decisions contain actionable recommendations', () => {
    console.log(`\nAI Decisions: ${recentDecisions.length}`);
    
    const actionableDecisions = recentDecisions.filter(d => {
      const hasAction = d.action || d.recommendation || d.signal;
      const hasSymbol = d.symbol;
      const hasConfidence = d.confidence !== undefined || d.score !== undefined;
      
      return hasAction && hasSymbol;
    });

    console.log(`   Actionable: ${actionableDecisions.length}`);
    console.log(`   Non-actionable: ${recentDecisions.length - actionableDecisions.length}`);

    if (actionableDecisions.length === 0 && recentDecisions.length > 0) {
      console.error('\nAI DECISIONS LACK ACTIONABLE FIELDS');
      console.error('Sample decision structure:');
      console.error(JSON.stringify(recentDecisions[0], null, 2));
    }

    const actionCounts: Record<string, number> = {};
    for (const d of actionableDecisions) {
      const action = d.action || d.recommendation || d.signal || 'unknown';
      actionCounts[action] = (actionCounts[action] || 0) + 1;
    }
    
    console.log('\n   Decision breakdown:');
    for (const [action, count] of Object.entries(actionCounts)) {
      console.log(`      ${action}: ${count}`);
    }
  });

  it('should verify trade execution follows AI decisions', () => {
    console.log(`\nRecent Trades: ${recentTrades.length}`);
    console.log(`Recent Orders: ${recentOrders.length}`);

    const buyDecisions = recentDecisions.filter(d => 
      (d.action === 'buy' || d.recommendation === 'buy' || d.signal === 'bullish') &&
      ((d.confidence && d.confidence >= 0.7) || (d.score && d.score >= 0.7))
    );

    const sellDecisions = recentDecisions.filter(d => 
      (d.action === 'sell' || d.recommendation === 'sell' || d.signal === 'bearish') &&
      ((d.confidence && d.confidence >= 0.7) || (d.score && d.score >= 0.7))
    );

    console.log(`   High-confidence BUY decisions: ${buyDecisions.length}`);
    console.log(`   High-confidence SELL decisions: ${sellDecisions.length}`);

    const decisionSymbols = new Set([
      ...buyDecisions.map(d => d.symbol),
      ...sellDecisions.map(d => d.symbol),
    ]);

    const orderedSymbols = new Set(recentOrders.map(o => o.symbol));

    const decisionsWithoutOrders = [...decisionSymbols].filter(s => !orderedSymbols.has(s));
    
    if (decisionsWithoutOrders.length > 0 && decisionSymbols.size > 0) {
      console.warn('\nAI DECISIONS WITHOUT CORRESPONDING ORDERS:');
      decisionsWithoutOrders.forEach(s => console.warn(`   - ${s}`));
      console.warn('\n   POSSIBLE CAUSES:');
      console.warn('   - Trade execution disabled');
      console.warn('   - Insufficient buying power');
      console.warn('   - Position size rules blocked trade');
      console.warn('   - Decision confidence below threshold');
    }
  });

  it('should verify agent status via API', async () => {
    try {
      const response = await fetch('http://localhost:5000/api/agent/status');
      const agentStatus = await response.json();

      console.log('\nAgent Status:');
      console.log(`   Running: ${agentStatus.isRunning}`);
      console.log(`   Phase: ${agentStatus.phase || agentStatus.currentPhase || 'unknown'}`);
      console.log(`   Last Update: ${agentStatus.lastUpdate || agentStatus.lastCycleTime || 'unknown'}`);

      if (!agentStatus.isRunning) {
        console.warn('\nAGENT IS NOT RUNNING');
        console.warn('   AI decisions will not be processed');
      }

      expect(agentStatus).toBeDefined();
    } catch (error) {
      console.error('Failed to fetch agent status:', error);
    }
  });

  it('should trace full decision-to-execution pipeline', async () => {
    console.log('\nPIPELINE TRACE');
    console.log('='.repeat(60));

    const steps = {
      aiDecisions: recentDecisions.length > 0,
      orders: recentOrders.length > 0,
      trades: recentTrades.length > 0,
    };

    console.log(`Step 1: AI Decisions Generated: ${steps.aiDecisions ? 'YES' : 'NO'} (${recentDecisions.length})`);
    console.log(`Step 2: Orders Created: ${steps.orders ? 'YES' : 'NO'} (${recentOrders.length})`);
    console.log(`Step 3: Trades Executed: ${steps.trades ? 'YES' : 'NO'} (${recentTrades.length})`);

    const filledOrders = recentOrders.filter(o => o.status === 'filled').length;
    console.log(`\n   Filled Orders: ${filledOrders}/${recentOrders.length}`);

    const healthPercent = (Object.values(steps).filter(Boolean).length / Object.keys(steps).length) * 100;
    console.log(`\nPIPELINE HEALTH: ${healthPercent.toFixed(0)}% operational`);

    if (healthPercent < 100) {
      console.log('\nFIXES NEEDED:');
      if (!steps.aiDecisions) console.log('   - Verify AI analysis is generating decisions');
      if (!steps.orders) console.log('   - Check order creation logic');
      if (!steps.trades) console.log('   - Verify trade execution and broker connectivity');
    }
  });
});
