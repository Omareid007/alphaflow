# AI Active Trader – Strategy Builder Design Guidelines

## Architecture Decisions

### Authentication
**Auth Required** - The app has multi-user features (profile, strategy configurations, trade history sync)
- Implement **SSO** with Apple Sign-In (required for iOS) and Google Sign-In
- Mock auth flow in prototype using local state
- Include login/signup screens with privacy policy & terms placeholders
- Account screen includes: log out (with confirmation), delete account (Settings > Account > Delete with double confirmation)
- Profile screen with user-customizable avatar (generate 3 preset avatars with financial/trading theme - abstract geometric patterns in brand colors), display name field, app preferences

### Navigation
**Tab Navigation** (4 tabs with floating action button for core action)
- Tab 1: **Dashboard** - Real-time trading overview, agent status, live positions
- Tab 2: **Analytics** - Trade history, performance metrics, equity curves  
- Tab 3: **Strategies** - Browse/configure strategies, view saved configurations
- Tab 4: **Admin** - Connector health, AI configuration, data fusion monitoring
- **Floating Action Button**: Start/Stop Trading Agent (primary action)

### Screen Specifications

#### Dashboard Screen (Tab 1)
- **Header**: Transparent, title "Dashboard", right button: layer toggle (Crypto/Stock/All)
- **Root view**: Scrollable with top inset: headerHeight + Spacing.xl, bottom inset: tabBarHeight + Spacing.xl
- **Components**: Agent status card (floating), market intelligence panel, open positions list, equity chart, news sentiment feed
- **Floating elements**: Agent status indicator (top, shadow: {width: 0, height: 2, opacity: 0.10, radius: 2})

#### Analytics Screen (Tab 2)
- **Header**: Transparent, title "Analytics", right button: filter icon
- **Root view**: Scrollable with safe area insets matching Dashboard
- **Components**: Performance metrics cards, equity curve chart, win rate visualization, trade ledger list with asset_type tags

#### Strategies Screen (Tab 3)
- **Header**: Custom with search bar, transparent background
- **Root view**: Scrollable list
- **Components**: Strategy cards (Range Trading, Momentum, Mean Reversion, Breakout), each showing activation status, description, JSON schema preview

#### Strategy Wizard Flow (Modal Stack)
- **Native modal presentation** with custom header
- **Header**: Left button: Cancel, Right button: Next/Done (disabled until valid)
- **Screens**: 
  1. Strategy selection (card grid)
  2. Asset selection (AI-suggested list with confidence scores)
  3. Configuration (dynamic form from JSON schema)
  4. Risk disclaimer (checkbox acknowledgment)
  5. Confirmation (summary view)
- **Form submit button**: Below form content in scrollable area

#### Admin Panel (Tab 4)
- **Header**: Transparent, title "Admin", right button: settings
- **Root view**: Scrollable
- **Sections**: 
  - Connector Health (expandable cards per layer)
  - Data Fusion Engine status
  - AI Orchestration config
  - API Provider settings

## Design System

### Color Palette
**Primary Brand**: Deep Blue (trust, stability)
- Primary: `#0A2463` (deep navy)
- Primary Light: `#3E92CC` (bright blue for accents)
- Primary Dark: `#001E3C`

**Semantic Colors**:
- Success/Profit: `#10B981` (green)
- Error/Loss: `#EF4444` (red)
- Warning/Risk: `#F59E0B` (amber)
- Neutral: `#6B7280` (gray)
- Background: `#F9FAFB` (light gray)
- Surface: `#FFFFFF`

**Execution Layer Indicators**:
- Crypto Layer: `#F7931A` (Bitcoin orange accent)
- Stock Layer: `#0A2463` (primary blue)
- Multi-layer: Gradient from orange to blue

**Data Quality Gradient** (for intelligence scores 0-1):
- Low (0-0.3): `#EF4444` red
- Medium (0.3-0.7): `#F59E0B` amber
- High (0.7-1.0): `#10B981` green

### Typography
- **Headings**: System font, SF Pro Display (iOS) / Roboto (Android)
  - H1: 28px, Bold
  - H2: 22px, Semibold
  - H3: 18px, Semibold
- **Body**: 16px, Regular
- **Caption**: 14px, Regular
- **Small**: 12px, Regular
- **Monospace** (for numbers, prices): SF Mono / Roboto Mono, 16px

### Visual Design
**Touchable Components**:
- All buttons have subtle scale animation (0.95) on press
- List items have light gray background flash on press
- Tab bar icons scale (1.1) when selected

**Card Components**:
- Border radius: 12px
- Background: white with 1px border `#E5E7EB`
- Padding: 16px
- NO drop shadow by default (keep interface clean)

**Floating Action Button** (Start/Stop Agent):
- Size: 64px diameter
- Position: Bottom-right, 16px from edges
- Background: Gradient (`#3E92CC` to `#0A2463`)
- Icon: Play/Stop (white)
- Shadow: {width: 0, height: 2, opacity: 0.10, radius: 2}
- States:
  - Idle: Blue gradient
  - Active: Pulsing green glow
  - Error: Red with warning icon

**Status Indicators**:
- Agent Running: Pulsing green dot (8px)
- Agent Stopped: Gray dot (8px)
- Layer Health: Traffic light colors (red/amber/green) with icon
- Data Fusion: Circular progress indicator with score overlay

**Charts** (TradingView Lightweight Charts):
- Background: transparent
- Grid: `#E5E7EB` subtle
- Candlesticks: Green (up) / Red (down)
- Volume bars: 30% opacity of candle color
- Indicators: Use Primary Light blue for MA/Bollinger bands
- Attribution: Small text link "Powered by TradingView" at chart bottom-right (required by Apache 2.0 license)

### Asset Requirements
**Critical Assets**:
1. **Execution Layer Icons** (2):
   - Crypto icon: Abstract cryptocurrency symbol (geometric, minimal)
   - Stock icon: Abstract stock chart line (upward trend, minimal)
2. **User Avatars** (3 presets):
   - Avatar 1: Circular geometric pattern (blue/navy gradient)
   - Avatar 2: Abstract wave pattern (trading chart inspired)
   - Avatar 3: Hexagonal tech pattern (AI/data theme)
3. **Strategy Icons** (4):
   - Range Trading: Horizontal bars icon
   - Momentum: Upward arrow with speed lines
   - Mean Reversion: Circular arrow icon
   - Breakout: Breaking barrier icon
4. **Data Source Icons**:
   - Standard Feather icons for APIs (database, cloud, rss for news)

**Icon System**: Use Feather icons from @expo/vector-icons (outlined, 24px default)

### Interaction Design
**Touch Targets**:
- Minimum: 44x44px for all tappable elements
- Buttons: 48px height minimum
- List items: 56px minimum height

**Gestures**:
- **Swipe left/right** on Dashboard: Switch execution layer view (Crypto/Stock/All)
- **Swipe left/right** on chart: Change timeframe (1H/4H/1D/1W)
- **Pull-to-refresh**: All list screens and Dashboard
- **Long press** on trade in ledger: Show detailed AI decision contract modal

**Haptic Feedback**:
- Light impact: Tab switch, list item tap
- Medium impact: Button press, form submission
- Heavy impact: Trade execution, error state
- Success notification: Trade filled
- Warning notification: Risk flag triggered

**Animations**:
- Screen transitions: Smooth 300ms ease-in-out
- Agent status changes: 500ms fade with scale
- Chart updates: Real-time with 100ms interpolation
- Loading states: Skeleton screens (pulse animation, light gray)

### Accessibility
- **Color contrast**: All text meets WCAG AA (4.5:1 minimum)
- **Touch targets**: 44x44px minimum
- **Labels**: All interactive elements have accessibility labels
- **Screen readers**: Semantic structure with headings
- **Dynamic type**: Support system font scaling
- **Reduced motion**: Respect accessibility settings, disable pulsing/heavy animations

### Data Visualization Principles
**Trade Ledger**:
- Profit rows: Light green tint background `#D1FAE5`
- Loss rows: Light red tint background `#FEE2E2`
- Asset type tags: Pill-shaped badges (crypto: orange border, stock: blue border)

**Performance Metrics**:
- Large numbers (P&L, equity): 32px, Monospace, Bold
- Percentage changes: Color-coded (green/red) with △/▽ symbols
- Win rate: Circular progress indicator with percentage in center

**Intelligence Score Display**:
- 0-1 score: Horizontal bar with gradient fill (red→amber→green)
- Confidence overlay: Opacity of bar reflects AI confidence
- Reasoning: Expandable card below score with bullet points

**Multi-Layer Portfolio View**:
- Split-screen cards: Crypto (left, orange accent) / Stock (right, blue accent)
- Aggregated view: Combined chart with layer-colored data series
- Quick toggle: Segmented control at top

### Safe Area Handling
**With Tab Bar**:
- Bottom inset: tabBarHeight + Spacing.xl (typically ~90px)

**With Transparent Header**:
- Top inset: headerHeight + Spacing.xl (typically ~110px)

**Floating Elements** (FAB, status cards):
- Bottom: insets.bottom + 16px
- Right: insets.right + 16px
- Use shadow as specified above