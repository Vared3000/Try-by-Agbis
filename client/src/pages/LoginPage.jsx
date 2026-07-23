import { useState } from 'react'

import { useAuth } from '../app/auth-context.js'

export function LoginPage() {
  const auth = useAuth()
  const [email, setEmail] = useState('owner@example.invalid')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await auth.signIn({ email, password })
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          'Не удалось подключиться к серверу',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand">
        <span className="logo-mark">CF</span>
        <p className="eyebrow">CleanFlow ERP</p>
        <h1>Весь процесс химчистки — в одном рабочем пространстве</h1>
        <p>Приёмка, производство, касса и выдача без разрывов между этапами.</p>
      </section>
      <form className="login-card" onSubmit={submit}>
        <div>
          <p className="eyebrow">Вход в систему</p>
          <h2>С возвращением</h2>
        </div>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Пароль
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" disabled={busy}>
          {busy ? 'Входим…' : 'Войти'}
        </button>
      </form>
    </main>
  )
}
