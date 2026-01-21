import { useState, useEffect } from 'react'
import { Plus, Copy, Trash2, RefreshCw, Check, Key, AlertCircle } from 'lucide-react'
import { keysApi, ApiKey } from '../api'
import { format } from 'date-fns'

export default function Keys() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyDesc, setNewKeyDesc] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadKeys()
  }, [])

  const loadKeys = async () => {
    try {
      const { data } = await keysApi.list(true)
      setKeys(data.items)
    } catch (err) {
      setError('Failed to load API keys')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newKeyName.trim()) return
    
    try {
      const { data } = await keysApi.create(newKeyName, newKeyDesc || undefined)
      setCreatedKey(data.key || null)
      setKeys([data, ...keys])
      setNewKeyName('')
      setNewKeyDesc('')
    } catch (err) {
      setError('Failed to create API key')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this API key?')) return
    
    try {
      await keysApi.delete(id)
      setKeys(keys.filter(k => k.id !== id))
    } catch (err) {
      setError('Failed to delete API key')
    }
  }

  const handleRegenerate = async (id: string) => {
    if (!confirm('This will invalidate the old key immediately. Continue?')) return
    
    try {
      const { data } = await keysApi.regenerate(id)
      setCreatedKey(data.key || null)
      setKeys(keys.map(k => k.id === id ? data : k))
    } catch (err) {
      setError('Failed to regenerate API key')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const buttonStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    borderRadius: '0.5rem',
    border: 'none',
    fontSize: '0.875rem',
    fontWeight: '500' as const,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <div style={{ color: '#6b7280' }}>Loading API keys...</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#1f2937' }}>
          API Keys
        </h1>
        <button
          onClick={() => {
            setShowCreate(true)
            setCreatedKey(null)
          }}
          style={{
            ...buttonStyle,
            backgroundColor: '#2563eb',
            color: 'white',
          }}
        >
          <Plus size={18} />
          Create Key
        </button>
      </div>

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
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Create Key Modal */}
      {showCreate && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          marginBottom: '1.5rem',
        }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#1f2937' }}>
            {createdKey ? 'API Key Created' : 'Create New API Key'}
          </h2>

          {createdKey ? (
            <div>
              <div style={{
                padding: '1rem',
                backgroundColor: '#fef3c7',
                borderRadius: '0.5rem',
                marginBottom: '1rem',
              }}>
                <p style={{ fontSize: '0.875rem', color: '#92400e', marginBottom: '0.5rem' }}>
                  ⚠️ Copy this key now. You won't be able to see it again!
                </p>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem',
                backgroundColor: '#f3f4f6',
                borderRadius: '0.5rem',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                wordBreak: 'break-all',
              }}>
                <code style={{ flex: 1 }}>{createdKey}</code>
                <button
                  onClick={() => copyToClipboard(createdKey)}
                  style={{
                    ...buttonStyle,
                    backgroundColor: copied ? '#10b981' : '#e5e7eb',
                    color: copied ? 'white' : '#1f2937',
                    padding: '0.5rem',
                  }}
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
              <button
                onClick={() => {
                  setShowCreate(false)
                  setCreatedKey(null)
                }}
                style={{
                  ...buttonStyle,
                  backgroundColor: '#e5e7eb',
                  color: '#1f2937',
                  marginTop: '1rem',
                }}
              >
                Done
              </button>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>
                  Name *
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., production-app"
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={newKeyDesc}
                  onChange={(e) => setNewKeyDesc(e.target.value)}
                  placeholder="e.g., Main production application"
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleCreate}
                  disabled={!newKeyName.trim()}
                  style={{
                    ...buttonStyle,
                    backgroundColor: newKeyName.trim() ? '#2563eb' : '#9ca3af',
                    color: 'white',
                    cursor: newKeyName.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  Create
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  style={{
                    ...buttonStyle,
                    backgroundColor: '#e5e7eb',
                    color: '#1f2937',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Keys List */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '0.75rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden',
      }}>
        {keys.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
            <Key size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p>No API keys yet. Create one to get started.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb' }}>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Name</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Key Prefix</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Last Used</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Created</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: '500', color: '#1f2937' }}>{key.name}</div>
                    {key.description && (
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>{key.description}</div>
                    )}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <code style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#f3f4f6',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                    }}>
                      {key.key_prefix}...
                    </code>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      backgroundColor: key.is_active ? '#d1fae5' : '#fee2e2',
                      color: key.is_active ? '#065f46' : '#991b1b',
                    }}>
                      {key.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                    {key.last_used_at ? format(new Date(key.last_used_at), 'MMM d, yyyy HH:mm') : 'Never'}
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                    {format(new Date(key.created_at), 'MMM d, yyyy')}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      {key.is_active && (
                        <>
                          <button
                            onClick={() => handleRegenerate(key.id)}
                            style={{
                              padding: '0.375rem',
                              backgroundColor: '#e5e7eb',
                              border: 'none',
                              borderRadius: '0.375rem',
                              cursor: 'pointer',
                            }}
                            title="Regenerate"
                          >
                            <RefreshCw size={16} color="#4b5563" />
                          </button>
                          <button
                            onClick={() => handleDelete(key.id)}
                            style={{
                              padding: '0.375rem',
                              backgroundColor: '#fee2e2',
                              border: 'none',
                              borderRadius: '0.375rem',
                              cursor: 'pointer',
                            }}
                            title="Deactivate"
                          >
                            <Trash2 size={16} color="#dc2626" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
