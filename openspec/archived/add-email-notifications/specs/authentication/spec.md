# Authentication Spec Deltas

## MODIFIED Requirements

### Requirement: User Registration

Users SHALL be able to create new accounts with username, password, and **email address (required)**.

#### Scenario: Successful registration

- **WHEN** a user provides unique username, valid password (min 8 chars), and **valid email address**
- **THEN** the system SHALL create a new user account
- **AND** return a session cookie for immediate authentication
- **AND** return HTTP 201 with user ID, username, **and email**

#### Scenario: Duplicate username

- **WHEN** a user attempts to register with an existing username
- **THEN** the system SHALL reject the request with HTTP 409 Conflict
- **AND** return error message "Username already exists"

#### Scenario: Invalid email format

- **WHEN** a user provides an invalid email address
- **THEN** the system SHALL reject the request with HTTP 400 Bad Request
- **AND** return validation error with field details

#### Scenario: Missing email

- **WHEN** a user attempts to register without providing an email
- **THEN** the system SHALL reject the request with HTTP 400 Bad Request
- **AND** return validation error "Email is required"

### Requirement: Current User Retrieval

Authenticated users SHALL be able to retrieve their profile information **including email address**.

#### Scenario: Get current user

- **WHEN** an authenticated user requests /api/auth/me
- **THEN** the system SHALL return user ID, username, **and email**
- **AND** return HTTP 200

#### Scenario: Unauthenticated request

- **WHEN** a request without valid session queries /api/auth/me
- **THEN** the system SHALL return HTTP 401 Unauthorized

## Database Schema Changes

### users table - MODIFIED

- `id` (varchar, primary key) - Unique user identifier
- `username` (varchar, unique, not null) - Login username
- `password_hash` (text, not null) - Bcrypt hashed password
- **`email` (varchar, not null) - User email address** ← **CHANGED from nullable**
- `created_at` (timestamp, not null) - Account creation timestamp

**Migration Required**: Existing users with null emails must be backfilled before applying this constraint.

## API Endpoint Changes

### POST /api/auth/register - MODIFIED

**Request Body** (updated):

```json
{
  "username": "string (required)",
  "password": "string (required, min 8 chars)",
  "email": "string (required, RFC 5322 format)"
}
```

**Response 201** (updated):

```json
{
  "id": "uuid",
  "username": "string",
  "email": "string"
}
```

### GET /api/auth/me - MODIFIED

**Response 200** (updated):

```json
{
  "id": "uuid",
  "username": "string",
  "email": "string"
}
```

## Breaking Changes

**BREAKING**: Email is now required during user registration. API consumers must update their registration requests to include email field.

**Migration Path**:

1. Update API clients to send email during registration
2. Run database migration to backfill existing users
3. Deploy updated authentication endpoints
4. Verify all users have emails

## Validation Rules

Email validation SHALL enforce:

- RFC 5322 format compliance
- Maximum length: 255 characters
- No duplicate emails allowed (unique constraint)
- Normalized to lowercase for storage
