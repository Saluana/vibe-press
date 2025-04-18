// packages/plugins/user-events/server.ts
import { serverHooks } from '../../hooks/hookEngine.server'

serverHooks.addFilter('user.register:before', ({ username }) => {
  if (username === 'forbidden') {
    throw new Error('This username is not allowed.')
  }
})

serverHooks.addFilter('user.register:after', ({ user }) => {
  console.log('User registered:', { id: user.ID, email: user.user_email })
})

serverHooks.addFilter('user.login:error', ({ error }) => {
  console.warn('Login failed:', error.message)
})