import { Component } from 'react'

import styles from './ErrorBoundary.module.css'

export class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Необработанная ошибка интерфейса:', error, info)
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      return this.props.fallback ? (
        this.props.fallback(this.state.error, this.reset)
      ) : (
        <DefaultFallback error={this.state.error} onReset={this.reset} />
      )
    }
    return this.props.children
  }
}

function DefaultFallback({ error, onReset }) {
  return (
    <section className={styles.errorBoundary}>
      <span>⚠</span>
      <h2>Что-то пошло не так</h2>
      <p>
        Произошла непредвиденная ошибка в интерфейсе. Данные на сервере не
        пострадали — попробуйте открыть раздел заново.
      </p>
      {import.meta.env.DEV && (
        <pre className={styles.errorBoundaryDetail}>{String(error?.stack || error)}</pre>
      )}
      <div className={styles.errorBoundaryActions}>
        <button className="primary-button" onClick={onReset}>
          Попробовать снова
        </button>
        <button className="secondary-button" onClick={() => window.location.reload()}>
          Перезагрузить страницу
        </button>
      </div>
    </section>
  )
}
