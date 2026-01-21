import { useState, FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Activity, Mail, Lock, AlertCircle } from 'lucide-react'
import { useAuth } from '../App'
import { authApi } from '../api'

export default function Login() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isLogin) {
        const { data } = await authApi.login(email, password)
        login(data.access_token)
        navigate(from, { replace: true })
      } else {
        await authApi.register(email, password)
        const { data } = await authApi.login(email, password)
        login(data.access_token)
        navigate(from, { replace: true })
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      setError(error.response?.data?.detail || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '0.75rem 1rem 0.75rem 2.5rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.5rem',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  }

  const buttonStyle = {
    width: '100%',
    padding: '0.75rem 1rem',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '1rem',
    fontWeight: '600' as const,
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.7 : 1,
    transition: 'background-color 0.2s',
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f3f4f6',
      padding: '1rem',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        backgroundColor: 'white',
        borderRadius: '1rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        padding: '2rem',
      }}>
        {/* Logo */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          marginBottom: '2rem',
        }}>
          <Activity size={36} color="#2563eb" />
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' }}>
            AuditFlow
          </span>
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: '600',
          textAlign: 'center',
          marginBottom: '0.5rem',
          color: '#1f2937',
        }}>
          {isLogin ? 'Welcome back' : 'Create account'}
        </h1>
        <p style={{
          textAlign: 'center',
          color: '#6b7280',
          marginBottom: '1.5rem',
        }}>
          {isLogin ? 'Sign in to your account' : 'Get started with AuditFlow'}
        </p>

        {/* Error Message */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '0.5rem',
            color: '#dc2626',
            marginBottom: '1rem',
          }}>
            <AlertCircle size={18} />
            <span style={{ fontSize: '0.875rem' }}>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem', position: 'relative' }}>
            <Mail
              size={18}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9ca3af',
              }}
            />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
            <Lock
              size={18}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9ca3af',
              }}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={buttonStyle}
          >
            {loading ? 'Please wait...' : (isLogin ? 'Sign in' : 'Create account')}
          </button>
        </form>

        {/* Toggle */}
        <p style={{
          textAlign: 'center',
          marginTop: '1.5rem',
          color: '#6b7280',
        }}>
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => {
              setIsLogin(!isLogin)
              setError('')
            }}
            style={{
              color: '#2563eb',
              fontWeight: '600',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
            }}
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
