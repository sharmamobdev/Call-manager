import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  host: process.env.HOST || "0.0.0.0",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-dialclear-jwt-key-2024",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "24h",

  signalwire: {
    projectId: process.env.SIGNALWIRE_PROJECT_ID || "",
    token: process.env.SIGNALWIRE_TOKEN || "",
    spaceUrl: process.env.SIGNALWIRE_SPACE_URL || "",
  },

  freeswitch: {
    host: process.env.FS_HOST || "localhost",
    port: parseInt(process.env.FS_PORT || "8021", 10),
    password: process.env.FS_PASSWORD || "ClueCon",
  },

  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
};
