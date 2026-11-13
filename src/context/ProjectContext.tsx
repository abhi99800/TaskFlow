import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { projectService, ProjectRecord } from '../services/projectService';
import { teamService } from '../services/teamService';
import { useAuth } from './AuthContext';

interface ProjectContextType {
  projects: ProjectRecord[];
  allWorkspaceProjects: ProjectRecord[];
  selectedProjectId: string;
  selectedProject: ProjectRecord | null;
  setSelectedProjectId: (id: string) => void;
  refreshProjects: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role } = useAuth();
  const [allWorkspaceProjects, setAllWorkspaceProjects] = useState<ProjectRecord[]>(() =>
    projectService.getProjects()
  );
  const [authorizedProjectIds, setAuthorizedProjectIds] = useState<string[]>([]);
  const [selectedProjectId, setSelectedProjectIdState] = useState<string>(() => {
    try {
      return localStorage.getItem('taskflow_selected_project_id') || 'all';
    } catch {
      return 'all';
    }
  });

  const refreshProjects = useCallback(async () => {
    const res = await projectService.fetchProjects();
    const fetched = res.success ? res.projects : projectService.getProjects();
    setAllWorkspaceProjects(fetched);

    if (role === 'user' && user) {
      const authIds = await teamService.getUserProjectIds(user.id, user.email);
      setAuthorizedProjectIds(authIds);
    } else {
      setAuthorizedProjectIds(fetched.map((p) => p.id));
    }
  }, [user, role]);

  useEffect(() => {
    refreshProjects();
    const unsubProj = projectService.subscribe(refreshProjects);
    const unsubTeam = teamService.subscribe(refreshProjects);
    return () => {
      unsubProj();
      unsubTeam();
    };
  }, [refreshProjects]);

  const setSelectedProjectId = useCallback((id: string) => {
    setSelectedProjectIdState(id);
    try {
      if (id === 'all') {
        localStorage.removeItem('taskflow_selected_project_id');
      } else {
        localStorage.setItem('taskflow_selected_project_id', id);
      }
    } catch {
      // ignore
    }
  }, []);

  // Compute visible projects based on role:
  // Managers see all workspace projects.
  // Regular users see ONLY projects where they have explicit project membership.
  const projects =
    role === 'user' && user
      ? allWorkspaceProjects.filter((p) => authorizedProjectIds.includes(p.id))
      : allWorkspaceProjects;

  const selectedProject =
    selectedProjectId === 'all'
      ? null
      : projects.find((p) => p.id === selectedProjectId) || null;

  // If a project ID is stored but no longer exists in visible projects list, safely reset
  useEffect(() => {
    if (projects.length > 0 && selectedProjectId !== 'all' && !selectedProject) {
      setSelectedProjectId('all');
    }
  }, [projects, selectedProjectId, selectedProject, setSelectedProjectId]);

  return (
    <ProjectContext.Provider
      value={{
        projects,
        allWorkspaceProjects,
        selectedProjectId,
        selectedProject,
        setSelectedProjectId,
        refreshProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = (): ProjectContextType => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};
