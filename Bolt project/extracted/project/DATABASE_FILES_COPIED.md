# Database Files Copied from Replit to Bolt Project

## Summary
Successfully copied all core database files from the Replit app to the Bolt project.

## Files Copied

### Core Database Files
1. **server/db.ts** - Database connection and pool configuration
2. **server/storage.ts** - Database storage layer with all CRUD operations
3. **drizzle.config.ts** - Drizzle ORM configuration

### Shared Schema and Types
Located in `server/shared/`:

1. **schema.ts** (70KB) - Complete database schema including:
   - User management tables
   - Strategy and trading tables
   - AI decision and outcome tracking
   - Work queue system
   - Broker assets and orders
   - Backtest infrastructure
   - Universe and allocation tables
   - AI Arena (debate sessions, agent profiles)
   - Competition mode tables
   - LLM tracking and metrics

2. **position-mapper.ts** - Position data mapping utilities
3. **strategy-spec.ts** - Strategy specification schemas

### Types Directory (server/shared/types/)
1. **ui-contracts.ts** - UI data contracts and view models
2. **backtesting.ts** - Backtest type definitions
3. **admin-module.ts** - Admin module type definitions
4. **index.ts** - Type exports

### Models Directory (server/shared/models/)
1. **chat.ts** - Chat conversation and message models

## Import Path Updates

The following import paths were updated to work in the new location:

1. **server/storage.ts**: Changed `@shared/schema` to `./shared/schema`
2. **server/db.ts**: Uses `./shared/schema`
3. **drizzle.config.ts**: Updated schema path to `./server/shared/schema.ts`
4. **server/shared/position-mapper.ts**: Changed `../server/connectors/alpaca` to `../connectors/alpaca`

## Database Schema Overview

The schema includes comprehensive tables for:
- **User Management**: users
- **Trading**: strategies, trades, positions, orders, fills
- **AI System**: aiDecisions, aiDecisionFeatures, aiTradeOutcomes, aiCalibrationLog
- **External Data**: dataSourceAnalysis, shortInterestAnalysis, insiderActivityAnalysis, macroAnalysis
- **Work Queue**: workItems, workItemRuns
- **Broker Integration**: brokerAssets, orders, fills
- **Backtesting**: backtestRuns, backtestTradeEvents, backtestEquityCurve
- **Universe Management**: universeAssets, universeLiquidityMetrics, universeFundamentals, universeTechnicals
- **AI Arena**: debateSessions, debateMessages, debateConsensus, aiArenaRuns, aiAgentProfiles
- **Competition**: traderProfiles, competitionRuns, competitionScores
- **Strategy Versioning**: strategyVersions
- **Tool Tracking**: toolInvocations
- **Admin**: adminSettings, alertRules, alertEvents
- **Chat**: conversations, messages

## Next Steps

The database files are now ready to use in the Bolt project. To complete the integration:

1. Ensure DATABASE_URL environment variable is set
2. Run database migrations if needed: `npm run db:push` or `npm run db:migrate`
3. Update any application code that imports from these files to use the new paths
4. Test database connections and operations

## File Structure

```
/home/runner/workspace/Bolt project/extracted/project/
├── drizzle.config.ts
└── server/
    ├── db.ts
    ├── storage.ts
    └── shared/
        ├── schema.ts
        ├── position-mapper.ts
        ├── strategy-spec.ts
        ├── types/
        │   ├── index.ts
        │   ├── ui-contracts.ts
        │   ├── backtesting.ts
        │   └── admin-module.ts
        └── models/
            └── chat.ts
```

All files have been successfully copied and import paths have been updated to work in the Bolt project structure.
