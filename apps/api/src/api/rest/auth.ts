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
    serverHooks.doAction('user.register:before', { username, email, display_name });

    const user = await createUser({
      user_login: username,
      user_email: email,
      user_pass: password,
      display_name: display_name || username,
    });

    const token = signJwt(user.ID);

    serverHooks.doAction('user.register:after', { user, token });

    res.status(201).json({
      token,
      user: {
        id: user.ID,
        username: user.user_login,
        email: user.user_email,
        display_name: user.display_name,
      },
    });
  } catch (e: any) {
    // Log the full error object for debugging
    console.error('Registration error:', JSON.stringify(e, Object.getOwnPropertyNames(e)));
  
    // Try to find the code property in different places
    const code = e.code || (e.originalError && e.originalError.code);
  
    if (code === '23505') {
      // Unique constraint violation (username or email already exists)
      return res.status(409).json(wpError('23505', 'A user with that email or username already exists.'));
    }

    serverHooks.doAction('user.register:error', { error: e });
    res.status(500).json(wpError('500', 'Failed to register user'));
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
    serverHooks.doAction('user.login:before', { username });
    const { user, token } = await authenticateUsernamePassword(username, password);
    serverHooks.doAction('user.login:after', { user, token });

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
    serverHooks.doAction('user.login:error', { error: e });
    res.status(500).json(wpError('500', 'Failed to login'));
  }
});


export default router;
