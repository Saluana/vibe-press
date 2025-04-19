// src/api/rest/auth.ts
import { Router, Request, Response } from 'express';
import { createUser } from '@vp/core/services/user/user.services';
import { signJwt, authenticateUsernamePassword } from '@vp/core/services/auth.services';
import { wpError } from '@vp/core/utils/wpError';
import { serverHooks } from '@vp/core/hooks/hookEngine.server';
import {z} from 'zod';

const router = Router();

// Validation schemas
const RegisterValidation = z.object({
  username: z.string().max(60),
  email: z.string().email(),
  password: z.string().min(6).max(255),
  display_name: z.string().optional()
}).strip();

const LoginValidation = z.object({
  username: z.string().max(60),
  password: z.string().min(6).max(255)
}).strip();

// @ts-expect-error
router.post('/register', async (req: Request, res: Response) => {
  const { username, email, password, display_name } = req.body;

  const result = RegisterValidation.safeParse({
    username,
    email,
    password,
    display_name
  });

  if (!result.success) {
    return res.status(400).json(wpError('400', 'Validation failed', 400, { details: result.error }));
  }

  try {
    const user = await createUser({
      user_login: username,
      user_email: email,
      user_pass: password,
      display_name: display_name || username,
    });

    console.log('DEBUG [auth]: Received user from createUser:', JSON.stringify(user));

    if (!user || typeof user.ID === 'undefined') {
      console.error('ERROR [auth]: Invalid user object received from createUser:', JSON.stringify(user));
      throw new Error(`Invalid user object received after creation: ${JSON.stringify(user)}`);
    }

    const token = signJwt(user.ID);

    res.status(201).json({
      token,
      user: {
        id: user.ID,
        username: user.user_login,
        email: user.user_email,
        display_name: user.display_name,
      },
    });
    console.log('DEBUG [auth]: Successfully sent 201 response.');
  } catch (e: any) {
    console.error('ERROR [auth] caught in /register:', e);
    const code = e.code || (e.originalError && e.originalError.code);
    let message = 'Registration failed';
    let status = 500;
    const codeStr = String(code);

    if (codeStr === '23505') { 
      message = 'Username or email already exists.';
      status = 409; 
    } else if (e instanceof Error && e.message?.startsWith("Invalid user object received")) {
      message = e.message;
      status = 500; 
    } else {
      message = e.message || 'An unknown error occurred during registration.';
      status = e.status || 500;
    }

    if (!res.headersSent) {
      res.status(status).json(wpError(codeStr || String(status), message, status));
    } else {
      console.error('ERROR [auth]: Attempted to send error response after headers were already sent.');
    }
  }
});

// @ts-expect-error
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;

  const result = LoginValidation.safeParse({
    username,
    password
  });

  if (!result.success) {
    return res.status(400).json(wpError('400', 'Validation failed', 400, { details: result.error }));
  }

  try {
    const { user, token } = await authenticateUsernamePassword(username, password);

    res.status(200).json({
      token,
      user: {
        id: user.ID,
        username: user.user_login,
        email: user.user_email,
        display_name: user.display_name,
      },
    });
  } catch (e: any) {
    await serverHooks.doAction('rest.user.login:action:error', { error: e });
    res.status(500).json(wpError('500', 'Failed to login'));
  }
});


export default router;
