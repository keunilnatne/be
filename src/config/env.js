require('dotenv').config();

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    name: process.env.DB_NAME || 'project_q',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  ai: {
    apiUrl: process.env.AI_API_URL,
    apiKey: process.env.AI_API_KEY,
    model: process.env.AI_MODEL || 'gpt-4o-mini',
  },

    clientId: (process.env.GOOGLE_CLIENT_ID || '').trim(),
    clientSecret: (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
    redirectUri: (process.env.GOOGLE_REDIRECT_URI || '').trim(),
    tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY,
    frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  },
};
