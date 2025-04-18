// src/api/rest/auth.ts
import { Router, Request, Response } from 'express';
import { createUser } from '../../core/services/user/user.services';
import { signJwt, authenticateUsernamePassword } from '../../core/services/auth.services';
import { type } from 'arktype';
import { wpError } from '../../core/utils/wpError';
import { serverHooks } from '../../core/hooks/hookEngine.server';

const router = Router();

// Validation schemas
const RegisterValidation = type({
  username: "string",
  email: "string",
  password: "string",
  display_name: "string?"
});

const LoginValidation = type({
  username: "string",
  password: "string"
});

// @ts-expect-error
router.post('/register', async (req: Request, res: Response) => {
  const { username, email, password, display_name } = req.body;

  const result = RegisterValidation({
    username,
    email,
    password,
    display_name
  });

  if (result instanceof type.errors) {
    return res.status(400).json(wpError('400', 'Validation failed', 400, { details: result.summary }));
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

  const result = LoginValidation({
    username,
    password
  });

  if (result instanceof type.errors) {
    return res.status(400).json(wpError('400', 'Validation failed', 400, { details: result.summary }));
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
    await serverHooks.doAction('user.login:error', { error: e });
    res.status(500).json(wpError('500', 'Failed to login'));
  }
});


export default router;
