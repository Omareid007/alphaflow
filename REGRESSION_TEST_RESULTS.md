# AlphaFlow Trading Platform - Comprehensive Regression Test Results

**Test Date:** 2025-12-24T07:12:00.672Z
**Total Duration:** 2.23s

## Executive Summary

- **Total Tests:** 30
- **Passed:** 18 (60.0%)
- **Failed:** 12 (40.0%)
- **Success Rate:** 60.0%

## Test Results by Category

### Authentication

**Status:** 5/7 passed (71.4%)

| Test | Status | Duration | Notes |
|------|--------|----------|-------|
| Signup User 1 | ✗ FAIL | 288ms | No user ID in response |
| Signup User 2 | ✗ FAIL | 101ms | No user ID in response |
| Login with valid credentials | ✓ PASS | 99ms | - |
| Login with invalid credentials (should fail) | ✓ PASS | - | - |
| Get current user (authenticated) | ✓ PASS | 9ms | - |
| Get current user without auth (should fail) | ✓ PASS | - | - |
| Duplicate username (should fail) | ✓ PASS | - | - |

### Protected Endpoints

**Status:** 7/12 passed (58.3%)

| Test | Status | Duration | Notes |
|------|--------|----------|-------|
| /api/strategies without auth (should fail) | ✓ PASS | - | - |
| /api/backtests without auth (should fail) | ✓ PASS | - | - |
| /api/positions without auth (should fail) | ✓ PASS | - | - |
| /api/orders without auth (should fail) | ✗ FAIL | - | Should have returned 401 |
| /api/alpaca/account without auth (should fail) | ✗ FAIL | - | Should have returned 401 |
| /api/alpaca/positions without auth (should fail) | ✓ PASS | - | - |
| /api/alpaca/orders without auth (should fail) | ✓ PASS | - | - |
| /api/strategies with auth | ✓ PASS | 11ms | - |
| /api/backtests with auth | ✗ FAIL | 12ms | Invalid response |
| /api/positions with auth | ✗ FAIL | 648ms | Invalid response |
| /api/orders with auth | ✗ FAIL | 11ms | Invalid response |
| /api/trades with auth | ✓ PASS | 16ms | - |

### Strategy Management

**Status:** 0/1 passed (0.0%)

| Test | Status | Duration | Notes |
|------|--------|----------|-------|
| Create strategy | ✗ FAIL | 12ms | No strategy ID |

### Database Operations

**Status:** 0/2 passed (0.0%)

| Test | Status | Duration | Notes |
|------|--------|----------|-------|
| getUserByUsername | ✗ FAIL | - | storage.getUserByUsername is not a function |
| createStrategy with userId | ✗ FAIL | - | storage.getUserByUsername is not a function |

### Input Sanitization

**Status:** 3/3 passed (100.0%)

| Test | Status | Duration | Notes |
|------|--------|----------|-------|
| XSS sanitization in username | ✓ PASS | - | - |
| XSS sanitization in strategy name | ✓ PASS | - | - |
| SQL injection protection | ✓ PASS | - | Request rejected (also acceptable) |

### Error Handling

**Status:** 3/3 passed (100.0%)

| Test | Status | Duration | Notes |
|------|--------|----------|-------|
| Invalid credentials error | ✓ PASS | - | - |
| Missing required fields error | ✓ PASS | - | - |
| Non-existent resource error | ✓ PASS | - | - |

### Performance

**Status:** 0/2 passed (0.0%)

| Test | Status | Duration | Notes |
|------|--------|----------|-------|
| API response time | ✗ FAIL | - | 401: {"error":"Session expired"} |
| Concurrent requests | ✗ FAIL | - | 401: {"error":"Session expired"} |

## Failed Tests Details

### ✗ [Authentication] Signup User 1

**Error:** No user ID in response

**Details:** {"id":"fe994dd4-1965-49ef-bbeb-8676498bcadb","username":"regtest1_1766560318445","isAdmin":false}

### ✗ [Authentication] Signup User 2

**Error:** No user ID in response

**Details:** {"id":"b270a941-5e76-4183-9dcb-5664c15605fb","username":"regtest2_1766560318445","isAdmin":false}

### ✗ [Protected Endpoints] /api/orders without auth (should fail)

**Error:** Should have returned 401

### ✗ [Protected Endpoints] /api/alpaca/account without auth (should fail)

**Error:** Should have returned 401

### ✗ [Protected Endpoints] /api/backtests with auth

**Error:** Invalid response

**Details:** {"runs":[{"id":"c662aef6-0d90-42eb-b0a6-7c156ef97d2a","createdAt":"2025-12-24T07:09:07.269Z","updatedAt":"2025-12-24T07:09:18.958Z","status":"DONE","strategyId":"198e0ad0-248b-4a4f-ab61-ef13fc29edb9","strategyConfigHash":"44136fa355b3678a","strategyConfig":{},"universe":["AAPL","MSFT","GOOGL"],"broker":"alpaca","timeframe":"1Day","startDate":"2024-01-01","endDate":"2024-12-01","initialCash":100000,"feesModel":{"type":"fixed","value":1},"slippageModel":{"type":"bps","value":5},"executionPriceRule":"NEXT_OPEN","dataSource":"alpaca","provenance":{"provider":"alpaca","dateRange":{"end":"2024-12-01","start":"2024-01-01"},"timeframe":"1Day","cacheHitRate":0,"dataPulledAt":"2025-12-24T07:09:15.142Z","barsCountBySymbol":{"AAPL":231,"MSFT":231,"GOOGL":231},"nextPageTokensUsed":0},"resultsSummary":{"cagr":0.7937399092029507,"avgWinPct":0.713369052857143,"avgLossPct":0.33082142444444496,"expectancy":0.1260119093749998,"winRatePct":43.75,"calmarRatio":0.17687014260913778,"sharpeRatio":0.4801594667002281,"totalTrades":16,"profitFactor":1.6771664580020025,"sortinoRatio":0.33980486326323056,"maxDrawdownPct":4.487698700831731,"totalReturnPct":2.1979747474999747,"tradesPerMonth":1.4457831325301205,"avgHoldingPeriodDays":33.88115887380593},"errorMessage":null,"runtimeMs":11699},{"id":"4a1b3bc8-73a1-4d15-a477-cbf76d641280","createdAt":"2025-12-18T22:02:08.930Z","updatedAt":"2025-12-18T22:02:42.507Z","status":"FAILED","strategyId":null,"strategyConfigHash":"1af4833ae82fc4c6","strategyConfig":{"type":"ma-crossover","fastPeriod":10,"slowPeriod":20,"allocationPct":10},"universe":["AAPL","NVDA"],"broker":"alpaca","timeframe":"1Day","startDate":"2025-09-19","endDate":"2025-12-18","initialCash":10000,"feesModel":{"type":"fixed","value":1},"slippageModel":{"type":"bps","value":5},"executionPriceRule":"NEXT_OPEN","dataSource":"alpaca","provenance":null,"resultsSummary":null,"errorMessage":"No historical data found for the specified date range (2025-09-19 to 2025-12-18). Symbols without data: AAPL, NVDA. Please verify the date range is valid and the symbols are active.","runtimeMs":33581},{"id":"2e662bce-2878-4004-a584-cd073c100e47","createdAt":"2025-12-16T11:40:34.422Z","updatedAt":"2025-12-16T11:41:04.928Z","status":"FAILED","strategyId":null,"strategyConfigHash":"1af4833ae82fc4c6","strategyConfig":{"type":"ma-crossover","fastPeriod":10,"slowPeriod":20,"allocationPct":10},"universe":["AAPL","SPY"],"broker":"alpaca","timeframe":"1Day","startDate":"2025-09-17","endDate":"2025-12-16","initialCash":10000,"feesModel":{"type":"fixed","value":1},"slippageModel":{"type":"bps","value":5},"executionPriceRule":"NEXT_OPEN","dataSource":"alpaca","provenance":null,"resultsSummary":null,"errorMessage":"No historical data found for the specified date range (2025-09-17 to 2025-12-16). Symbols without data: AAPL, SPY. Please verify the date range is valid and the symbols are active.","runtimeMs":30507},{"id":"e3b234e8-fb7d-4e13-ae62-3c81a0293abf","createdAt":"2025-12-15T22:21:28.352Z","updatedAt":"2025-12-15T22:22:16.742Z","status":"FAILED","strategyId":null,"strategyConfigHash":"1af4833ae82fc4c6","strategyConfig":{"type":"ma-crossover","fastPeriod":10,"slowPeriod":20,"allocationPct":10},"universe":["AAPL","SPY","QQQ"],"broker":"alpaca","timeframe":"1Day","startDate":"2025-09-16","endDate":"2025-12-15","initialCash":10000,"feesModel":{"type":"fixed","value":1},"slippageModel":{"type":"bps","value":5},"executionPriceRule":"NEXT_OPEN","dataSource":"alpaca","provenance":null,"resultsSummary":null,"errorMessage":"No historical data found for the specified date range (2025-09-16 to 2025-12-15). Symbols without data: AAPL, SPY, QQQ. Please verify the date range is valid and the symbols are active.","runtimeMs":48391},{"id":"bc406bfb-a81e-4ef8-9537-2fdac109114d","createdAt":"2025-12-15T22:06:45.844Z","updatedAt":"2025-12-15T22:07:36.084Z","status":"FAILED","strategyId":null,"strategyConfigHash":"9c5213ffa99e3c4e","strategyConfig":{"type":"rsi-oscillator","oversold":30,"rsiPeriod":14,"overbought":70,"allocationPct":10},"universe":["AAPL","TSLA"],"broker":"alpaca","timeframe":"1Day","startDate":"2025-09-16","endDate":"2025-12-15","initialCash":10000,"feesModel":{"type":"fixed","value":1},"slippageModel":{"type":"bps","value":5},"executionPriceRule":"NEXT_OPEN","dataSource":"alpaca","provenance":null,"resultsSummary":null,"errorMessage":"No historical data found for the specified date range (2025-09-16 to 2025-12-15). Symbols without data: AAPL, TSLA. Please verify the date range is valid and the symbols are active.","runtimeMs":50241},{"id":"b2156aa0-e448-4be8-b035-9fe826f3197e","createdAt":"2025-12-15T21:53:47.603Z","updatedAt":"2025-12-15T21:53:47.607Z","status":"RUNNING","strategyId":null,"strategyConfigHash":"70880c1c4193916f","strategyConfig":{"type":"buy-and-hold","allocationPct":10},"universe":["SPY","QQQ","NVDA"],"broker":"alpaca","timeframe":"1Day","startDate":"2025-09-16","endDate":"2025-12-15","initialCash":10000,"feesModel":{"type":"fixed","value":1},"slippageModel":{"type":"bps","value":5},"executionPriceRule":"NEXT_OPEN","dataSource":"alpaca","provenance":null,"resultsSummary":null,"errorMessage":null,"runtimeMs":null},{"id":"3fa2a26c-e3f8-4df3-b4a1-e957655c5b48","createdAt":"2025-12-15T21:45:38.853Z","updatedAt":"2025-12-15T21:45:38.868Z","status":"RUNNING","strategyId":null,"strategyConfigHash":"1af4833ae82fc4c6","strategyConfig":{"type":"ma-crossover","fastPeriod":10,"slowPeriod":20,"allocationPct":10},"universe":["AAPL","META","NVDA","TSLA"],"broker":"alpaca","timeframe":"1Day","startDate":"2025-09-16","endDate":"2025-12-15","initialCash":10000,"feesModel":{"type":"fixed","value":1},"slippageModel":{"type":"bps","value":5},"executionPriceRule":"NEXT_OPEN","dataSource":"alpaca","provenance":null,"resultsSummary":null,"errorMessage":null,"runtimeMs":null},{"id":"997fa131-43e3-4800-9d63-5b31bd96bf4b","createdAt":"2025-12-15T21:27:51.666Z","updatedAt":"2025-12-15T21:27:52.532Z","status":"DONE","strategyId":null,"strategyConfigHash":"44136fa355b3678a","strategyConfig":{},"universe":["NVDA","TSLA"],"broker":"alpaca","timeframe":"1Day","startDate":"2024-01-01","endDate":"2024-12-01","initialCash":10000,"feesModel":{"type":"fixed","value":1},"slippageModel":{"type":"bps","value":5},"executionPriceRule":"NEXT_OPEN","dataSource":"alpaca","provenance":{"provider":"alpaca","dateRange":{"end":"2024-12-01","start":"2024-01-01"},"timeframe":"1Day","cacheHitRate":0,"dataPulledAt":"2025-12-15T21:27:52.423Z","barsCountBySymbol":{"NVDA":231,"TSLA":231},"nextPageTokensUsed":0},"resultsSummary":{"cagr":4.637005895226509,"avgWinPct":1.4541683333333328,"avgLossPct":0,"winRatePct":100,"sharpeRatio":1.2079723618454437,"totalTrades":6,"profitFactor":null,"sortinoRatio":1.0454889846792195,"maxDrawdownPct":3.256705433204885,"totalReturnPct":8.665009999999985},"errorMessage":null,"runtimeMs":867},{"id":"c313d5b8-ff07-4c88-b071-c1bc77949383","createdAt":"2025-12-15T21:27:37.418Z","updatedAt":"2025-12-15T21:27:38.627Z","status":"DONE","strategyId":null,"strategyConfigHash":"44136fa355b3678a","strategyConfig":{},"universe":["NVDA","TSLA","SPY"],"broker":"alpaca","timeframe":"1Day","startDate":"2024-09-16","endDate":"2024-12-15","initialCash":10000,"feesModel":{"type":"fixed","value":1},"slippageModel":{"type":"bps","value":5},"executionPriceRule":"NEXT_OPEN","dataSource":"alpaca","provenance":{"provider":"alpaca","dateRange":{"end":"2024-12-15","start":"2024-09-16"},"timeframe":"1Day","cacheHitRate":0,"dataPulledAt":"2025-12-15T21:27:38.561Z","barsCountBySymbol":{"SPY":64,"NVDA":64,"TSLA":64},"nextPageTokensUsed":0},"resultsSummary":{"cagr":null,"avgWinPct":0,"avgLossPct":0,"winRatePct":0,"sharpeRatio":2.5375253371799347,"totalTrades":0,"profitFactor":null,"sortinoRatio":1.9743613130287372,"maxDrawdownPct":1.1980071515731205,"totalReturnPct":5.374286075000018},"errorMessage":null,"runtimeMs":1210},{"id":"17e9f0b5-ba68-49f7-8019-5a3bc94c2406","createdAt":"2025-12-15T21:27:26.184Z","updatedAt":"2025-12-15T21:27:26.275Z","status":"DONE","strategyId":null,"strategyConfigHash":"44136fa355b3678a","strategyConfig":{},"universe":["AAPL"],"broker":"alpaca","timeframe":"1Day","startDate":"2024-06-01","endDate":"2024-12-01","initialCash":10000,"feesModel":{"type":"fixed","value":1},"slippageModel":{"type":"bps","value":5},"executionPriceRule":"NEXT_OPEN","dataSource":"alpaca","provenance":{"provider":"alpaca","dateRange":{"end":"2024-12-01","start":"2024-06-01"},"timeframe":"1Day","cacheHitRate":1,"dataPulledAt":"2025-12-15T21:27:26.203Z","barsCountBySymbol":{"AAPL":126},"nextPageTokensUsed":0},"resultsSummary":{"cagr":null,"avgWinPct":0,"avgLossPct":0.2303707000000003,"winRatePct":0,"sharpeRatio":-0.506761702842606,"totalTrades":2,"profitFactor":0,"sortinoRatio":-0.28435601013737316,"maxDrawdownPct":0.6011079912835007,"totalReturnPct":-0.26057060000001003},"errorMessage":null,"runtimeMs":100},{"id":"3ee59b8a-8667-47f7-a944-208f531af8a7","createdAt":"2025-12-15T21:27:17.284Z","updatedAt":"2025-12-15T21:27:17.450Z","status":"DONE","strategyId":null,"strategyConfigHash":"44136fa355b3678a","strategyConfig":{},"universe":["AAPL"],"broker":"alpaca","timeframe":"1Day","startDate":"2024-06-01","endDate":"2024-12-01","initialCash":10000,"feesModel":{"type":"fixed","value":1},"slippageModel":{"type":"bps","value":5},"executionPriceRule":"NEXT_OPEN","dataSource":"alpaca","provenance":{"provider":"alpaca","dateRange":{"end":"2024-12-01","start":"2024-06-01"},"timeframe":"1Day","cacheHitRate":0,"dataPulledAt":"2025-12-15T21:27:17.413Z","barsCountBySymbol":{"AAPL":126},"nextPageTokensUsed":0},"resultsSummary":{"cagr":null,"avgWinPct":0,"avgLossPct":0.2303707000000003,"winRatePct":0,"sharpeRatio":-0.506761702842606,"totalTrades":2,"profitFactor":0,"sortinoRatio":-0.28435601013737316,"maxDrawdownPct":0.6011079912835007,"totalReturnPct":-0.26057060000001003},"errorMessage":null,"runtimeMs":168},{"id":"6196966c-091a-42a0-bde0-6771803bdb66","createdAt":"2025-12-15T20:55:31.592Z","updatedAt":"2025-12-15T20:56:02.649Z","status":"DONE","strategyId":null,"strategyConfigHash":"1af4833ae82fc4c6","strategyConfig":{"type":"ma-crossover","fastPeriod":10,"slowPeriod":20,"allocationPct":10},"universe":["AAPL","SPY"],"broker":"alpaca","timeframe":"1Day","startDate":"2025-09-16","endDate":"2025-12-15","initialCash":10000,"feesModel":{"type":"fixed","value":1},"slippageModel":{"type":"bps","value":5},"executionPriceRule":"NEXT_OPEN","dataSource":"alpaca","provenance":{"provider":"alpaca","dateRange":{"end":"2025-12-15","start":"2025-09-16"},"timeframe":"1Day","cacheHitRate":0,"dataPulledAt":"2025-12-15T20:56:02.648Z","barsCountBySymbol":{"SPY":0,"AAPL":0},"nextPageTokensUsed":0},"resultsSummary":{"cagr":null,"avgWinPct":0,"avgLossPct":0,"winRatePct":0,"sharpeRatio":null,"totalTrades":0,"profitFactor":null,"sortinoRatio":null,"maxDrawdownPct":0,"totalReturnPct":0},"errorMessage":null,"runtimeMs":31058},{"id":"7481c471-5e26-4bac-bc58-fe98e87112c7","createdAt":"2025-12-15T20:43:54.092Z","updatedAt":"2025-12-15T20:44:24.346Z","status":"DONE","strategyId":null,"strategyConfigHash":"9c5213ffa99e3c4e","strategyConfig":{"type":"rsi-oscillator","oversold":30,"rsiPeriod":14,"overbought":70,"allocationPct":10},"universe":["NVDA","TSLA"],"broker":"alpaca","timeframe":"1Day","startDate":"2025-09-16","endDate":"2025-12-15","initialCash":10000,"feesModel":{"type":"fixed","value":1},"slippageModel":{"type":"bps","value":5},"executionPriceRule":"NEXT_OPEN","dataSource":"alpaca","provenance":{"provider":"alpaca","dateRange":{"end":"2025-12-15","start":"2025-09-16"},"timeframe":"1Day","cacheHitRate":0,"dataPulledAt":"2025-12-15T20:44:24.344Z","barsCountBySymbol":{"NVDA":0,"TSLA":0},"nextPageTokensUsed":0},"resultsSummary":{"cagr":null,"avgWinPct":0,"avgLossPct":0,"winRatePct":0,"sharpeRatio":null,"totalTrades":0,"profitFactor":null,"sortinoRatio":null,"maxDrawdownPct":0,"totalReturnPct":0},"errorMessage":null,"runtimeMs":30255},{"id":"eb1c2b67-e335-4490-888f-9b23f47849fe","createdAt":"2025-12-15T20:39:43.738Z","updatedAt":"2025-12-15T20:39:44.198Z","status":"DONE","strategyId":null,"strategyConfigHash":"44136fa355b3678a","strategyConfig":{},"universe":["AAPL","GOOGL"],"broker":"alpaca","timeframe":"1Day","startDate":"2024-06-01","endDate":"2024-12-01","initialCash":10000,"feesModel":{"type":"fixed","value":1},"slippageModel":{"type":"bps","value":5},"executionPriceRule":"NEXT_OPEN","dataSource":"alpaca","provenance":{"provider":"alpaca","dateRange":{"end":"2024-12-01","start":"2024-06-01"},"timeframe":"1Day","cacheHitRate":0,"dataPulledAt":"2025-12-15T20:39:44.156Z","barsCountBySymbol":{"AAPL":126,"GOOGL":126},"nextPageTokensUsed":0},"resultsSummary":{"cagr":-2.216244075000018,"avgWinPct":0.13019030000000015,"avgLossPct":0.65792264375,"winRatePct":20,"sharpeRatio":-1.157497315238663,"totalTrades":5,"profitFactor":0.049470215547661844,"sortinoRatio":-0.613142849686567,"maxDrawdownPct":2.8361063037591676,"totalReturnPct":-2.2162440750000134},"errorMessage":null,"runtimeMs":462},{"id":"e0180030-2c6e-4b29-b481-d922c384d8ad","createdAt":"2025-12-15T20:19:58.293Z","updatedAt":"2025-12-15T20:19:58.449Z","status":"DONE","strategyId":null,"strategyConfigHash":"44136fa355b3678a","strategyConfig":{},"universe":["AAPL"],"broker":"alpaca","timeframe":"1Day","startDate":"2025-01-01","endDate":"2025-01-31","initialCash":10000,"feesModel":{"type":"fixed","value":1},"slippageModel":{"type":"bps","value":5},"executionPriceRule":"NEXT_OPEN","dataSource":"alpaca","provenance":{"provider":"alpaca","dateRange":{"end":"2025-01-31","start":"2025-01-01"},"timeframe":"1Day","cacheHitRate":0,"dataPulledAt":"2025-12-15T20:19:58.426Z","barsCountBySymbol":{"AAPL":20},"nextPageTokensUsed":0},"resultsSummary":{"cagr":null,"avgWinPct":0,"avgLossPct":0,"winRatePct":0,"sharpeRatio":null,"totalTrades":0,"profitFactor":null,"sortinoRatio":null,"maxDrawdownPct":0,"totalReturnPct":0},"errorMessage":null,"runtimeMs":161}],"limit":50,"offset":0}

### ✗ [Protected Endpoints] /api/positions with auth

**Error:** Invalid response

**Details:** {"positions":[{"id":"b0b6dd9d-8b9b-48a9-ba46-b9d54906e415","symbol":"AAPL","quantity":38.190740892,"entryPrice":273.705348,"currentPrice":272.36,"unrealizedPnl":-51.379837,"unrealizedPnlPercent":-0.49153150023009,"side":"long","marketValue":10401.630189,"costBasis":10453.010026,"changeToday":0,"assetClass":"us_equity","exchange":"NASDAQ","_source":{"source":"alpaca_live","fetchedAt":"2025-12-24T07:11:59.776Z","isStale":false}},{"id":"467bc92e-332b-4f62-95c7-3c9288c20018","symbol":"BLK","quantity":9.480963216,"entryPrice":1085.53,"currentPrice":1086.55,"unrealizedPnl":9.670582,"unrealizedPnlPercent":0.09396331278961,"side":"long","marketValue":10301.540582,"costBasis":10291.87,"changeToday":0,"assetClass":"us_equity","exchange":"NYSE","_source":{"source":"alpaca_live","fetchedAt":"2025-12-24T07:11:59.776Z","isStale":false}},{"id":"64bbff51-59d6-4b3c-9351-13ad85e3c752","symbol":"BTCUSD","quantity":0.111499247,"entryPrice":90137.34,"currentPrice":87047.918,"unrealizedPnl":-344.468227,"unrealizedPnlPercent":-3.42746080910998,"side":"long","marketValue":9705.77731,"costBasis":10050.245537,"changeToday":-0.11300753674276999,"assetClass":"crypto","exchange":"CRYPTO","_source":{"source":"alpaca_live","fetchedAt":"2025-12-24T07:11:59.776Z","isStale":false}},{"id":"1f888138-e413-4939-b16b-bdd08bb4debd","symbol":"COST","quantity":12.102570422,"entryPrice":852,"currentPrice":854.79,"unrealizedPnl":33.766171,"unrealizedPnlPercent":0.32746478408828,"side":"long","marketValue":10345.156171,"costBasis":10311.39,"changeToday":0,"assetClass":"us_equity","exchange":"NASDAQ","_source":{"source":"alpaca_live","fetchedAt":"2025-12-24T07:11:59.776Z","isStale":false}},{"id":"69b15845-7c63-4586-b274-1cfdfe9df3d8","symbol":"GOOGL","quantity":31.206024941,"entryPrice":313.873684,"currentPrice":314.35,"unrealizedPnl":14.863941,"unrealizedPnlPercent":0.15175416423611998,"side":"long","marketValue":9809.61394,"costBasis":9794.749999,"changeToday":0,"assetClass":"us_equity","exchange":"NASDAQ","_source":{"source":"alpaca_live","fetchedAt":"2025-12-24T07:11:59.776Z","isStale":false}},{"id":"ef9adcc6-6bce-452b-af5f-4a87e7f19131","symbol":"JNJ","quantity":50.004897682,"entryPrice":206.22,"currentPrice":205.78,"unrealizedPnl":-22.002155,"unrealizedPnlPercent":-0.21336436834332,"side":"long","marketValue":10290.007845,"costBasis":10312.01,"changeToday":0,"assetClass":"us_equity","exchange":"NYSE","_source":{"source":"alpaca_live","fetchedAt":"2025-12-24T07:11:59.776Z","isStale":false}},{"id":"e3047683-637a-4fb2-b71d-805cd6fec95d","symbol":"JPM","quantity":23.647684168,"entryPrice":326.909813,"currentPrice":325.93,"unrealizedPnl":-23.170299,"unrealizedPnlPercent":-0.29971954529109,"side":"long","marketValue":7707.489701,"costBasis":7730.66,"changeToday":0,"assetClass":"us_equity","exchange":"NYSE","_source":{"source":"alpaca_live","fetchedAt":"2025-12-24T07:11:59.776Z","isStale":false}},{"id":"0ef68826-b0f7-45b8-b273-8251f7133f0a","symbol":"MSCI","quantity":17.765272313,"entryPrice":579.48,"currentPrice":581.3,"unrealizedPnl":32.332796,"unrealizedPnlPercent":0.31407469144077,"side":"long","marketValue":10326.952796,"costBasis":10294.62,"changeToday":0,"assetClass":"us_equity","exchange":"NYSE","_source":{"source":"alpaca_live","fetchedAt":"2025-12-24T07:11:59.776Z","isStale":false}},{"id":"27982558-2464-4daf-bb2f-b3b728659884","symbol":"ORCL","quantity":52.205894288,"entryPrice":197.14,"currentPrice":195.34,"unrealizedPnl":-93.97061,"unrealizedPnlPercent":-0.9130567136973199,"side":"long","marketValue":10197.89939,"costBasis":10291.87,"changeToday":0,"assetClass":"us_equity","exchange":"NYSE","_source":{"source":"alpaca_live","fetchedAt":"2025-12-24T07:11:59.776Z","isStale":false}},{"id":"f81a406b-a53c-4ea5-ab05-6fb92bfc6bd7","symbol":"PG","quantity":106,"entryPrice":146.303962,"currentPrice":143.18,"unrealizedPnl":-331.14,"unrealizedPnlPercent":-2.13525472297917,"side":"long","marketValue":15177.08,"costBasis":15508.22,"changeToday":0,"assetClass":"us_equity","exchange":"NYSE","_source":{"source":"alpaca_live","fetchedAt":"2025-12-24T07:11:59.776Z","isStale":false}},{"id":"0a7deac5-2d75-4e54-9f66-51c1c6fad55b","symbol":"SBUX","quantity":122.637844909,"entryPrice":84.08,"currentPrice":83.86,"unrealizedPnl":-26.980326,"unrealizedPnlPercent":-0.26165556729015,"side":"long","marketValue":10284.409674,"costBasis":10311.39,"changeToday":0,"assetClass":"us_equity","exchange":"NASDAQ","_source":{"source":"alpaca_live","fetchedAt":"2025-12-24T07:11:59.776Z","isStale":false}},{"id":"8ccae427-5dd0-45b3-b5fe-7ba5e422c766","symbol":"TSLA","quantity":21.21213901,"entryPrice":489.271878,"currentPrice":485.56,"unrealizedPnl":-78.736872,"unrealizedPnlPercent":-0.75865345240264,"side":"long","marketValue":10299.766218,"costBasis":10378.50309,"changeToday":0,"assetClass":"us_equity","exchange":"NASDAQ","_source":{"source":"alpaca_live","fetchedAt":"2025-12-24T07:11:59.776Z","isStale":false}},{"id":"bea0f181-afd8-4bd2-9486-85d3fc2f10d7","symbol":"UBER","quantity":126.545611015,"entryPrice":81.34,"currentPrice":80.97,"unrealizedPnl":-46.821876,"unrealizedPnlPercent":-0.45488074674397,"side":"long","marketValue":10246.398124,"costBasis":10293.22,"changeToday":0,"assetClass":"us_equity","exchange":"NYSE","_source":{"source":"alpaca_live","fetchedAt":"2025-12-24T07:11:59.776Z","isStale":false}},{"id":"4f5baf1e-0e9b-4d85-b88a-d874dc4a3c42","symbol":"V","quantity":27.650762867,"entryPrice":354.176847,"currentPrice":353.38,"unrealizedPnl":-22.033418,"unrealizedPnlPercent":-0.22498553086511003,"side":"long","marketValue":9771.226582,"costBasis":9793.26,"changeToday":0,"assetClass":"us_equity","exchange":"NYSE","_source":{"source":"alpaca_live","fetchedAt":"2025-12-24T07:11:59.776Z","isStale":false}}],"_source":{"source":"alpaca_live","fetchedAt":"2025-12-24T07:12:00.418Z","isStale":false}}

### ✗ [Protected Endpoints] /api/orders with auth

**Error:** Invalid response

**Details:** {"orders":[],"_source":{"type":"database","table":"orders","fetchedAt":"2025-12-24T07:12:00.427Z","note":"Orders stored in local database, synced from broker"}}

### ✗ [Strategy Management] Create strategy

**Error:** No strategy ID

**Details:** {"id":"0451b572-c76f-4aff-aaa6-e8bcaafc2b72","name":"Test Strategy","type":"omar","description":null,"isActive":false,"assets":null,"parameters":null,"createdAt":"2025-12-24T07:12:00.455Z","updatedAt":"2025-12-24T07:12:00.455Z"}

### ✗ [Database Operations] getUserByUsername

**Error:** storage.getUserByUsername is not a function

### ✗ [Database Operations] createStrategy with userId

**Error:** storage.getUserByUsername is not a function

### ✗ [Performance] API response time

**Error:** 401: {"error":"Session expired"}

### ✗ [Performance] Concurrent requests

**Error:** 401: {"error":"Session expired"}

## Recommendations

⚠ **12 test(s) failed.** Please review:

**Authentication:** 2 failure(s)
**Protected Endpoints:** 5 failure(s)
**Strategy Management:** 1 failure(s)
**Database Operations:** 2 failure(s)
**Performance:** 2 failure(s)

## Platform Health Assessment

Based on this comprehensive regression test:

**STATUS: CRITICAL** (60.0% pass rate)

Multiple critical issues detected. Immediate attention required.

---
*Report generated by AlphaFlow Comprehensive Regression Test Suite V2*
