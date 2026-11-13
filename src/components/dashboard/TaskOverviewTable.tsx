import React, { useState } from 'react';
import {
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  FolderKanban,
  User,
  ArrowUpDown,
  RefreshCw,
  Inbox,
  X,
  Eye,
  Loader2,
  Trash2,
} from 'lucide-react';
import { Task, TaskStatus, ViewStateMode } from '../../types';
import { EmptyState } from '../common/EmptyState';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { TaskDetailModal } from '../tasks/TaskDetailModal';
import { taskService } from '../../services/taskService';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

interface TaskOverviewTableProps {
  tasks: Task[];
  viewState?: ViewStateMode;
  isLoading?: boolean;
  hasError?: boolean;
  onRetry?: () => void;
  onTaskUpdated?: () => void;
}

type StatusFilterOption = 'all' | TaskStatus;

const STATUS_FILTERS: { id: StatusFilterOption; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'not_completed', label: 'Not Completed' },
];

function formatDeadlineDisplay(dateStr?: string): string {
  if (!dateStr) return 'No deadline';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

export const TaskOverviewTable: React.FC<TaskOverviewTableProps> = ({
  tasks,
  viewState,
  isLoading: propIsLoading,
  hasError: propHasError,
  onRetry,
  onTaskUpdated,
}) => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const [selectedStatus, setSelectedStatus] = useState<StatusFilterOption>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Manager-only completed task deletion state
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Detail Modal state
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<Task | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const isLoading = viewState === 'loading' || Boolean(propIsLoading);
  const hasError = viewState === 'error' || Boolean(propHasError);

  // Filter tasks if populated
  const filteredTasks = tasks.filter((task) => {
    const matchesStatus =
      selectedStatus === 'all' ? true : task.status === selectedStatus;
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.projectName && task.projectName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (task.assignedToName &&
        task.assignedToName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const isManager = user?.role === 'manager';
  const isUser = user?.role === 'user';

  const handleOpenConfirmDelete = (task: Task) => {
    if (!isManager || task.status !== 'completed') return;
    setTaskToDelete(task);
  };

  const handleConfirmDelete = async () => {
    if (!taskToDelete || !isManager) return;

    setIsDeleting(true);
    const result = await taskService.deleteCompletedTask(taskToDelete.id);
    setIsDeleting(false);

    if (result.success) {
      showSuccess(`Completed task "${taskToDelete.title}" was permanently deleted.`);
      setTaskToDelete(null);
      if (onTaskUpdated) onTaskUpdated();
    } else {
      showError(result.error || 'Failed to delete completed task.');
    }
  };

  const handleOpenDetail = (task: Task) => {
    setSelectedTaskForDetail(task);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-xs">
      {/* Header & Controls Bar */}
      <div className="p-4 sm:p-5 border-b border-neutral-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 tracking-tight">
              Task Overview
            </h2>
            <p className="text-[13px] text-neutral-500 mt-0.5">
              Review task execution, ownership, and current delivery statuses.
            </p>
          </div>

          {/* Search Field */}
          <div className="w-full sm:w-72 relative">
            <label htmlFor="task-table-search" className="sr-only">
              Filter task records
            </label>
            <Search
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              aria-hidden="true"
            />
            <input
              id="task-table-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter tasks by name or project..."
              className="w-full pl-9 pr-8 py-2 text-sm bg-neutral-50 focus:bg-white border border-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#71347b] focus:border-[#71347b] placeholder:text-neutral-400 text-neutral-900 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                aria-label="Clear task search query"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Status Filters: Segmented interactive buttons */}
        <div
          className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none"
          role="tablist"
          aria-label="Task status filter"
        >
          {STATUS_FILTERS.map((tab) => {
            const isActive = selectedStatus === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedStatus(tab.id)}
                className={`px-3.5 py-1.5 text-sm font-medium rounded-md whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#71347b] text-white shadow-xs'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-[#f5eff7] hover:text-[#71347b]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Table / State View */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50/75 text-neutral-700 text-[13px] font-semibold">
              <th scope="col" className="py-3 px-4 sm:px-5">
                Task Name
              </th>
              <th scope="col" className="py-3 px-4">
                Project
              </th>
              <th scope="col" className="py-3 px-4">
                Assigned To
              </th>
              <th scope="col" className="py-3 px-4">
                Deadline
              </th>
              <th scope="col" className="py-3 px-4">
                Priority
              </th>
              <th scope="col" className="py-3 px-4">
                Status
              </th>
              <th scope="col" className="py-3 px-4 sm:px-5 text-right">
                Action
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-neutral-100 text-sm">
            {/* Loading State */}
            {isLoading && (
              <>
                {[1, 2, 3, 4, 5].map((index) => (
                  <tr key={index} className="animate-pulse">
                    <td className="py-3.5 px-4 sm:px-5">
                      <div className="h-4 bg-neutral-100 rounded w-48 mb-1" />
                      <div className="h-3 bg-neutral-50 rounded w-24" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 bg-neutral-100 rounded w-28" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 bg-neutral-100 rounded w-24" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 bg-neutral-100 rounded w-20" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 bg-neutral-100 rounded w-16" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-4 bg-neutral-100 rounded w-20" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="h-6 bg-neutral-100 rounded w-24 ml-auto" />
                    </td>
                  </tr>
                ))}
              </>
            )}

            {/* Error State */}
            {!isLoading && hasError && (
              <tr>
                <td colSpan={7} className="py-12 px-4 text-center">
                  <div className="max-w-sm mx-auto flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-3">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-semibold text-neutral-900 mb-1">
                      Failed to load task records
                    </p>
                    <p className="text-xs text-neutral-500 mb-4">
                      Unable to establish connection with the database endpoint. Verify network or database credentials.
                    </p>
                    {onRetry && (
                      <button
                        onClick={onRetry}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-[#fbf7fc] hover:border-[#71347b] hover:text-[#71347b] transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Retry Query
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {/* Empty State: No tasks assigned at all */}
            {!isLoading && !hasError && tasks.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 px-4">
                  <EmptyState
                    icon={Inbox}
                    title="No tasks recorded"
                    description="Assigned deliverables will appear here once tasks are scheduled."
                    helperText={
                      isManager
                        ? 'Project tasks will automatically populate in this table'
                        : 'Tasks assigned to you will automatically populate in this table'
                    }
                  />
                </td>
              </tr>
            )}

            {/* Filter-Empty State: Tasks exist overall, but 0 match current filter/search */}
            {!isLoading && !hasError && tasks.length > 0 && filteredTasks.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 px-4 text-center">
                  <div className="max-w-sm mx-auto flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 mb-2">
                      <Filter className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-semibold text-neutral-800">
                      No {selectedStatus === 'all' ? '' : selectedStatus.replace('_', ' ')} tasks found
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5 mb-3">
                      {searchQuery
                        ? 'No tasks match your search query.'
                        : `You have ${tasks.length} task(s), but none with status "${selectedStatus.replace('_', ' ')}".`}
                    </p>
                    <button
                      onClick={() => {
                        setSelectedStatus('all');
                        setSearchQuery('');
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-[#71347b] bg-[#f5eff7] hover:bg-[#ede3f1] rounded-md transition-colors cursor-pointer"
                    >
                      Show All Tasks ({tasks.length})
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {/* Populated Rows */}
            {!isLoading && !hasError && filteredTasks.length > 0 && (
              filteredTasks.map((task) => {
                const isCompleted = task.status === 'completed';
                const isAssignedToCurrent = isUser && taskService.isTaskAssignedToUser(task, user);

                return (
                  <tr key={task.id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="py-3 px-4 sm:px-5 font-medium text-neutral-900 text-sm">
                      <div>
                        <span
                          onClick={() => handleOpenDetail(task)}
                          className="font-semibold text-neutral-900 hover:text-[#71347b] cursor-pointer transition-colors"
                        >
                          {task.title}
                        </span>
                        {task.description && (
                          <p className="text-xs text-neutral-500 font-normal line-clamp-1 mt-0.5">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-neutral-700 text-sm">
                      <span className="font-medium">{task.projectName || 'General Work'}</span>
                    </td>
                    <td className="py-3 px-4 text-neutral-600 text-sm">
                      {task.assignedToName || 'Unassigned'}
                    </td>
                    <td className="py-3 px-4 font-mono text-neutral-600 tabular-nums text-xs">
                      {formatDeadlineDisplay(task.endDate || task.deadline)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
                          task.priority === 'urgent' || task.priority === 'high'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : task.priority === 'medium'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                        }`}
                      >
                        {task.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium capitalize ${
                          isCompleted
                            ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                            : task.status === 'in_progress'
                            ? 'text-blue-700 bg-blue-50 border border-blue-200'
                            : task.status === 'not_completed'
                            ? 'text-red-700 bg-red-50 border border-red-200'
                            : 'text-amber-700 bg-amber-50 border border-amber-200'
                        }`}
                      >
                        {task.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 sm:px-5 text-right whitespace-nowrap">
                      {isManager ? (
                        /* Manager Portal: View details, and Delete if completed */
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(task)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 hover:border-neutral-300 rounded-md transition-colors cursor-pointer shadow-2xs"
                            title="View task details"
                          >
                            <Eye className="w-3.5 h-3.5 text-neutral-500" />
                            <span>Details</span>
                          </button>

                          {isCompleted && (
                            <button
                              type="button"
                              onClick={() => handleOpenConfirmDelete(task)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors cursor-pointer shadow-2xs"
                              title="Delete completed task (Manager only)"
                              aria-label={`Delete completed task ${task.title}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        /* User Portal: Dashboard is view-only for tasks; completion is allowed exclusively in My Tasks */
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {isCompleted && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50/80 px-2.5 py-1 rounded border border-emerald-200 mr-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Completed</span>
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(task)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 hover:border-neutral-300 rounded-md transition-colors cursor-pointer shadow-2xs"
                            title="View task details"
                          >
                            <Eye className="w-3.5 h-3.5 text-neutral-500" />
                            <span>Details</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="p-3.5 bg-neutral-50 border-t border-neutral-200 text-[13px] text-neutral-600 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>
          Showing{' '}
          <strong className="font-mono tabular-nums text-neutral-800">
            {isLoading
              ? '—'
              : hasError
              ? '0'
              : filteredTasks.length}
          </strong>{' '}
          of{' '}
          <strong className="font-mono tabular-nums text-neutral-800">
            {tasks.length}
          </strong>{' '}
          tasks
        </span>
        <span className="text-xs text-neutral-400">
          Supabase synchronised task view
        </span>
      </div>

      {/* Manager Confirmation prompt for Deleting Completed Task */}
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

      {/* Optional detail modal when clicked */}
      <TaskDetailModal
        task={selectedTaskForDetail}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedTaskForDetail(null);
        }}
        onUpdated={onTaskUpdated}
      />
    </div>
  );
};
