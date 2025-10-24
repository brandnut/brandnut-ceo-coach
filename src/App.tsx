import { useState } from 'react'
import Chat from './Chat'
import Test from './Test'
import './styles.css'

const USERS: Record<string, { password: string; userId: string }> = {
  alice: { password: 'pass123', userId: 'user_alice' },
  bob: { password: 'pass456', userId: 'user_bob' },
  admin: { password: 'admin123', userId: 'user_admin' },
}

export default function App() {
  const [user, setUser] = useState<{ username: string; userId: string } | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [page, setPage] = useState<'login' | 'chat' | 'test'>('login')

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    const userData = USERS[username]
    if (userData && userData.password === password) {
      setUser({ username, userId: userData.userId })
      setError('')
      setPage('chat')
    } else {
      setError('Invalid credentials')
    }
  }

  if (page === 'test') {
    return (
      <div>
        <button
          onClick={() => setPage('login')}
          className="fixed top-4 right-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700"
        >
          Back to Login
        </button>
        <Test />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h1>Dify Chat</h1>
          <form onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
            {error && <div className="error">{error}</div>}
            <button type="submit" className="button">Login</button>
          </form>
          <div className="hint">Try: alice/pass123, bob/pass456, admin/admin123</div>
          <button
            type="button"
            onClick={() => setPage('test')}
            className="button"
            style={{ marginTop: '1rem', background: '#667eea' }}
          >
            View Test Page
          </button>
        </div>
      </div>
    )
  }

  return <Chat userId={user.userId} username={user.username} onLogout={() => setUser(null)} />
}
