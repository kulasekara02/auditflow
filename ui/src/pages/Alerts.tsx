import { useState, useEffect, useCallback } from 'react';
import { alertsApi, Alert } from '../api';
import { Bell, CheckCircle, Clock, XCircle, AlertTriangle, AlertCircle, Filter, RefreshCw, ChevronLeft, ChevronRight, Eye, Check } from 'lucide-react';

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [updating, setUpdating] = useState<number | null>(null);
  const pageSize = 15;

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string | number> = {
        skip: (page - 1) * pageSize,
        limit: pageSize
      };
      if (statusFilter) params.status = statusFilter;
      if (levelFilter) params.level = levelFilter;

      const data = await alertsApi.list(params);
      setAlerts(data.alerts || []);
      setTotalPages(Math.max(1, Math.ceil((data.total || 0) / pageSize)));
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch alerts';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, levelFilter]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const updateAlertStatus = async (alertId: number, status: 'acknowledged' | 'resolved') => {
    setUpdating(alertId);
    try {
      await alertsApi.updateStatus(alertId, status);
      await fetchAlerts();
      if (selectedAlert?.id === alertId) {
        setSelectedAlert(prev => prev ? { ...prev, status } : null);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update alert';
      setError(errorMsg);
    } finally {
      setUpdating(null);
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'critical': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'high': return <AlertCircle className="w-5 h-5 text-orange-500" />;
      case 'medium': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default: return <Bell className="w-5 h-5 text-blue-500" />;
    }
  };

  const getLevelBadge = (level: string) => {
    const colours: Record<string, string> = {
      critical: 'bg-red-100 text-red-800 border-red-200',
      high: 'bg-orange-100 text-orange-800 border-orange-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-blue-100 text-blue-800 border-blue-200'
    };
    return colours[level] || colours.low;
  };

  const getStatusBadge = (status: string) => {
    const colours: Record<string, string> = {
      new: 'bg-purple-100 text-purple-800 border-purple-200',
      acknowledged: 'bg-blue-100 text-blue-800 border-blue-200',
      resolved: 'bg-green-100 text-green-800 border-green-200'
    };
    return colours[status] || colours.new;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved': return <CheckCircle className="w-4 h-4" />;
      case 'acknowledged': return <Eye className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeAgo = (ts: string) => {
    const now = new Date();
    const then = new Date(ts);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-centre gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alerts</h1>
          <p className="text-gray-600 mt-1">Monitor and manage system alerts</p>
        </div>
        <button
          onClick={fetchAlerts}
          disabled={loading}
          className="flex items-centre gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colours"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-centre gap-4">
          <Filter className="w-5 h-5 text-gray-400" />
          <div className="flex items-centre gap-2">
            <label className="text-sm text-gray-600">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All</option>
              <option value="new">New</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          <div className="flex items-centre gap-2">
            <label className="text-sm text-gray-600">Level:</label>
            <select
              value={levelFilter}
              onChange={(e) => { setLevelFilter(e.target.value); setPage(1); }}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          {(statusFilter || levelFilter) && (
            <button
              onClick={() => { setStatusFilter(''); setLevelFilter(''); setPage(1); }}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-centre gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alerts List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="p-12 text-centre">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading alerts...</p>
              </div>
            ) : alerts.length === 0 ? (
              <div className="p-12 text-centre">
                <Bell className="w-12 h-12 text-gray-400 mx-auto" />
                <p className="mt-4 text-gray-600">No alerts found</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-gray-200">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      onClick={() => setSelectedAlert(alert)}
                      className={`p-4 cursor-pointer hover:bg-gray-50 transition-colours ${
                        selectedAlert?.id === alert.id ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {getLevelIcon(alert.level)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-centre gap-2 flex-wrap">
                            <h3 className="font-medium text-gray-900 truncate">{alert.rule_name}</h3>
                            <span className={`inline-flex items-centre gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(alert.status)}`}>
                              {getStatusIcon(alert.status)}
                              {alert.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{alert.message}</p>
                          <div className="flex items-centre gap-4 mt-2">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${getLevelBadge(alert.level)}`}>
                              {alert.level}
                            </span>
                            <span className="text-xs text-gray-500">{getTimeAgo(alert.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                <div className="px-4 py-3 border-t border-gray-200 flex items-centre justify-between">
                  <p className="text-sm text-gray-600">Page {page} of {totalPages}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Alert Details Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 sticky top-6">
            {selectedAlert ? (
              <div className="p-6">
                <div className="flex items-centre gap-3 mb-4">
                  {getLevelIcon(selectedAlert.level)}
                  <h2 className="text-lg font-semibold text-gray-900">{selectedAlert.rule_name}</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Status</label>
                    <div className="mt-1">
                      <span className={`inline-flex items-centre gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${getStatusBadge(selectedAlert.status)}`}>
                        {getStatusIcon(selectedAlert.status)}
                        {selectedAlert.status}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Level</label>
                    <div className="mt-1">
                      <span className={`inline-flex px-3 py-1 rounded text-sm font-medium border ${getLevelBadge(selectedAlert.level)}`}>
                        {selectedAlert.level}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Message</label>
                    <p className="mt-1 text-sm text-gray-700">{selectedAlert.message}</p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Created</label>
                    <p className="mt-1 text-sm text-gray-700">{formatTimestamp(selectedAlert.created_at)}</p>
                  </div>

                  {selectedAlert.event_id && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Event ID</label>
                      <p className="mt-1 text-sm text-gray-700 font-mono">{selectedAlert.event_id}</p>
                    </div>
                  )}

                  {/* Actions */}
                  {selectedAlert.status !== 'resolved' && (
                    <div className="pt-4 border-t border-gray-200 space-y-2">
                      {selectedAlert.status === 'new' && (
                        <button
                          onClick={() => updateAlertStatus(selectedAlert.id, 'acknowledged')}
                          disabled={updating === selectedAlert.id}
                          className="w-full flex items-centre justify-centre gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colours"
                        >
                          <Eye className="w-4 h-4" />
                          {updating === selectedAlert.id ? 'Updating...' : 'Acknowledge'}
                        </button>
                      )}
                      <button
                        onClick={() => updateAlertStatus(selectedAlert.id, 'resolved')}
                        disabled={updating === selectedAlert.id}
                        className="w-full flex items-centre justify-centre gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colours"
                      >
                        <Check className="w-4 h-4" />
                        {updating === selectedAlert.id ? 'Updating...' : 'Resolve'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-12 text-centre">
                <Bell className="w-8 h-8 text-gray-400 mx-auto" />
                <p className="mt-3 text-gray-600">Select an alert to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
