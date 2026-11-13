import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Search,
  Plus,
  Calendar,
  User,
  Clock,
  Filter,
  X,
  AlertCircle,
  Eye,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Layers,
  Trash2,
} from 'lucide-react';
import { taskService } from '../../services/taskService';
import { Task } from '../../types';
import { useProject } from '../../context/ProjectContext';
import { useToast } from '../../context/ToastContext';
import { AssignTaskDrawer } from './AssignTaskDrawer';
import { TaskDetailModal } from './TaskDetailModal';
import { ConfirmDialog } from '../common/ConfirmDialog';

function formatDateTimeDisplay(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

export const AssignTaskPage: React.FC = () => {
  const { selectedProjectId, selectedProject, setSelectedProjectId } = useProject();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const { showSuccess, showError } = useToast();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Detail Modal
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Completed Task Deletion
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const handleConfirmDelete = async () => {
    if (!taskToDelete) return;
    setIsDeleting(true);
    const res = await taskService.deleteCompletedTask(taskToDelete.id);
    setIsDeleting(false);

    if (res.success) {
      showSuccess(`Completed task "${taskToDelete.title}" was permanently deleted.`);
      setTaskToDelete(null);
      refreshTasks();
    } else {
      showError(res.error || 'Failed to delete completed task.');
    }
  };

  const refreshTasks = async () => {
    setIsLoading(true);
    const res = await taskService.fetchTasks();
    setIsLoading(false);
    if (res.success) {
      setTasks(res.tasks);
      setFetchError(null);
    } else {
      const list = await taskService.getTasks();
      setTasks(list);
      setFetchError(res.error || null);
    }
  };

  useEffect(() => {
    refreshTasks();
    const unsub = taskService.subscribe(refreshTasks);
    return () => unsub();
  }, []);

  const filteredTasks = tasks.filter((t) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      t.title.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.projectName && t.projectName.toLowerCase().includes(q)) ||
      (t.assignedToName && t.assignedToName.toLowerCase().includes(q));

    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    const matchesProject = selectedProjectId === 'all' || t.projectId === selectedProjectId;

    return matchesSearch && matchesStatus && matchesPriority && matchesProject;
  });

  const totalCount = filteredTasks.length;
  const completedCount = filteredTasks.filter((t) => t.status === 'completed').length;
  const inProgressCount = filteredTasks.filter((t) => t.status === 'in_progress').length;
  const carriedForwardCount = filteredTasks.filter(
    (t) => t.isCarriedForward || t.status === 'not_completed'
  ).length;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-neutral-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Task Assignment & Delegation
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Create tasks, designate team member accountability, establish deadlines, and track carried-forward work.
          </p>
        </div>

        <button
          onClick={() => setIsDrawerOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#71347b] hover:bg-[#5d2a65] active:bg-[#4b2152] rounded-md focus-visible:outline-2 focus-visible:outline-[#71347b] transition-colors shadow-xs shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Assign Task</span>
        </button>
      </div>

      {/* Active Project Filter Notification */}
      {selectedProjectId !== 'all' && selectedProject && (
        <div className="p-3 bg-[#f5eff7] border border-[#dfcadf] rounded-lg flex items-center justify-between gap-3 text-xs text-[#71347b]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">Filtered by Active Project:</span>
            <span className="px-2 py-0.5 bg-white border border-[#dfcadf] rounded font-medium">
              {selectedProject.name} ({selectedProject.code})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedProjectId('all')}
            className="font-medium hover:underline text-xs cursor-pointer text-[#71347b]"
          >
            Show all projects
          </button>
        </div>
      )}

      {/* Error banner if Supabase fetch failed */}
      {fetchError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-lg border border-neutral-200 shadow-xs">
          <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block">
            Total Deliverables
          </span>
          <span className="text-2xl font-bold font-mono text-neutral-900 mt-0.5 block">
            {totalCount}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-neutral-200 shadow-xs">
          <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider block">
            Active / In Progress
          </span>
          <span className="text-2xl font-bold font-mono text-blue-700 mt-0.5 block">
            {inProgressCount}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-neutral-200 shadow-xs">
          <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider block">
            Carried Forward / Incomplete
          </span>
          <span className="text-2xl font-bold font-mono text-amber-700 mt-0.5 block">
            {carriedForwardCount}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-neutral-200 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider block">
            Completed
          </span>
          <span className="text-2xl font-bold font-mono text-emerald-700 mt-0.5 block">
            {completedCount}
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-neutral-200 rounded-lg p-3.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <label htmlFor="task-assign-search" className="sr-only">
            Search tasks
          </label>
          <Search
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            aria-hidden="true"
          />
          <input
            id="task-assign-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, description, project, or member..."
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-neutral-50 focus:bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#71347b] focus:border-[#71347b] placeholder:text-neutral-400 text-neutral-900 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-neutral-50 border border-neutral-300 rounded-md text-neutral-800 font-medium focus:outline-none cursor-pointer"
            aria-label="Filter by status"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="not_completed">Incomplete / Carried Forward</option>
            <option value="completed">Completed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-neutral-50 border border-neutral-300 rounded-md text-neutral-800 font-medium focus:outline-none cursor-pointer"
            aria-label="Filter by priority"
          >
            <option value="all">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
        </div>
      </div>

      {/* Tasks Table */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/75 text-neutral-700 text-xs font-semibold">
                <th scope="col" className="py-3 px-4">Task Deliverable</th>
                <th scope="col" className="py-3 px-4">Project</th>
                <th scope="col" className="py-3 px-4">Assigned Member</th>
                <th scope="col" className="py-3 px-4">Start Time</th>
                <th scope="col" className="py-3 px-4">Deadline</th>
                <th scope="col" className="py-3 px-4">Priority</th>
                <th scope="col" className="py-3 px-4">Status / Carry-Forward</th>
                <th scope="col" className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-100 text-xs">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 px-4 text-center">
                    <div className="max-w-sm mx-auto flex flex-col items-center">
                      <div className="w-12 h-12 rounded-lg bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-400 mb-3">
                        <CheckSquare className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-semibold text-neutral-800 mb-1">
                        No tasks found
                      </h3>
                      <p className="text-xs text-neutral-500 mb-4">
                        {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
                          ? 'No tasks match your search or filter criteria.'
                          : 'Assign deliverables to active team members using the Assign Task slider.'}
                      </p>
                      <button
                        onClick={() => setIsDrawerOpen(true)}
                        className="px-4 py-2 text-xs font-medium text-white bg-[#71347b] hover:bg-[#5d2a65] rounded-md transition-colors cursor-pointer"
                      >
                        + Assign Task
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTasks.map((t) => {
                  const isCarriedForward = t.isCarriedForward || t.status === 'not_completed';
                  return (
                    <tr key={t.id} className="hover:bg-neutral-50/60 transition-colors">
                      {/* Title & snippet */}
                      <td className="py-3.5 px-4 font-semibold text-neutral-900 max-w-[260px]">
                        <div>
                          <span
                            className="hover:text-[#71347b] cursor-pointer"
                            onClick={() => {
                              setSelectedTask(t);
                              setIsDetailOpen(true);
                            }}
                          >
                            {t.title}
                          </span>
                          {t.description && (
                            <p className="text-[11px] text-neutral-500 font-normal line-clamp-1 mt-0.5">
                              {t.description}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Project */}
                      <td className="py-3.5 px-4 text-neutral-700 whitespace-nowrap">
                        <span className="font-medium">{t.projectName || 'General Work'}</span>
                      </td>

                      {/* Assignee */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-neutral-400" />
                          <span className="font-medium text-neutral-800">
                            {t.assignedToName || 'Unassigned'}
                          </span>
                        </div>
                      </td>

                      {/* Start Time */}
                      <td className="py-3.5 px-4 font-mono tabular-nums text-neutral-600 whitespace-nowrap">
                        {formatDateTimeDisplay(t.startDate)}
                      </td>

                      {/* Deadline */}
                      <td className="py-3.5 px-4 font-mono tabular-nums text-neutral-700 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-red-500" />
                          <span className="font-semibold">{formatDateTimeDisplay(t.endDate || t.deadline)}</span>
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-semibold uppercase tracking-wider ${
                            t.priority === 'urgent' || t.priority === 'high'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : t.priority === 'medium'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                          }`}
                        >
                          {t.priority}
                        </span>
                      </td>

                      {/* Status & Carry Forward Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-medium capitalize ${
                              t.status === 'completed'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : t.status === 'in_progress'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : t.status === 'not_completed'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                            }`}
                          >
                            {t.status === 'not_completed' ? 'Incomplete' : t.status.replace('_', ' ')}
                          </span>

                          {isCarriedForward && (
                            <div className="flex items-center gap-1 text-[10px] text-purple-700 font-semibold">
                              <RotateCcw className="w-3 h-3" />
                              <span>Carried Forward</span>
                            </div>
                          )}

                          {t.incompleteReason && (
                            <span
                              className="block text-[10.5px] text-amber-800 font-medium truncate max-w-[180px]"
                              title={t.incompleteReason}
                            >
                              Note: {t.incompleteReason}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTask(t);
                              setIsDetailOpen(true);
                            }}
                            className="p-1.5 text-neutral-500 hover:text-[#71347b] hover:bg-[#fbf7fc] rounded-md transition-colors cursor-pointer"
                            title="View Details"
                            aria-label="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {t.status === 'completed' && (
                            <button
                              type="button"
                              onClick={() => setTaskToDelete(t)}
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                              title="Delete"
                              aria-label="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3.5 bg-neutral-50 border-t border-neutral-200 text-xs text-neutral-600 flex items-center justify-between">
          <span>
            Showing <strong className="font-mono tabular-nums text-neutral-900">{filteredTasks.length}</strong> of{' '}
            <strong className="font-mono tabular-nums text-neutral-900">{tasks.length}</strong> total tasks
          </span>
          <span className="text-neutral-400">
            Manager Delegation & Oversight
          </span>
        </div>
      </div>

      {/* Task Creation Drawer */}
      <AssignTaskDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onTaskAssigned={refreshTasks}
      />

      {/* Task Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedTask(null);
        }}
        onUpdated={refreshTasks}
      />

      {/* Completed Task Deletion Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(taskToDelete)}
        title="Delete Completed Task"
        message="Are you sure you want to permanently delete this completed task? This action cannot be undone."
        taskTitle={taskToDelete?.title}
        confirmLabel="Delete Task"
        cancelLabel="Cancel"
        confirmVariant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setTaskToDelete(null)}
      />
    </div>
  );
};
