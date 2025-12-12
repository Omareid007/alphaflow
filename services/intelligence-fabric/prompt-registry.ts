/**
 * AI Active Trader - Prompt Registry
 * Centralized prompt management for consistent AI analysis across the platform.
 */

export interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  template: string;
  variables: string[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_PROMPTS: Record<string, string> = {
  document: `Analyze this financial document and extract:
1. Key financial metrics and their implications
2. Risk factors and concerns
3. Growth opportunities
4. Competitive positioning
5. Actionable trading signals (bullish/bearish indicators)

Be concise and focus on information relevant for trading decisions.`,

  table: `Analyze this financial data table and identify:
1. Trends and patterns in the data
2. Anomalies or outliers that warrant attention
3. Key metrics and their interpretations
4. Comparisons with typical market behavior
5. Trading signals based on the data

Focus on actionable insights for trading.`,

  timeseries: `Analyze this time series data and provide:
1. Trend direction (upward, downward, sideways)
2. Key support and resistance levels
3. Volatility assessment
4. Momentum indicators interpretation
5. Short-term and medium-term outlook

Provide specific price levels when possible.`,

  news: `Analyze this news content for trading implications:
1. Sentiment (positive, negative, neutral) with confidence
2. Market impact assessment (high, medium, low)
3. Affected sectors and companies
4. Potential price movement direction
5. Recommended actions (if any)

Focus on immediate trading relevance.`,

  report: `Analyze this financial report and summarize:
1. Key takeaways affecting stock valuation
2. Revenue/earnings vs expectations
3. Forward guidance implications
4. Management commentary highlights
5. Buy/Sell/Hold recommendation with rationale

Be specific about numbers and percentages.`,

  market: `Provide market analysis covering:
1. Current market regime (bull, bear, sideways, volatile)
2. Key technical levels
3. Sector rotation patterns
4. Risk-on vs risk-off sentiment
5. Short-term outlook and potential catalysts

Focus on actionable intelligence for trading decisions.`,

  sentiment: `Analyze sentiment from this content:
1. Overall sentiment score (-1 to 1)
2. Confidence level (0 to 1)
3. Key sentiment drivers
4. Contrarian signals (if any)
5. Impact on trading strategy

Quantify where possible.`,

  fundamental: `Perform fundamental analysis:
1. Valuation metrics (P/E, P/B, EV/EBITDA)
2. Financial health (debt ratios, cash flow)
3. Growth trajectory
4. Competitive moat assessment
5. Fair value estimate and margin of safety

Provide specific numbers and comparisons to peers.`,

  technical: `Perform technical analysis:
1. Primary trend identification
2. Key support and resistance levels
3. Chart patterns (if any)
4. Indicator readings (RSI, MACD, moving averages)
5. Entry/exit points with stop-loss levels

Be specific with price levels and percentages.`,
};

export class PromptRegistry {
  private prompts: Map<string, PromptTemplate> = new Map();
  private customPrompts: Map<string, string> = new Map();

  constructor() {
    this.initializeDefaultPrompts();
  }

  private initializeDefaultPrompts(): void {
    for (const [id, template] of Object.entries(DEFAULT_PROMPTS)) {
      this.prompts.set(id, {
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1) + ' Analysis',
        category: 'default',
        template,
        variables: this.extractVariables(template),
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  private extractVariables(template: string): string[] {
    const matches = template.match(/\{\{(\w+)\}\}/g) || [];
    return matches.map(m => m.replace(/\{\{|\}\}/g, ''));
  }

  getPrompt(id: string, variables?: Record<string, string>): string {
    const custom = this.customPrompts.get(id);
    if (custom) {
      return this.interpolate(custom, variables);
    }

    const template = this.prompts.get(id);
    if (template) {
      return this.interpolate(template.template, variables);
    }

    return this.prompts.get('market')?.template || 'Analyze this data.';
  }

  private interpolate(template: string, variables?: Record<string, string>): string {
    if (!variables) return template;

    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
  }

  registerPrompt(id: string, template: string, name?: string, category?: string): void {
    this.prompts.set(id, {
      id,
      name: name || id,
      category: category || 'custom',
      template,
      variables: this.extractVariables(template),
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  setCustomPrompt(id: string, template: string): void {
    this.customPrompts.set(id, template);
  }

  getTemplate(id: string): PromptTemplate | undefined {
    return this.prompts.get(id);
  }

  getAllTemplates(): PromptTemplate[] {
    return Array.from(this.prompts.values());
  }

  getTemplatesByCategory(category: string): PromptTemplate[] {
    return Array.from(this.prompts.values()).filter(p => p.category === category);
  }

  deletePrompt(id: string): boolean {
    this.customPrompts.delete(id);
    return this.prompts.delete(id);
  }

  createTradingPrompt(config: {
    symbol: string;
    timeframe: string;
    riskTolerance: 'conservative' | 'moderate' | 'aggressive';
    focusAreas: string[];
  }): string {
    const riskModifiers = {
      conservative: 'prioritize capital preservation and require high-confidence signals',
      moderate: 'balance risk and reward with reasonable position sizing',
      aggressive: 'seek high-return opportunities with appropriate risk management',
    };

    return `Analyze ${config.symbol} for ${config.timeframe} trading with ${config.riskTolerance} risk tolerance.

Focus areas: ${config.focusAreas.join(', ')}

Trading approach: ${riskModifiers[config.riskTolerance]}

Provide:
1. Current market position assessment
2. Entry point recommendations with justification
3. Stop-loss and take-profit levels
4. Position sizing suggestion (as % of portfolio)
5. Confidence level and key risks

Be specific with price levels and percentages.`;
  }
}

export function createPromptRegistry(): PromptRegistry {
  return new PromptRegistry();
}
