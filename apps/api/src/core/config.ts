// src/core/config.ts
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env file

export const BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';
