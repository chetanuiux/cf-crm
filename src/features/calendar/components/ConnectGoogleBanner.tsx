import { useState } from 'react';
import { X, Calendar, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { api } from '@/api/index';
type Props = {
  syncStatus?: { connected: boolean; last_sync: string | null; email: string | null } | null;
  onDisconnected?: () => void;
};

export function ConnectGoogleBanner({ syncStatus, onDisconnected }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  if (dismissed) return null;

  const connected = syncStatus?.connected === true;

  const handleConnect = async () => {
    try {
      const { auth_url } = await api.calendar.connectGoogle();
      if (!auth_url) {
        toast.error('Google Calendar is not configured on the server.');
        return;
      }
      window.location.href = auth_url;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initiate Google Calendar connection.';
      toast.error(message);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await api.calendar.disconnectGoogle();
      toast.success('Google Calendar disconnected.');
      onDisconnected?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to disconnect Google Calendar.';
      toast.error(message);
    } finally {
      setDisconnecting(false);
    }
  };

  if (connected) {
    const email = syncStatus?.email ?? 'Google Calendar';
    return (
      <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-4">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
        <p className="text-sm text-emerald-800 flex-1">
          <span className="font-medium">Google Calendar connected</span>
          {' — '}
          {email}
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={disconnecting}
          onClick={handleDisconnect}
          className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-100 shrink-0"
        >
          {disconnecting ? 'Disconnecting…' : 'Disconnect'}
        </Button>
        <button type="button" onClick={() => setDismissed(true)} className="text-emerald-400 hover:text-emerald-600 shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4">
      <Calendar className="h-4 w-4 text-blue-600 shrink-0" />
      <p className="text-sm text-blue-800 flex-1">
        <span className="font-medium">Connect Google Calendar</span> to sync events across devices and share availability with your team.
      </p>
      <Button size="sm" variant="outline" onClick={handleConnect}
        className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-100 shrink-0">
        Connect
      </Button>
      <button type="button" onClick={() => setDismissed(true)} className="text-blue-400 hover:text-blue-600 shrink-0">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
