# Backend Architecture

This document describes the refactored backend architecture for the live-crawler application.

## Directory Structure

```
src/
├── config/           # Configuration management
├── controllers/      # HTTP request handlers
├── services/         # Business logic services
├── routes/           # API route definitions
├── types/           # TypeScript interfaces and types
├── utils/           # Utility functions
├── models/          # Data models (existing files)
├── app.ts           # Express app factory
└── index.ts         # Application entry point
```

## Architecture Overview

The refactored backend follows a layered architecture pattern with clear separation of concerns:

### 1. Configuration Layer (`config/`)
- Centralizes all application configuration
- Environment-specific settings
- Type-safe configuration objects

### 2. Controller Layer (`controllers/`)
- Handles HTTP requests and responses
- Input validation and error handling
- Delegates business logic to services

### 3. Service Layer (`services/`)
- Contains business logic
- Manages external dependencies (Streamr client)
- Orchestrates data processing operations

### 4. Route Layer (`routes/`)
- Defines API endpoints
- Maps HTTP routes to controller methods
- Middleware configuration

### 5. Utility Layer (`utils/`)
- Reusable utility functions
- Input validation helpers
- Common operations

### 6. Types Layer (`types/`)
- TypeScript interfaces and types
- Shared data structures
- API contract definitions

## Key Components

### StreamrService
Manages the Streamr client lifecycle and provides network node access.

### TopologyService
Handles topology crawling and data processing operations.

### TopologyController
Processes HTTP requests for topology endpoints with proper error handling.

## Benefits of Refactoring

1. **Separation of Concerns**: Each layer has a specific responsibility
2. **Testability**: Services and controllers can be easily unit tested
3. **Maintainability**: Code is organized and easier to understand
4. **Scalability**: New features can be added without affecting existing code
5. **Error Handling**: Centralized and consistent error handling
6. **Type Safety**: Strong TypeScript typing throughout the application
7. **Dependency Injection**: Services are injected, making the code more flexible

## API Endpoints

### GET /topology
Retrieves network topology for a given stream.

**Query Parameters:**
- `streamId` (required): The stream identifier
- `partition` (optional): The partition number (defaults to 0)

**Response:**
Returns an array of topology nodes with their neighbors and RTT information.

### GET /health
Health check endpoint that returns the application status.

## Error Handling

The application uses a centralized error handling approach:
- Custom `ValidationError` for input validation errors
- Proper HTTP status codes
- Structured error logging
- Graceful error responses

## Graceful Shutdown

The application implements graceful shutdown handling:
- Listens for SIGTERM and SIGINT signals
- Properly closes the Streamr client
- Ensures all resources are cleaned up