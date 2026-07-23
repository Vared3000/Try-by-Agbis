import { useEffect, useMemo, useState } from 'react'

import {
  getCurrentUser,
  login,
  logout,
  refreshSession,
  setAccessToken,
} from '../api/client.js'
import { LoginPage } from '../pages/LoginPage.jsx'
import { WorkspacePage } from '../pages/WorkspacePage.jsx'
import { AuthContext } from './auth-context.js'

export function App() {
  const [state, setState] = useState({ status: 'loading', user: null })

  useEffect(() => {
    let active = true
    refreshSession()
      .then(() => getCurrentUser())
      .then((user) => active && setState({ status: 'ready', user }))
      .catch(() => active && setState({ status: 'anonymous', user: null }))
    return () => {
      active = false
    }
  }, [])

  const auth = useMemo(
    () => ({
      ...state,
      async signIn(credentials) {
        const result = await login(credentials)
        const user = await getCurrentUser()
        setState({ status: 'ready', user: { ...result.user, ...user } })
      },
      async signOut() {
        try {
          await logout()
        } finally {
          setAccessToken(null)
          setState({ status: 'anonymous', user: null })
        }
      },
    }),
    [state],
  )

  if (state.status === 'loading') {
    return <div className="app-loading">Загружаем CleanFlow…</div>
  }

  return (
    <AuthContext.Provider value={auth}>
      {state.status === 'ready' ? <WorkspacePage /> : <LoginPage />}
    </AuthContext.Provider>
  )
}
