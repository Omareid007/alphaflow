## ADDED Requirements

### Requirement: Robinhood Color Palette

The system SHALL use a Robinhood-inspired color palette with neon green (#00C805) as the primary accent color for gains and positive actions.

#### Scenario: Gain indicator display

- **WHEN** a position or metric shows positive value
- **THEN** the value SHALL be displayed in the gain color (#00C805)

#### Scenario: Loss indicator display

- **WHEN** a position or metric shows negative value
- **THEN** the value SHALL be displayed in the loss color (#FF5252)

#### Scenario: Primary action button

- **WHEN** a primary action button is rendered
- **THEN** the button SHALL use the neon green primary color

### Requirement: Dark Mode Default

The system SHALL default to dark mode for new users and provide a theme toggle in settings.

#### Scenario: New user first visit

- **WHEN** a new user loads the application
- **THEN** the dark theme SHALL be applied automatically

#### Scenario: Theme persistence

- **WHEN** a user changes their theme preference
- **THEN** the preference SHALL be persisted to the database
- **AND** the preference SHALL be applied on subsequent visits

#### Scenario: System theme respect

- **WHEN** a user selects "system" theme preference
- **THEN** the application SHALL follow the operating system's theme setting

### Requirement: Glassmorphism Card Effects

The system SHALL apply glassmorphism effects (backdrop blur, transparency) to card components for a modern appearance.

#### Scenario: Card hover state

- **WHEN** a user hovers over a card component
- **THEN** the card SHALL display a subtle glow effect
- **AND** the card SHALL slightly elevate (shadow/scale)

#### Scenario: Reduced motion preference

- **WHEN** the user has prefers-reduced-motion enabled
- **THEN** glassmorphism effects SHALL remain
- **BUT** animation transitions SHALL be disabled

### Requirement: Value Change Animations

The system SHALL animate value changes with color-coded pulse effects to draw attention to updates.

#### Scenario: Positive value increase

- **WHEN** a displayed value increases
- **THEN** the value SHALL briefly flash green
- **AND** the number SHALL animate from old to new value

#### Scenario: Negative value decrease

- **WHEN** a displayed value decreases
- **THEN** the value SHALL briefly flash red
- **AND** the number SHALL animate from old to new value

### Requirement: Order Confirmation Celebration

The system SHALL display a confetti animation when an order is successfully filled.

#### Scenario: Market order filled

- **WHEN** a market order is filled successfully
- **THEN** the system SHALL display a confetti animation
- **AND** the system SHALL show a success toast notification

#### Scenario: Animation preference off

- **WHEN** a user has disabled animations in preferences
- **THEN** the confetti animation SHALL NOT display
- **BUT** the success toast SHALL still appear

### Requirement: User Theme Preferences

The system SHALL allow users to customize their theme preferences including theme mode, accent color, and animation level.

#### Scenario: Save theme preference

- **WHEN** a user changes a theme setting
- **THEN** the change SHALL be saved to the user_preferences table
- **AND** the UI SHALL update immediately

#### Scenario: Accent color selection

- **WHEN** a user selects a custom accent color
- **THEN** primary buttons and highlights SHALL use the selected color
- **AND** the gain color SHALL remain neon green

### Requirement: Mobile Bottom Navigation

The system SHALL display a floating bottom navigation bar on mobile devices with key actions accessible via thumb.

#### Scenario: Mobile viewport

- **WHEN** the viewport width is less than 768px
- **THEN** a bottom navigation bar SHALL appear
- **AND** the sidebar navigation SHALL be hidden

#### Scenario: Trade action prominence

- **WHEN** the bottom navigation is displayed
- **THEN** the Trade/Create action SHALL be visually prominent (FAB style)

### Requirement: Chart Hero Layout

The system SHALL display portfolio and performance charts in a prominent hero layout with gradient backgrounds.

#### Scenario: Dashboard chart display

- **WHEN** the dashboard page loads
- **THEN** the portfolio chart SHALL span the full container width
- **AND** the chart SHALL have a gradient overlay matching trend direction

#### Scenario: Chart touch interaction

- **WHEN** a user touches/hovers a chart on mobile
- **THEN** a tooltip with detailed values SHALL appear
- **AND** the tooltip SHALL follow the touch/cursor position
