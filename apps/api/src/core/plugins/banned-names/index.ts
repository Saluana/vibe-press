// packages/plugins/user-events/server.ts
import { serverHooks } from '../../hooks/hookEngine.server'

serverHooks.addAction('svc.user.create:action:before', (_unused, payload) => {
  console.log('User registration:', payload)
  if (payload?.user_login === 'forbidden') {
    throw new Error('This username is not allowed.')
  }
}, 10, 2);

serverHooks.addAction('svc.user.create:action:after', (_unused, payload) => {
  if (payload?.user) {
    console.log('User registered:', { id: payload.user.ID, email: payload.user.user_email });
  }
  return {...payload, haha: true};
});

serverHooks.addFilter('svc.user.create:filter:result', (payload) => {
  if (payload?.user) {
    console.log('User registered:', { id: payload.user.ID, email: payload.user.user_email });
  }
  return {...payload, haha: true};
});

serverHooks.addAction('rest.user.login:action:error', (_unused, payload) => {
  if (payload?.error) {
    console.warn('Login failed:', payload.error.message);
  }
});