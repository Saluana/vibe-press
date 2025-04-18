// logger.ts
import pino from 'pino';

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      translateTime: 'yyyy-mm-dd HH:MM:ss o',
      ignore: 'pid,hostname',
    },
  },
});

export default logger;