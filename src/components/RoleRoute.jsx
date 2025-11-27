import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '../hooks/useUser';

export default function RoleRoute({ role, children }) {
  const { user, loading } = useUser();
  if (loading) return null;

  if (!user?.role) return <Navigate to="/complete-profile" replace />;
  if (user.role !== role) return <Navigate to="/dashboard" replace />;

  return children;
} 