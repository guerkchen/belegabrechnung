// Entry point for Azure Functions v4 Node.js programming model.
// Fail fast if required environment variables are missing.
import './src/utils/config.js';

// Import routes to register all HTTP endpoints.
import './src/routes.js';
