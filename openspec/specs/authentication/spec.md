# Authentication Capability

## Purpose

Session-based authentication system with cookie management, password reset functionality, and optional admin token fallback for CI/CD operations.

## Requirements

### Requirement: User Registration

Users SHALL be able to create new accounts with username, password, and email.

#### Scenario: Successful registration

- **WHEN** a user provides unique username, valid password (min 8 chars), and valid email
- **THEN** the system SHALL create a new user account
- **AND** return a session cookie for immediate authentication
- **AND** return HTTP 201 with user ID and username

#### Scenario: Duplicate username

- **WHEN** a user attempts to register with an existing username
- **THEN** the system SHALL reject the request with HTTP 409 Conflict
- **AND** return error message "Username already exists"

#### Scenario: Invalid email format

- **WHEN** a user provides an invalid email address
- **THEN** the system SHALL reject the request with HTTP 400 Bad Request
- **AND** return validation error with field details

### Requirement: User Login

Users SHALL be able to authenticate with username and password to obtain a session.

#### Scenario: Successful login

- **WHEN** a user provides valid credentials
- **THEN** the system SHALL create a new session
- **AND** set an HTTP-only, secure session cookie with 7-day expiration
- **AND** return HTTP 200 with user ID and username

#### Scenario: Invalid credentials

- **WHEN** a user provides incorrect username or password
- **THEN** the system SHALL return HTTP 401 Unauthorized
- **AND** increment failed login counter
- **AND** return error message "Invalid credentials"

#### Scenario: Rate limiting exceeded

- **WHEN** a user attempts more than 5 logins in 15 minutes
- **THEN** the system SHALL return HTTP 429 Too Many Requests
- **AND** include RateLimit-\* headers indicating retry time
- **AND** log the rate limit violation

### Requirement: Session Management

The system SHALL maintain user sessions with secure cookie handling.

#### Scenario: Active session validation

- **WHEN** a request includes a valid session cookie
- **THEN** the system SHALL authenticate the request
- **AND** attach user ID to the request context
- **AND** extend session expiration by 7 days

#### Scenario: Expired session

- **WHEN** a request includes an expired session cookie
- **THEN** the system SHALL reject the request with HTTP 401 Unauthorized
- **AND** clear the session cookie
- **AND** return error message "Session expired"

#### Scenario: Invalid session

- **WHEN** a request includes a non-existent or tampered session cookie
- **THEN** the system SHALL reject the request with HTTP 401 Unauthorized
- **AND** clear the session cookie

### Requirement: User Logout

Users SHALL be able to terminate their session.

#### Scenario: Successful logout

- **WHEN** an authenticated user requests logout
- **THEN** the system SHALL invalidate the session
- **AND** clear the session cookie
- **AND** return HTTP 200 with success message

#### Scenario: Logout without session

- **WHEN** a user without a valid session requests logout
- **THEN** the system SHALL return HTTP 200 (idempotent operation)
- **AND** clear any residual session cookies

### Requirement: Password Reset Request

Users SHALL be able to request a password reset via email.

#### Scenario: Valid password reset request

- **WHEN** a user provides a registered email address
- **THEN** the system SHALL generate a secure reset token
- **AND** store the token with 1-hour expiration
- **AND** send a password reset email with token link
- **AND** return HTTP 200 with generic success message

#### Scenario: Non-existent email

- **WHEN** a user provides an email not in the system
- **THEN** the system SHALL still return HTTP 200 (prevent email enumeration)
- **AND** not send any email
- **AND** log the attempt

#### Scenario: Rate limiting exceeded

- **WHEN** a user requests password reset more than 5 times in 15 minutes
- **THEN** the system SHALL return HTTP 429 Too Many Requests
- **AND** not send any email

### Requirement: Password Reset Completion

Users SHALL be able to reset their password using a valid reset token.

#### Scenario: Successful password reset

- **WHEN** a user provides a valid, unused, non-expired token and new password
- **THEN** the system SHALL hash the new password with bcrypt
- **AND** update the user's password
- **AND** mark the reset token as used
- **AND** invalidate all existing sessions for the user
- **AND** return HTTP 200 with success message

#### Scenario: Expired token

- **WHEN** a user provides a token older than 1 hour
- **THEN** the system SHALL reject the request with HTTP 400 Bad Request
- **AND** return error message "Reset token expired"

#### Scenario: Already used token

- **WHEN** a user provides a token that has already been used
- **THEN** the system SHALL reject the request with HTTP 400 Bad Request
- **AND** return error message "Reset token already used"

#### Scenario: Invalid token

- **WHEN** a user provides a non-existent token
- **THEN** the system SHALL reject the request with HTTP 400 Bad Request
- **AND** return error message "Invalid reset token"

### Requirement: Email Update

Authenticated users SHALL be able to update their email address.

#### Scenario: Successful email update

- **WHEN** an authenticated user provides a valid, unique email
- **THEN** the system SHALL update the user's email address
- **AND** return HTTP 200 with updated user data

#### Scenario: Duplicate email

- **WHEN** a user attempts to change email to one already in use
- **THEN** the system SHALL reject the request with HTTP 409 Conflict
- **AND** return error message "Email already in use"

#### Scenario: Invalid email format

- **WHEN** a user provides an invalid email format
- **THEN** the system SHALL reject the request with HTTP 400 Bad Request
- **AND** return validation error

### Requirement: Admin Token Authentication

The system SHALL support admin token authentication for CI/CD and admin operations.

#### Scenario: Valid admin token

- **WHEN** a request includes X-Admin-Token header matching ADMIN_TOKEN env var
- **THEN** the system SHALL authenticate the request as admin user
- **AND** grant full admin capabilities
- **AND** attach "admin-token-user" ID to request context

#### Scenario: Invalid admin token

- **WHEN** a request includes incorrect X-Admin-Token header
- **THEN** the system SHALL reject the request with HTTP 401 Unauthorized

#### Scenario: Missing admin token

- **WHEN** a request to admin-only endpoint has no session or admin token
- **THEN** the system SHALL reject the request with HTTP 401 Unauthorized

### Requirement: Current User Retrieval

Authenticated users SHALL be able to retrieve their profile information.

#### Scenario: Get current user

- **WHEN** an authenticated user requests /api/auth/me
- **THEN** the system SHALL return user ID, username, and email
- **AND** return HTTP 200

#### Scenario: Unauthenticated request

- **WHEN** a request without valid session queries /api/auth/me
- **THEN** the system SHALL return HTTP 401 Unauthorized

## Security

### Session Cookie Configuration

Cookies MUST be configured with:

- `httpOnly: true` - Prevent JavaScript access
- `secure: true` in production - HTTPS only
- `sameSite: "none"` in production, `"lax"` in development
- `maxAge: 7 days` - Automatic expiration
- `path: "/"` - Application-wide scope

### Password Hashing

Passwords MUST be hashed using bcrypt with default work factor (10 rounds minimum).

### Rate Limiting

The following endpoints MUST enforce rate limiting:

- `/api/auth/signup` - 5 requests per 15 minutes per IP
- `/api/auth/login` - 5 requests per 15 minutes per IP
- `/api/auth/forgot-password` - 5 requests per 15 minutes per IP

### Token Security

Password reset tokens MUST:

- Be cryptographically random (32+ bytes)
- Expire after 1 hour
- Be single-use only
- Be invalidated when password is successfully reset

### Email Enumeration Prevention

Password reset endpoint MUST return identical responses for existing and non-existing emails to prevent user enumeration attacks.

## API Endpoints

| Method | Path                      | Auth Required | Description             |
| ------ | ------------------------- | ------------- | ----------------------- |
| POST   | /api/auth/register        | No            | Create new user account |
| POST   | /api/auth/login           | No            | Authenticate user       |
| POST   | /api/auth/logout          | Yes           | Terminate session       |
| GET    | /api/auth/me              | Yes           | Get current user info   |
| POST   | /api/auth/forgot-password | No            | Request password reset  |
| POST   | /api/auth/reset-password  | No            | Complete password reset |
| POST   | /api/auth/update-email    | Yes           | Update user email       |

## Database Schema

### users table

- `id` (varchar, primary key) - Unique user identifier
- `username` (varchar, unique, not null) - Login username
- `password_hash` (text, not null) - Bcrypt hashed password
- `email` (varchar, nullable) - User email address
- `created_at` (timestamp, not null) - Account creation timestamp

### passwordResetTokens table

- `id` (varchar, primary key) - Token identifier
- `user_id` (varchar, foreign key → users.id) - User requesting reset
- `token` (varchar, unique, not null) - Secure reset token
- `expires_at` (timestamp, not null) - Token expiration time
- `used` (boolean, default false) - Whether token has been consumed
- `created_at` (timestamp, not null) - Token creation time

## Error Handling

All authentication endpoints MUST use standardized error responses:

**400 Bad Request**: Invalid request format or validation errors
**401 Unauthorized**: Invalid credentials or missing authentication
**409 Conflict**: Resource already exists (username, email)
**429 Too Many Requests**: Rate limit exceeded

Error response format:

```json
{
  "error": "ErrorType",
  "message": "Human-readable description",
  "statusCode": 400,
  "details": [{ "field": "email", "message": "Invalid email format" }]
}
```

## Dependencies

- `bcrypt` - Password hashing
- `express-rate-limit` - Rate limiting middleware
- `@sendgrid/mail` - Password reset emails (optional)
- Redis or in-memory - Session storage

## Files

**Routes**: `server/routes/auth.ts`
**Middleware**: `server/middleware/auth.ts`, `server/middleware/requireAuth.ts`
**Schema**: `shared/schema/auth.ts`
**Validation**: `server/validation/api-schemas.ts`
**Email**: `server/lib/email-service.ts`
