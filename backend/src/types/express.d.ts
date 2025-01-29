import { CorsOptions } from 'cors';

declare namespace Express {
  interface Request {
    user?: {
      uid: string;
      email: string;
      isAdmin: boolean;
    };
  }
}

declare module 'cors' {
  interface CorsOptions {
    origin?: boolean | string | RegExp | (string | RegExp)[] | ((origin: string | undefined, callback: (err: Error | null, origin?: boolean | string | RegExp | (string | RegExp)[]) => void) => void);
  }
}

export {}; 