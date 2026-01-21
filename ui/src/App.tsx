import { useState, useEffect, createContext, useContext, ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom'
import { Activity, Key, Bell, LogOut, Menu, X, LayoutDashboard } from 'lucide-react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Keys from './pages/Keys'
import Events from './pages/Events'
import Alerts from './pages/Alerts'

// Auth Context
interface AuthContextType {
  token: string | null
  login: (token: string) => void
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => 
    localStorage.getItem('auditflow_token')
  )

  const login = (newToken: string) => {
    localStorage.setItem('auditflow_token', newToken)
    setToken(newToken)
  }

  const logout = () => {
    localStorage.removeItem('auditflow_token')
    setToken(null)
  }

  return (
    <AuthContext.Provider value={{ token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

// Protected Route
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  
  return <>{children}</>
}

// Navigation
function Navigation() {
  const { logout, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  if (!isAuthenticated) return null

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/events', label: 'Events', icon: Activity },
    { path: '/keys', label: 'API Keys', icon: Key },
    { path: '/alerts', label: 'Alerts', icon: Bell },
  ]

  const isActive = (path: string) => location.pathname === path

  return (
    <nav style={{
      backgroundColor: '#1f2937',
      color: 'white',
      padding: '0 1rem',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: '64px',
      }}>
        <Link to="/dashboard" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          color: 'white',
          textDecoration: 'none',
          fontWeight: 'bold',
          fontSize: '1.25rem',
        }}>
          <Activity size={28} />
          AuditFlow
        </Link>

        {/* Desktop Navigation */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }} className="desktop-nav">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                color: isActive(path) ? 'white' : '#9ca3af',
                backgroundColor: isActive(path) ? '#374151' : 'transparent',
                textDecoration: 'none',
                fontSize: '0.875rem',
                transition: 'all 0.2s',
              }}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: 'none',
              backgroundColor: '#dc2626',
              color: 'white',
              fontSize: '0.875rem',
            }}
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            display: 'none',
            padding: '0.5rem',
            backgroundColor: 'transparent',
            border: 'none',
            color: 'white',
          }}
          className="mobile-menu-btn"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div style={{
          padding: '1rem',
          borderTop: '1px solid #374151',
        }} className="mobile-menu">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              onClick={() => setMobileMenuOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem',
                borderRadius: '0.375rem',
                color: isActive(path) ? 'white' : '#9ca3af',
                backgroundColor: isActive(path) ? '#374151' : 'transparent',
                textDecoration: 'none',
              }}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem',
              width: '100%',
              borderRadius: '0.375rem',
              border: 'none',
              backgroundColor: '#dc2626',
              color: 'white',
              marginTop: '0.5rem',
            }}
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: block !important; }
        }
        @media (min-width: 769px) {
          .mobile-menu { display: none !important; }
        }
      `}</style>
    </nav>
  )
}

// Main Layout
function Layout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
      <Navigation />
      <main style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '1.5rem',
      }}>
        {children}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Layout><Dashboard /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/events" element={
            <ProtectedRoute>
              <Layout><Events /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/keys" element={
            <ProtectedRoute>
              <Layout><Keys /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/alerts" element={
            <ProtectedRoute>
              <Layout><Alerts /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
