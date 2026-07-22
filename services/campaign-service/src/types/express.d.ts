import { JwtPayload } from '../middleware/requireAuth.js';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export {};
