import { ReactNode } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock } from 'lucide-react';

interface PermissionGuardProps {
  children: ReactNode;
  requireAdmin?: boolean;
  requireEdit?: boolean;
  userId?: string;
  fallback?: ReactNode;
  showAlert?: boolean;
}

export const PermissionGuard = ({
  children,
  requireAdmin = false,
  requireEdit = false,
  userId,
  fallback,
  showAlert = true,
}: PermissionGuardProps) => {
  const { isAdmin, canEdit, loading } = useUserRole(userId);

  if (loading) {
    return null;
  }

  const hasPermission = requireAdmin ? isAdmin : requireEdit ? canEdit : true;

  if (!hasPermission) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showAlert) {
      return (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            No tienes permisos para realizar esta acción.
            {requireAdmin && ' Se requiere rol de Administrador.'}
            {requireEdit && !requireAdmin && ' Se requiere rol de Editor o Administrador.'}
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  }

  return <>{children}</>;
};
