import React from 'react';
import { useNavigation } from '../../context/NavigationContext';
import { UsersPage } from './UsersPage';
import { RolesPage } from './RolesPage';

export const UserManagementContainer: React.FC = () => {
  const { userManagementSubTab } = useNavigation();

  return (
    <div className="w-full">
      {userManagementSubTab === 'users' ? <UsersPage /> : <RolesPage />}
    </div>
  );
};
