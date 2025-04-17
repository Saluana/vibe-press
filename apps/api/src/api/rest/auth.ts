// src/api/rest/auth.ts
import { Router, Request, Response } from 'express';
import { createUser } from '../../core/services/user.services';
import { signJwt, loginUser } from '../../core/services/auth.services';
import { type } from 'arktype';

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
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: result.summary 
    });
  }

  try {
    const user = await createUser({
      user_login: username,
      user_email: email,
      user_pass: password,
      display_name: display_name || username,
    });

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
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to register user' });
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
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: result.summary 
    });
  }

  try {
    const { user, token } = await loginUser(username, password);

    res.status(200).json({
      token,
      user: {
        id: user.ID,
        username: user.user_login,
        email: user.user_email,
        display_name: user.display_name,
      },
    });
  } catch (e) {
    console.error(e);
    // Don't expose whether the user exists or password is wrong
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

export default router;
