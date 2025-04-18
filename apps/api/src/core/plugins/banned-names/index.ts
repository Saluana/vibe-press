// packages/plugins/user-events/server.ts
import { serverHooks } from '../../hooks/hookEngine.server'

serverHooks.addFilter('user.register:before', (_unused, payload) => {
  console.log('User registration:', payload)
  if (payload?.username === 'forbidden') {
    throw new Error('This username is not allowed.')
  }
}, 10, 2);

serverHooks.addFilter('user.register:after', (_unused, payload) => {
  if (payload?.user) {
    console.log('User registered:', { id: payload.user.ID, email: payload.user.user_email });
  }
});

serverHooks.addFilter('user.login:error', (_unused, payload) => {
  if (payload?.error) {
    console.warn('Login failed:', payload.error.message);
  }
});