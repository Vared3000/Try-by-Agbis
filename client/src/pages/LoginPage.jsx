import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { useAuth } from '../app/auth-context.js'
import styles from './LoginPage.module.css'

const loginSchema = z.object({
  email: z.string().min(1, 'Введите email').email('Некорректный email'),
  password: z.string().min(1, 'Введите пароль'),
})

export function LoginPage() {
  const auth = useAuth()
  const [error, setError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: 'owner@example.invalid', password: '' },
  })

  const submit = handleSubmit(async (values) => {
    setError('')
    try {
      await auth.signIn(values)
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          'Не удалось подключиться к серверу',
      )
    }
  })

  return (
    <main className={styles.loginPage}>
      <section className={styles.loginBrand}>
        <span className="logo-mark">CF</span>
        <p className="eyebrow">CleanFlow ERP</p>
        <h1>Весь процесс химчистки — в одном рабочем пространстве</h1>
        <p>Приёмка, производство, касса и выдача без разрывов между этапами.</p>
      </section>
      <form className={styles.loginCard} onSubmit={submit}>
        <div>
          <p className="eyebrow">Вход в систему</p>
          <h2>С возвращением</h2>
        </div>
        <label>
          Email
          <input type="email" autoComplete="username" {...register('email')} />
          {errors.email && <small className="field-error">{errors.email.message}</small>}
        </label>
        <label>
          Пароль
          <input
            type="password"
            autoComplete="current-password"
            {...register('password')}
          />
          {errors.password && (
            <small className="field-error">{errors.password.message}</small>
          )}
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" disabled={isSubmitting}>
          {isSubmitting ? 'Входим…' : 'Войти'}
        </button>
      </form>
    </main>
  )
}
