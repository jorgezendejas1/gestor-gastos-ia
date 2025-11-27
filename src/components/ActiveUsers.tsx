import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Circle } from 'lucide-react';

interface PresenceState {
  user_id: string;
  online_at: string;
}

export const ActiveUsers = () => {
  const [activeUsers, setActiveUsers] = useState<Map<string, PresenceState>>(new Map());
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
      }
    });

    // Create presence channel
    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceState>();
        const users = new Map<string, PresenceState>();
        
        Object.entries(state).forEach(([key, presences]) => {
          if (presences && presences.length > 0) {
            users.set(key, presences[0]);
          }
        });
        
        setActiveUsers(users);
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        console.log('User joined:', key);
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        console.log('User left:', key);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: currentUserId,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const activeCount = activeUsers.size;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle>Usuarios Activos</CardTitle>
          </div>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Circle className="h-2 w-2 fill-green-500 text-green-500" />
            {activeCount} en línea
          </Badge>
        </div>
        <CardDescription>
          {activeCount === 1 ? 'Solo tú estás conectado' : 'Usuarios conectados en tiempo real'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {Array.from(activeUsers.entries()).map(([key, presence]) => (
            <div
              key={key}
              className="flex items-center justify-between p-3 border rounded-lg bg-card"
            >
              <div className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-green-500 text-green-500 animate-pulse" />
                <span className="text-sm font-medium">
                  {key === currentUserId ? 'Tú' : `Usuario ${key.slice(0, 8)}...`}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(presence.online_at).toLocaleTimeString('es-MX', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
