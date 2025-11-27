import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users, Shield, Edit3, Eye, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface UserRoleInfo {
  id: string;
  user_id: string;
  role: 'admin' | 'editor' | 'viewer';
  created_at: string;
}

export const UserManagement = () => {
  const [userRoles, setUserRoles] = useState<UserRoleInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserRoles();

    // Real-time subscription
    const channel = supabase
      .channel('user-roles-management')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_roles',
        },
        () => loadUserRoles()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadUserRoles = async () => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading user roles:', error);
      toast.error('Error al cargar usuarios');
      return;
    }

    setUserRoles(data || []);
    setLoading(false);
  };

  const updateUserRole = async (userId: string, newRole: 'admin' | 'editor' | 'viewer') => {
    const { error } = await supabase
      .from('user_roles')
      .update({ role: newRole })
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating role:', error);
      toast.error('Error al actualizar rol');
      return;
    }

    toast.success('Rol actualizado correctamente');
  };

  const deleteUserRole = async (userId: string) => {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting user:', error);
      toast.error('Error al eliminar usuario');
      return;
    }

    toast.success('Usuario eliminado correctamente');
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-4 w-4" />;
      case 'editor':
        return <Edit3 className="h-4 w-4" />;
      case 'viewer':
        return <Eye className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'editor':
        return 'default';
      case 'viewer':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">Cargando usuarios...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle>Gestión de Usuarios</CardTitle>
        </div>
        <CardDescription>
          Administra los roles y permisos de los usuarios
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {userRoles.map((userRole) => (
            <div
              key={userRole.id}
              className="flex items-center justify-between p-4 border rounded-lg bg-card"
            >
              <div className="flex items-center gap-3">
                {getRoleIcon(userRole.role)}
                <div>
                  <p className="font-medium text-sm">Usuario ID: {userRole.user_id.slice(0, 8)}...</p>
                  <Badge variant={getRoleBadgeVariant(userRole.role)} className="mt-1">
                    {userRole.role === 'admin' && 'Administrador'}
                    {userRole.role === 'editor' && 'Editor'}
                    {userRole.role === 'viewer' && 'Visor'}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={userRole.role}
                  onValueChange={(value) => updateUserRole(userRole.user_id, value as any)}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Visor</SelectItem>
                  </SelectContent>
                </Select>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción eliminará el acceso de este usuario. No podrá revertirse.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteUserRole(userRole.user_id)}>
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
          {userRoles.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No hay usuarios registrados
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
