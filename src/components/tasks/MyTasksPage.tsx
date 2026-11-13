import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Search,
  Calendar,
  Clock,
  Filter,
  X,
  CheckCircle2,
  Circle,
  AlertCircle,
  Eye,
  RotateCcw,
  AlertTriangle,
  ChevronRight,
  UserCheck,
  FileText,
} from 'lucide-react';
import { taskService } from '../../services/taskService';
import { Task, TaskPriority } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useProject } from '../../context/ProjectContext';
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

export const MyTasksPage: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const { selectedProjectId, selectedProject, setSelectedProjectId } = useProject();

  const [allUserTasks, setAllUserTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Detail Modal state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Task Completion Confirmation Modal state
  const [taskToComplete, setTaskToComplete] = useState<Task | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  // Quick Incomplete Reason Modal
  const [incompleteModalTask, setIncompleteModalTask] = useState<Task | null>(null);
  const [incompleteReason, setIncompleteReason] = useState('');
  const [incompleteError, setIncompleteError] = useState<string | null>(null);
  const [isSubmittingIncomplete, setIsSubmittingIncomplete] = useState(false);

  const refreshTasks = async () => {
    const tasks = await taskService.getTasksForUser(user);
    setAllUserTasks(tasks);
  };

  useEffect(() => {
    refreshTasks();
    const unsub = taskService.subscribe(refreshTasks);
    return () => unsub();
  }, [user]);

  // Filter tasks
  const filteredTasks = allUserTasks.filter((t) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      t.title.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.projectName && t.projectName.toLowerCase().includes(q));

    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesProject = selectedProjectId === 'all' || t.projectId === selectedProjectId;

    return matchesSearch && matchesPriority && matchesStatus && matchesProject;
  });

  // Categorize into the 4 mandatory sections
  const categorized = taskService.categorizeTasks(filteredTasks);

  // Handlers
  const handleOpenDetail = (task: Task) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
  };

  const handleOpenConfirmComplete = (task: Task) => {
    setTaskToComplete(task);
  };

  const handleConfirmComplete = async () => {
    if (!taskToComplete) return;

    setIsCompleting(true);
    const res = await taskService.markTaskCompleted(taskToComplete.id);
    setIsCompleting(false);

    if (res.success) {
      showSuccess('Task marked as completed successfully.');
      setTaskToComplete(null);
      refreshTasks();
    } else {
      showError(res.error || 'Failed to mark task complete.');
    }
  };

  const handleOpenIncompleteModal = (task: Task) => {
    setIncompleteModalTask(task);
    setIncompleteReason('');
    setIncompleteError(null);
  };

  const handleSubmitIncomplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incompleteModalTask) return;

    const trimmed = incompleteReason.trim();
    if (!trimmed) {
      setIncompleteError('Please provide a reason why this task cannot be completed.');
      return;
    }

    setIsSubmittingIncomplete(true);
    const res = await taskService.markTaskIncomplete(incompleteModalTask.id, trimmed);
    setIsSubmittingIncomplete(false);

    if (res.success) {
      showSuccess(`Reason submitted for "${incompleteModalTask.title}". Task carried forward.`);
      setIncompleteModalTask(null);
      setIncompleteReason('');
      setIncompleteError(null);
      refreshTasks();
    } else {
      showError(res.error || 'Failed to record incomplete status.');
    }
  };

  const renderTaskItem = (task: Task) => {
    const isCompleted = task.status === 'completed';
    const isCarriedForward = task.isCarriedForward || task.status === 'not_completed';

    return (
      <div
        key={task.id}
        className={`p-4 rounded-lg border transition-all ${
          isCompleted
            ? 'bg-neutral-50/70 border-neutral-200'
            : isCarriedForward
            ? 'bg-amber-50/30 border-amber-200 hover:border-amber-300'
            : 'bg-white border-neutral-200 hover:border-neutral-300 hover:shadow-xs'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Main Info */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Priority badge */}
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-semibold uppercase tracking-wider ${
                  task.priority === 'urgent' || task.priority === 'high'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : task.priority === 'medium'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                }`}
              >
                {task.priority}
              </span>

              {/* Status badge */}
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-medium capitalize ${
                  isCompleted
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : task.status === 'not_completed'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}
              >
                {task.status === 'not_completed' ? 'Incomplete' : task.status.replace('_', ' ')}
              </span>

              {/* Carried Forward Tag */}
              {isCarriedForward && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-[#71347b] border border-[#dfcadf]">
                  <RotateCcw className="w-3 h-3" />
                  Carried Forward
                </span>
              )}

              <span className="text-xs text-neutral-400 font-medium">
                • {task.projectName || 'General Work'}
              </span>
            </div>

            {/* Title */}
            <h4
              className={`text-base font-semibold leading-snug cursor-pointer hover:text-[#71347b] transition-colors ${
                isCompleted ? 'line-through text-neutral-400' : 'text-neutral-900'
              }`}
              onClick={() => handleOpenDetail(task)}
            >
              {task.title}
            </h4>

            {/* Description snippet */}
            <p className="text-xs text-neutral-600 line-clamp-2 leading-relaxed">
              {task.description}
            </p>

            {/* Date Details Bar */}
            <div className="flex items-center gap-4 text-[11.5px] text-neutral-500 pt-1 flex-wrap font-mono">
              <span className="flex items-center gap-1" title="Assigned Date">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                <span>Assigned: {formatDateTimeDisplay(task.createdAt)}</span>
              </span>

              <span className="flex items-center gap-1 text-emerald-700" title="Start Date & Time">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Start: {formatDateTimeDisplay(task.startDate)}</span>
              </span>

              <span
                className={`flex items-center gap-1 font-semibold ${
                  isCompleted ? 'text-neutral-500' : 'text-red-600'
                }`}
                title="Deadline / End Date & Time"
              >
                <Clock className="w-3.5 h-3.5 text-red-500" />
                <span>Deadline: {formatDateTimeDisplay(task.endDate || task.deadline)}</span>
              </span>
            </div>

            {/* Incomplete reason if present */}
            {task.incompleteReason && (
              <div className="mt-2 p-2 bg-amber-50/80 border border-amber-200 rounded text-xs text-amber-900 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Reason submitted: </span>
                  <span>{task.incompleteReason}</span>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-neutral-100">
            <button
              onClick={() => handleOpenDetail(task)}
              className="px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Details</span>
            </button>

            {!isCompleted && (
              <>
                <button
                  onClick={() => handleOpenIncompleteModal(task)}
                  className="px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                  title="Submit a reason if unable to complete by deadline"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Unable to Complete</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenConfirmComplete(task)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                  title="Mark this task as completed"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mark as Completed</span>
                </button>
              </>
            )}

            {isCompleted && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold px-2.5 py-1 bg-emerald-50 rounded border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Done
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSection = (
    title: string,
    tasks: Task[],
    badgeColor: string,
    icon: React.ReactNode,
    emptyMessage: string
  ) => {
    return (
      <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-base font-bold text-neutral-900">{title}</h3>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold font-mono ${badgeColor}`}
            >
              {tasks.length}
            </span>
          </div>
        </div>

        {tasks.length === 0 ? (
          <div className="py-6 px-4 text-center rounded-lg bg-neutral-50/60 border border-dashed border-neutral-200 text-xs text-neutral-500">
            {emptyMessage}
          </div>
        ) : (
          <div className="space-y-3">{tasks.map(renderTaskItem)}</div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            My Tasks & Deliverables
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Execute assigned tasks, monitor deadlines chronologically, and submit status resolutions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-[#f5eff7] text-[#71347b] border border-[#dfcadf] flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Assigned: {user?.fullName || 'Demo User'} ({user?.email})</span>
          </span>
        </div>
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

      {/* Filter and Search Bar */}
      <div className="bg-white border border-neutral-200 rounded-lg p-3.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search deliverables by title, description, or project..."
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-neutral-50 focus:bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#71347b] focus:border-[#71347b] placeholder:text-neutral-400 text-neutral-900 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
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
          >
            <option value="all">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
        </div>
      </div>

      {/* 4 Mandatory Chronological Sections */}
      <div className="space-y-5">
        {/* 1. Today's Tasks */}
        {renderSection(
          "Today's Tasks",
          categorized.today,
          'bg-blue-100 text-blue-800',
          <Clock className="w-5 h-5 text-blue-600" />,
          "No tasks scheduled for today. Check upcoming tasks or relax!"
        )}

        {/* 2. Upcoming Tasks */}
        {renderSection(
          'Upcoming Tasks',
          categorized.upcoming,
          'bg-purple-100 text-[#71347b]',
          <Calendar className="w-5 h-5 text-[#71347b]" />,
          'No upcoming future tasks scheduled at this time.'
        )}

        {/* 3. Overdue Tasks (including carried forward incomplete tasks) */}
        {renderSection(
          'Overdue Tasks',
          categorized.overdue,
          'bg-red-100 text-red-800',
          <AlertCircle className="w-5 h-5 text-red-600" />,
          'No overdue tasks. All deadlines are well met!'
        )}

        {/* 4. Completed Tasks */}
        {renderSection(
          'Completed Tasks',
          categorized.completed,
          'bg-emerald-100 text-emerald-800',
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
          'No completed tasks yet in this view.'
        )}
      </div>

      {/* Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={isDetailOpen}
        allowCompletion={true}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedTask(null);
        }}
        onUpdated={refreshTasks}
      />

      {/* Incomplete Reason Submission Modal */}
      {incompleteModalTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in-0 duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-5 border border-neutral-200 space-y-4">
            <div className="flex items-start justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  Unable to Complete Task
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Task: <span className="font-semibold text-neutral-700">{incompleteModalTask.title}</span>
                </p>
              </div>
              <button
                onClick={() => setIncompleteModalTask(null)}
                className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitIncomplete} className="space-y-3.5">
              <p className="text-xs text-neutral-600">
                Please document why this deliverable cannot be completed by the deadline. The task will be carried forward to the next schedule and the explanation will be available to your manager.
              </p>

              <div>
                <label
                  htmlFor="user-incomplete-reason"
                  className="block text-xs font-semibold text-neutral-700 mb-1"
                >
                  Reason / Blocker Details <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="user-incomplete-reason"
                  rows={4}
                  value={incompleteReason}
                  onChange={(e) => {
                    setIncompleteReason(e.target.value);
                    if (incompleteError) setIncompleteError(null);
                  }}
                  placeholder="e.g. Blocked waiting for third-party API keys from client team; or database migration script requires senior DBA credentials..."
                  className="w-full p-2.5 text-xs bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#71347b] focus:border-[#71347b] resize-y"
                />
                {incompleteError && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{incompleteError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIncompleteModalTask(null)}
                  className="px-3.5 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingIncomplete}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-[#71347b] hover:bg-[#5d2a65] rounded-md transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingIncomplete ? 'Submitting...' : 'Submit Reason & Carry Forward'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Completion Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(taskToComplete)}
        title="Mark Task as Completed"
        message="Are you sure you want to mark this task as completed?"
        taskTitle={taskToComplete?.title}
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        confirmVariant="emerald"
        isLoading={isCompleting}
        onConfirm={handleConfirmComplete}
        onCancel={() => setTaskToComplete(null)}
      />
    </div>
  );
};
