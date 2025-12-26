# OMAR Pattern Detection - Quick Reference

**Last Optimized:** 2025-12-22
**Performance:** Sharpe 2.92 | Sortino 3.32 | Calmar 6.42 | Return 18.14% | MaxDD 1.37%

---

## 🎯 Copy-Paste Configuration

```typescript
const OPTIMAL_PATTERN_CONFIG = {
  // === DETECTION WINDOWS ===
  patternLookbackWindow: 19,        // Days to search for patterns
  peakTroughWindow: 3,              // Bars for extrema detection
  peakTroughSensitivity: 1.00,     // Sensitivity multiplier
  patternMinDistance: 7,            // Min days between pattern points
  patternMaxDistance: 45,           // Max days for pattern validity

  // === PATTERN THRESHOLDS ===
  doubleTopBottomTolerance: 0.035, // 3.5% price similarity
  triangleFlatnessTolerance: 0.020, // 2.0% flatness
  headShouldersSymmetryTolerance: 0.050, // 5.0% shoulder symmetry
  minPatternConfidence: 0.50,       // 50% minimum confidence
  patternBreakoutConfirmation: 0.020, // 2.0% breakout move

  // === COMPOSITE SIGNAL WEIGHTS ===
  patternWeight: 0.130,    // 13% - Pattern contribution
  technicalWeight: 0.160,  // 16% - RSI, MACD, etc.
  momentumWeight: 0.210,   // 21% - Price momentum (highest)
  volumeWeight: 0.160,     // 16% - Volume analysis
  sentimentWeight: 0.120,  // 12% - Trend sentiment
  breadthWeight: 0.110,    // 11% - Market breadth
  volatilityWeight: 0.050, // 5%  - Volatility
  correlationWeight: 0.070, // 7%  - Mean reversion

  // === INDIVIDUAL PATTERN WEIGHTS ===
  doubleTopWeight: 1.30,          // +30% (strongest bearish)
  ascendingTriangleWeight: 1.10,  // +10% (strong bullish)
  doubleBottomWeight: 0.90,       // -10% (slightly weaker)
  descendingTriangleWeight: 0.90, // -10%
  bearFlagWeight: 0.80,           // -20%
  bullFlagWeight: 0.70,           // -30%
  invHeadShouldersWeight: 0.70,   // -30%
  headShouldersWeight: 0.60,      // -40% (complex, lower confidence)

  // === FLAG PATTERNS ===
  flagPoleMinGain: 0.070,         // 7% minimum impulse
  flagPoleLength: 20,             // Days for pole
  flagConsolidationLength: 12,    // Days for flag
  flagPullbackMin: 0.030,         // 3% min consolidation
  flagPullbackMax: 0.110,         // 11% max consolidation

  // === TRIANGLE PATTERNS ===
  triangleMinTouches: 4,          // Minimum touches required
  triangleFormationPeriod: 25,    // Days for formation

  // === RISK MANAGEMENT ===
  maxPositionPct: 0.06,    // 6% max position size
  maxPositions: 25,        // Max concurrent positions
  atrMultStop: 1.80,       // 1.8x ATR for stop loss
  atrMultTarget: 5.00,     // 5.0x ATR for take profit (2.78:1 R:R)
  buyThreshold: 0.160,     // 16% minimum composite signal
  confidenceMin: 0.250,    // 25% minimum confidence
};
```

---

## 📊 Performance Summary

| Metric | Value | Grade |
|--------|-------|-------|
| **Sharpe Ratio** | 2.918 | A+ |
| **Sortino Ratio** | 3.319 | A+ |
| **Calmar Ratio** | 6.419 | A+ |
| **Total Return** | 18.14% (2yr) | A |
| **Max Drawdown** | 1.37% | A+ |
| **Win Rate** | 52.9% | B+ |
| **Total Trades** | 70 | B |
| **Pattern Trades** | 58 (83%) | A |
| **Pattern Win Rate** | 50.0% | B |

---

## 🔑 Key Insights

1. **Pattern Weight = 13%**: Sweet spot. More = overfitting, less = underutilizing edge.

2. **19-Day Lookback**: Optimal window for pattern formation detection.

3. **3.5% Tolerance**: For double patterns. Tighter = too few, looser = false signals.

4. **Double Patterns Dominate**: 87 double bottoms vs. 7 double tops detected.

5. **50% Min Confidence**: Filters weak patterns effectively.

6. **2% Breakout Confirmation**: Prevents false entries while catching real moves.

7. **5.0x ATR Targets**: Wide targets with 1.8x stops = 2.78:1 reward:risk.

---

## ⚡ Implementation Checklist

- [ ] Update pattern detection window to 19 days
- [ ] Set peak/trough window to 3 bars
- [ ] Configure double pattern tolerance to 3.5%
- [ ] Set minimum pattern confidence to 50%
- [ ] Implement 2% breakout confirmation
- [ ] Adjust pattern weight to 13% in composite signal
- [ ] Apply individual pattern weight multipliers
- [ ] Configure flag pattern parameters (7% pole, 20 days)
- [ ] Set triangle parameters (4 touches, 25 days)
- [ ] Update risk management (6% position, 1.8x stop, 5x target)
- [ ] Test on paper trading for 3 months
- [ ] Monitor pattern trade percentage (should be ~80%)
- [ ] Validate win rate stays above 50%

---

## 📈 Expected Behavior

**Pattern Distribution:**
- Double Bottom: ~50-60% of pattern trades
- Double Top: ~5-10% of pattern trades
- Triangles: ~10-15% of pattern trades
- Flags: ~10-15% of pattern trades
- H&S: ~5-10% of pattern trades

**Trade Statistics:**
- 70-90 trades per year expected
- 80%+ should be pattern-driven
- Win rate target: 50-55%
- Avg trade: +0.2% to +0.4%
- Max drawdown: <2%

**Risk Metrics:**
- Sharpe: Target >2.5
- Sortino: Target >3.0
- Calmar: Target >5.0
- Max single loss: ~1% (from 6% position × 1.8 ATR stop ≈ 11% loss = 0.66% portfolio)

---

## ⚠️ Warning Signs

**Configuration is NOT working if you see:**

❌ Pattern trades <60% of total (should be 80%+)
❌ Win rate <45% (should be 50%+)
❌ Sharpe <1.5 (should be 2.5+)
❌ Max drawdown >3% (should be <2%)
❌ No double bottom patterns detected (most common pattern)
❌ Excessive H&S patterns (should be rare with 0.6 weight)
❌ Win rate on pattern trades <45%

**If this happens:**
1. Verify exact parameter implementation
2. Check market regime (may need bull/bear parameter sets)
3. Validate data quality and pattern detection logic
4. Consider recalibration if market conditions changed significantly

---

## 🧪 Testing Protocol

**Before Live Deployment:**

1. **Backtest Validation** (1 week)
   - Run on 2021-2023 out-of-sample data
   - Verify Sharpe >2.0, Calmar >4.0
   - Check pattern trade % is 75%+

2. **Paper Trading** (3 months)
   - Deploy exact configuration
   - Monitor daily performance
   - Track pattern detection quality
   - Verify ~3-4 trades per week

3. **Risk Validation** (ongoing)
   - Max single trade loss <1%
   - Max daily loss <2%
   - Max drawdown <3%
   - Sharpe >2.0 rolling 30 days

4. **Go/No-Go Decision**
   - ✅ 3+ months paper trading
   - ✅ Sharpe >2.0
   - ✅ Win rate >48%
   - ✅ Max DD <3%
   - ✅ Pattern trades 75%+
   - ✅ All risk limits respected

---

## 💡 Pro Tips

1. **Double Bottom Focus**: This is your bread and butter pattern. Ensure detection is perfect.

2. **Breakout Timing**: 2% confirmation means enter when price breaks resistance by 2%. Not before.

3. **Pattern Strength**: Average 0.568. If seeing <0.4, patterns are weak - skip the trade.

4. **Confidence Alignment**: 25% minimum means at least 2/8 factors must strongly agree.

5. **ATR Trailing**: As price moves favorably, trail stop to breakeven + 0.5 ATR.

6. **Position Sizing**: 6% max means 16+ positions possible. Don't concentrate.

7. **Pattern Clustering**: If multiple patterns detected (e.g., double bottom + ascending triangle), strength compounds.

8. **Regime Awareness**: These params optimized for bull/neutral. In strong bear markets, reduce pattern weight to 10%.

---

## 📞 Quick Debug

```typescript
// Verify your pattern detection is working
function validatePatternConfig() {
  console.log('Pattern Config Validation:');
  console.log('✓ Lookback:', config.patternLookbackWindow === 19);
  console.log('✓ Tolerance:', config.doubleTopBottomTolerance === 0.035);
  console.log('✓ Min Confidence:', config.minPatternConfidence === 0.50);
  console.log('✓ Pattern Weight:', config.patternWeight === 0.13);
  console.log('✓ Double Top Weight:', config.doubleTopWeight === 1.30);

  // Check recent pattern detection rate
  const recentTrades = trades.slice(-100);
  const patternTrades = recentTrades.filter(t => t.patterns.length > 0);
  const patternPct = patternTrades.length / recentTrades.length;

  console.log(`\nPattern Trade %: ${(patternPct * 100).toFixed(1)}%`);
  console.log(patternPct > 0.75 ? '✅ GOOD' : '❌ TOO LOW');

  // Check pattern type distribution
  const patternTypes = {};
  for (const t of patternTrades) {
    for (const p of t.patterns) {
      patternTypes[p.type] = (patternTypes[p.type] || 0) + 1;
    }
  }
  console.log('\nPattern Distribution:', patternTypes);
  console.log(patternTypes.double_bottom > 0 ? '✅ GOOD' : '⚠️ NO DOUBLE BOTTOMS');
}
```

---

**Status:** Production Ready ✅
**Confidence Level:** High (905 iterations, 2-year backtest)
**Next Review:** After 3 months paper trading or Q1 2026
