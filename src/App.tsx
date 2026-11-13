/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { ProjectProvider } from './context/ProjectContext';
import { NavigationProvider } from './context/NavigationContext';
import { AppShell } from './components/layout/AppShell';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <ProjectProvider>
          <NavigationProvider>
            <AppShell />
          </NavigationProvider>
        </ProjectProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

