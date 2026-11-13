import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  Search,
  Plus,
  Calendar,
  User,
  Clock,
  AlertCircle,
  X,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Eye,
  CheckSquare,
  Briefcase,
} from 'lucide-react';
import { projectService, ProjectRecord } from '../../services/projectService';
import { taskService } from '../../services/taskService';
import { Task } from '../../types';
import { useProject } from '../../context/ProjectContext';
import { useNavigation } from '../../context/NavigationContext';
import { useAuth } from '../../context/AuthContext';
import { CreateProjectDrawer } from './CreateProjectDrawer';
import { TaskDetailModal } from '../tasks/TaskDetailModal';

export const ProjectsPage: React.FC = () => {
  const { selectedProjectId, selectedProject, setSelectedProjectId } = useProject();
  const { navigateTo } = useNavigation();
  const { user } = useAuth();
  const isManager = user?.role === 'manager';

  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Project-specific tasks state
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [projectTaskSearch, setProjectTaskSearch] = useState('');
  const [selectedTaskForModal, setSelectedTaskForModal] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const refreshProjects = async () => {
    setIsLoading(true);
    const result = await projectService.fetchProjects();
    setIsLoading(false);
    if (result.success) {
      setProjects(result.projects);
      setFetchError(null);
    } else {
      setProjects(projectService.getProjects());
      setFetchError(result.error || null);
    }
  };

  const refreshProjectTasks = async () => {
    if (selectedProjectId === 'all') return;
    try {
      const allTasks = isManager
        ? await taskService.getTasks()
        : await taskService.getTasksForUser(user);
      const filtered = allTasks.filter((t) => t.projectId === selectedProjectId);
      setProjectTasks(filtered);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refreshProjects();
    const unsub = projectService.subscribe(() => {
      setProjects(projectService.getProjects());
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (selectedProjectId !== 'all') {
      refreshProjectTasks();
      const unsub = taskService.subscribe(refreshProjectTasks);
      return () => unsub();
    }
  }, [selectedProjectId, isManager, user]);

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.leadUserName && p.leadUserName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filter tasks within the selected project
  const filteredProjectTasks = projectTasks.filter((t) => {
    if (!projectTaskSearch) return true;
    const q = projectTaskSearch.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.assignedToName && t.assignedToName.toLowerCase().includes(q))
    );
  });

  // Metrics for active project
  const projTotalTasks = projectTasks.length;
  const projCompletedTasks = projectTasks.filter((t) => t.status === 'completed').length;
  const projInProgressTasks = projectTasks.filter((t) => t.status === 'in_progress').length;
  const projPendingTasks = projectTasks.filter(
    (t) => t.status === 'pending' || t.status === 'not_completed'
  ).length;

  /* =========================================================================
   * VIEW A: Individual Project Landing Page
   * Rendered when selectedProjectId !== 'all' and selectedProject is active
   * ========================================================================= */
  if (selectedProjectId !== 'all' && selectedProject) {
    const createdFormatted = new Date(selectedProject.createdAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    return (
      <div className="space-y-5">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs text-neutral-500 font-medium" aria-label="Breadcrumb">
          <button
            type="button"
            onClick={() => setSelectedProjectId('all')}
            className="flex items-center gap-1.5 text-[#71347b] hover:text-[#5d2a65] hover:underline cursor-pointer"
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>All Projects</span>
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
          <span className="text-neutral-900 font-semibold truncate max-w-xs">{selectedProject.name}</span>
        </nav>

        {/* Project Header Banner */}
        <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-2 py-0.5 font-mono text-xs font-semibold bg-[#f5eff7] text-[#71347b] border border-[#dfcadf] rounded">
                {selectedProject.code}
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900 truncate">
                {selectedProject.name}
              </h1>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium capitalize ${
                  selectedProject.status === 'completed'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : selectedProject.status === 'in_progress'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : selectedProject.status === 'on_hold'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                }`}
              >
                {selectedProject.status.replace('_', ' ')}
              </span>
            </div>
            {selectedProject.description && (
              <p className="text-sm text-neutral-600 leading-relaxed max-w-3xl pt-1">
                {selectedProject.description}
              </p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setSelectedProjectId('all')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to All Projects</span>
            </button>

            {isManager && (
              <button
                type="button"
                onClick={() => navigateTo('assign-task')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#71347b] hover:bg-[#5d2a65] rounded-md transition-colors shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Assign Task to Project</span>
              </button>
            )}
          </div>
        </div>

        {/* Project Metadata Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-neutral-200 rounded-lg p-3.5 shadow-2xs">
            <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
              Project Lead
            </span>
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <div className="w-6 h-6 rounded-full bg-[#f5eff7] text-[#71347b] flex items-center justify-center text-xs font-bold shrink-0">
                <User className="w-3.5 h-3.5" />
              </div>
              <span className="truncate">{selectedProject.leadUserName || 'Unassigned'}</span>
            </div>
          </div>

          <div className="bg-white border border-neutral-200 rounded-lg p-3.5 shadow-2xs">
            <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
              Target Deadline
            </span>
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <Calendar className="w-4 h-4 text-neutral-500 shrink-0" />
              <span>{selectedProject.deadline || 'No target date'}</span>
            </div>
          </div>

          <div className="bg-white border border-neutral-200 rounded-lg p-3.5 shadow-2xs">
            <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
              Created Date
            </span>
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <Clock className="w-4 h-4 text-neutral-500 shrink-0" />
              <span>{createdFormatted}</span>
            </div>
          </div>

          <div className="bg-white border border-neutral-200 rounded-lg p-3.5 shadow-2xs">
            <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
              Work Breakdown
            </span>
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <CheckSquare className="w-4 h-4 text-[#71347b] shrink-0" />
              <span>{projTotalTasks} Total Deliverable{projTotalTasks === 1 ? '' : 's'}</span>
            </div>
          </div>
        </div>

        {/* Project Tasks & Deliverables Section */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">
                Project Deliverables & Tasks
              </h2>
              <p className="text-xs text-neutral-500">
                Tasks assigned specifically to <strong className="text-neutral-800">{selectedProject.name}</strong>.
              </p>
            </div>

            {/* Quick Metrics Badges */}
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-1 bg-neutral-100 text-neutral-700 rounded-md font-medium">
                Total: <strong>{projTotalTasks}</strong>
              </span>
              <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md font-medium">
                In Progress: <strong>{projInProgressTasks}</strong>
              </span>
              <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md font-medium">
                Completed: <strong>{projCompletedTasks}</strong>
              </span>
              <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-md font-medium">
                Pending: <strong>{projPendingTasks}</strong>
              </span>
            </div>
          </div>

          {/* Task Search Bar */}
          <div className="bg-white border border-neutral-200 rounded-lg p-3 shadow-xs flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={projectTaskSearch}
                onChange={(e) => setProjectTaskSearch(e.target.value)}
                placeholder="Search tasks in this project..."
                className="w-full pl-9 pr-7 py-1.5 text-xs bg-neutral-50 focus:bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#71347b] focus:border-[#71347b]"
              />
              {projectTaskSearch && (
                <button
                  type="button"
                  onClick={() => setProjectTaskSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <span className="text-xs text-neutral-500">
              Showing <strong>{filteredProjectTasks.length}</strong> of {projTotalTasks} tasks
            </span>
          </div>

          {/* Project Task Table */}
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/75 text-neutral-700 font-semibold">
                    <th scope="col" className="py-2.5 px-4">Task Title</th>
                    <th scope="col" className="py-2.5 px-3">Assignee</th>
                    <th scope="col" className="py-2.5 px-3">Priority</th>
                    <th scope="col" className="py-2.5 px-3">Status</th>
                    <th scope="col" className="py-2.5 px-3">Due Date</th>
                    <th scope="col" className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredProjectTasks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 px-4 text-center">
                        <div className="max-w-sm mx-auto flex flex-col items-center">
                          <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-400 mb-2">
                            <CheckSquare className="w-5 h-5" />
                          </div>
                          <p className="text-xs font-semibold text-neutral-800">
                            No tasks found for this project
                          </p>
                          <p className="text-[11px] text-neutral-500 mt-1 mb-3">
                            {projectTaskSearch
                              ? 'No tasks match your search filter.'
                              : 'Assign tasks to this project to track deliverables and ownership.'}
                          </p>
                          {isManager && (
                            <button
                              type="button"
                              onClick={() => navigateTo('assign-task')}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-[#71347b] hover:bg-[#5d2a65] rounded-md transition-colors"
                            >
                              + Assign First Task
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredProjectTasks.map((task) => (
                      <tr key={task.id} className="hover:bg-neutral-50/60 transition-colors">
                        <td className="py-3 px-4 font-semibold text-neutral-900">
                          <div>
                            <span>{task.title}</span>
                            {task.description && (
                              <p className="text-[11px] text-neutral-500 font-normal line-clamp-1 mt-0.5">
                                {task.description}
                              </p>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-neutral-700">
                          {task.assignedToName ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center font-bold text-[10px]">
                                {task.assignedToName.charAt(0).toUpperCase()}
                              </div>
                              <span>{task.assignedToName}</span>
                            </div>
                          ) : (
                            <span className="text-neutral-400 italic">Unassigned</span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium capitalize ${
                              task.priority === 'high'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : task.priority === 'medium'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                            }`}
                          >
                            {task.priority}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium capitalize ${
                              task.status === 'completed'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : task.status === 'in_progress'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                            }`}
                          >
                            {task.status.replace('_', ' ')}
                          </span>
                        </td>

                        <td className="py-3 px-3 font-mono text-[11px] text-neutral-600">
                          {task.deadline || task.endDate || '—'}
                        </td>

                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTaskForModal(task);
                              setIsTaskModalOpen(true);
                            }}
                            className="p-1.5 text-neutral-500 hover:text-[#71347b] hover:bg-[#f5eff7] rounded-md transition-colors cursor-pointer"
                            title="View Details"
                            aria-label="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Task Detail Modal */}
        <TaskDetailModal
          task={selectedTaskForModal}
          isOpen={isTaskModalOpen}
          onClose={() => {
            setIsTaskModalOpen(false);
            setSelectedTaskForModal(null);
          }}
          onUpdated={refreshProjectTasks}
        />
      </div>
    );
  }

  /* =========================================================================
   * VIEW B: All Projects Landing Page
   * Rendered when selectedProjectId === 'all'
   * ========================================================================= */
  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-neutral-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Projects Portfolio
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Coordinate company deliverables, track team milestones, and allocate ownership.
          </p>
        </div>

        {isManager && (
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#71347b] hover:bg-[#5d2a65] active:bg-[#4b2152] rounded-md focus-visible:outline-2 focus-visible:outline-[#71347b] transition-colors shadow-xs shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Project</span>
          </button>
        )}
      </div>

      {/* Error banner if Supabase fetch failed */}
      {fetchError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <label htmlFor="proj-search" className="sr-only">
            Search projects
          </label>
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <input
            id="proj-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by project name, code, or lead..."
            className="w-full pl-9 pr-8 py-1.5 text-sm bg-neutral-50 focus:bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#71347b] focus:border-[#71347b] placeholder:text-neutral-400 text-neutral-900 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-sm bg-neutral-50 border border-neutral-300 rounded-md text-neutral-800 font-medium focus:outline-none cursor-pointer"
            aria-label="Filter by project status"
          >
            <option value="all">All Statuses ({projects.length})</option>
            <option value="active">Active</option>
            <option value="in_progress">In Progress</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Projects Table */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/75 text-neutral-700 text-[13px] font-semibold">
                <th scope="col" className="py-3 px-5">Project Name</th>
                <th scope="col" className="py-3 px-4">Code</th>
                <th scope="col" className="py-3 px-4">Project Lead</th>
                <th scope="col" className="py-3 px-4">Deadline</th>
                <th scope="col" className="py-3 px-4">Status</th>
                <th scope="col" className="py-3 px-4">Created Date</th>
                <th scope="col" className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-100 text-sm">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 px-4 text-center">
                    <div className="max-w-sm mx-auto flex flex-col items-center">
                      <div className="w-12 h-12 rounded-lg bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-400 mb-3">
                        <FolderKanban className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-semibold text-neutral-800 mb-1">
                        No projects found
                      </h3>
                      <p className="text-[13px] text-neutral-500 mb-4">
                        {searchQuery || statusFilter !== 'all'
                          ? 'No projects match your filter criteria.'
                          : 'Get started by creating your first project.'}
                      </p>
                      {isManager && (
                        <button
                          type="button"
                          onClick={() => setIsDrawerOpen(true)}
                          className="px-4 py-2 text-sm font-medium text-white bg-[#71347b] hover:bg-[#5d2a65] rounded-md transition-colors"
                        >
                          + Create Project
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProjects.map((p) => {
                  const createdFormatted = new Date(p.createdAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedProjectId(p.id)}
                      className="hover:bg-neutral-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-5 font-semibold text-neutral-900">
                        <div>
                          <span className="group-hover:text-[#71347b] transition-colors">{p.name}</span>
                          {p.description && (
                            <p className="text-xs text-neutral-500 font-normal mt-0.5 line-clamp-1">
                              {p.description}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-[#71347b]">
                        <span className="px-2 py-0.5 bg-[#f5eff7] border border-[#dfcadf] rounded">
                          {p.code}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-neutral-700">
                        {p.leadUserName ? (
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-neutral-400" />
                            <span>{p.leadUserName}</span>
                          </div>
                        ) : (
                          <span className="text-neutral-400 text-xs italic">Unassigned</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[13px] tabular-nums text-neutral-600">
                        {p.deadline ? (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                            <span>{p.deadline}</span>
                          </div>
                        ) : (
                          <span className="text-neutral-400 text-xs">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium capitalize ${
                            p.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : p.status === 'in_progress'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : p.status === 'on_hold'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                          }`}
                        >
                          {p.status.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[13px] tabular-nums text-neutral-500">
                        {createdFormatted}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#71347b] group-hover:underline">
                          <span>View Project</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-neutral-50 border-t border-neutral-200 text-[13px] text-neutral-600 flex items-center justify-between">
          <span>
            Total Projects: <strong className="font-mono tabular-nums text-neutral-900">{filteredProjects.length}</strong>
          </span>
          <span className="text-xs text-neutral-400">
            Click on any project to view its individual deliverables and landing page
          </span>
        </div>
      </div>

      {/* Creation Slider Drawer */}
      <CreateProjectDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onProjectCreated={refreshProjects}
      />
    </div>
  );
};
