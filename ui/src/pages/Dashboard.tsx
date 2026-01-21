import { useState, useEffect } from 'react'
import { Activity, Bell, Key, TrendingUp, AlertTriangle, Clock } from 'lucide-react'
import { eventsApi, alertsApi, keysApi, EventStats, AlertStats } from '../api'

interface StatCardProps {
  title: string
  value: number | string
  icon: React.ReactNode
  color: string
  subtext?: string
}

function StatCard({ title, value, icon, color, subtext }: StatCardProps) {
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '0.75rem',
      padding: '1.5rem',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.25rem' }}>{title}</p>
          <p style={{ fontSize: '2rem', fontWeight: '700', color: '#1f2937' }}>{value}</p>
          {subtext && (
            <p style={{ color: '#9ca3af', fontSize: '0.75rem', marginTop: '0.25rem' }}>{subtext}</p>
          )}
        </div>
        <div style={{
          padding: '0.75rem',
          backgroundColor: `${color}15`,
          borderRadius: '0.5rem',
        }}>
          {icon}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [eventStats, setEventStats] = useState<EventStats | null>(null)
  const [alertStats, setAlertStats] = useState<AlertStats | null>(null)
  const [keyCount, setKeyCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const [eventsRes, alertsRes, keysRes] = await Promise.all([
        eventsApi.stats(),
        alertsApi.stats(),
        keysApi.list(),
      ])
      setEventStats(eventsRes.data)
      setAlertStats(alertsRes.data)
      setKeyCount(keysRes.data.total)
    } catch (err) {
      console.error('Failed to load stats:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <div style={{ color: '#6b7280' }}>Loading dashboard...</div>
      </div>
    )
  }

  const severityColors: Record<string, string> = {
    debug: '#6b7280',
    info: '#3b82f6',
    warning: '#f59e0b',
    error: '#ef4444',
    critical: '#7c3aed',
  }

  const levelColors: Record<string, string> = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#ef4444',
    critical: '#7c3aed',
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.875rem', fontWeight: '700', marginBottom: '1.5rem', color: '#1f2937' }}>
        Dashboard
      </h1>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        <StatCard
          title="Total Events"
          value={eventStats?.total_events || 0}
          icon={<Activity size={24} color="#3b82f6" />}
          color="#3b82f6"
          subtext={`${eventStats?.events_today || 0} today`}
        />
        <StatCard
          title="Open Alerts"
          value={alertStats?.open_alerts || 0}
          icon={<Bell size={24} color="#ef4444" />}
          color="#ef4444"
          subtext={`${alertStats?.total_alerts || 0} total`}
        />
        <StatCard
          title="Active API Keys"
          value={keyCount}
          icon={<Key size={24} color="#10b981" />}
          color="#10b981"
        />
        <StatCard
          title="Events This Week"
          value={eventStats?.events_this_week || 0}
          icon={<TrendingUp size={24} color="#8b5cf6" />}
          color="#8b5cf6"
        />
      </div>

      {/* Charts Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        {/* Events by Type */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#1f2937' }}>
            Events by Type
          </h2>
          {eventStats?.events_by_type && Object.keys(eventStats.events_by_type).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Object.entries(eventStats.events_by_type).map(([type, count]) => (
                <div key={type}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.875rem', color: '#4b5563' }}>{type}</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1f2937' }}>{count}</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${(count / eventStats.total_events) * 100}%`,
                      backgroundColor: '#3b82f6',
                      borderRadius: '4px',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>No events yet</p>
          )}
        </div>

        {/* Events by Severity */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#1f2937' }}>
            Events by Severity
          </h2>
          {eventStats?.events_by_severity && Object.keys(eventStats.events_by_severity).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Object.entries(eventStats.events_by_severity).map(([severity, count]) => (
                <div key={severity}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{
                      fontSize: '0.875rem',
                      color: severityColors[severity] || '#4b5563',
                      fontWeight: '500',
                    }}>
                      {severity.charAt(0).toUpperCase() + severity.slice(1)}
                    </span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1f2937' }}>{count}</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${(count / eventStats.total_events) * 100}%`,
                      backgroundColor: severityColors[severity] || '#3b82f6',
                      borderRadius: '4px',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>No events yet</p>
          )}
        </div>
      </div>

      {/* Alerts Summary */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#1f2937' }}>
          Alerts Summary
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '1rem',
        }}>
          <div style={{
            padding: '1rem',
            backgroundColor: '#fef3c7',
            borderRadius: '0.5rem',
            textAlign: 'center',
          }}>
            <AlertTriangle size={24} color="#f59e0b" style={{ margin: '0 auto 0.5rem' }} />
            <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#92400e' }}>
              {alertStats?.open_alerts || 0}
            </p>
            <p style={{ fontSize: '0.75rem', color: '#92400e' }}>Open</p>
          </div>
          <div style={{
            padding: '1rem',
            backgroundColor: '#dbeafe',
            borderRadius: '0.5rem',
            textAlign: 'center',
          }}>
            <Clock size={24} color="#3b82f6" style={{ margin: '0 auto 0.5rem' }} />
            <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e40af' }}>
              {alertStats?.acknowledged_alerts || 0}
            </p>
            <p style={{ fontSize: '0.75rem', color: '#1e40af' }}>Acknowledged</p>
          </div>
          <div style={{
            padding: '1rem',
            backgroundColor: '#d1fae5',
            borderRadius: '0.5rem',
            textAlign: 'center',
          }}>
            <Activity size={24} color="#10b981" style={{ margin: '0 auto 0.5rem' }} />
            <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#065f46' }}>
              {alertStats?.resolved_alerts || 0}
            </p>
            <p style={{ fontSize: '0.75rem', color: '#065f46' }}>Resolved</p>
          </div>
        </div>

        {alertStats?.alerts_by_level && Object.keys(alertStats.alerts_by_level).length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.75rem', color: '#4b5563' }}>
              By Severity Level
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {Object.entries(alertStats.alerts_by_level).map(([level, count]) => (
                <span key={level} style={{
                  padding: '0.25rem 0.75rem',
                  backgroundColor: `${levelColors[level]}20`,
                  color: levelColors[level],
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                }}>
                  {level.charAt(0).toUpperCase() + level.slice(1)}: {count}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
