import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'admin' | 'editor' | 'viewer';

interface UserRoleData {
  role: UserRole | null;
  isAdmin: boolean;
  canEdit: boolean;
  loading: boolean;
}

export const useUserRole = (userId?: string) => {
  const [roleData, setRoleData] = useState<UserRoleData>({
    role: null,
    isAdmin: false,
    canEdit: false,
    loading: true,
  });

  useEffect(() => {
    if (!userId) {
      setRoleData({ role: null, isAdmin: false, canEdit: false, loading: false });
      return;
    }

    const fetchRole = async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching user role:', error);
        setRoleData({ role: null, isAdmin: false, canEdit: false, loading: false });
        return;
      }

      const role = data?.role as UserRole;
      setRoleData({
        role,
        isAdmin: role === 'admin',
        canEdit: role === 'admin' || role === 'editor',
        loading: false,
      });
    };

    fetchRole();

    // Subscribe to role changes
    const channel = supabase
      .channel('user-role-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_roles',
          filter: `user_id=eq.${userId}`,
        },
        () => fetchRole()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return roleData;
};
