import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  User,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  FileText,
  Trash2,
  Edit3,
  Save,
  ArrowLeft,
} from 'lucide-react';
import { Task, TaskPriority } from '../../types';
import { taskService } from '../../services/taskService';
import { teamService, ProjectTeamMember } from '../../services/teamService';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
  allowCompletion?: boolean;
}

function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-US', {
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

function toLocalInputFormat(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  isOpen,
  onClose,
  onUpdated,
  allowCompletion = false,
}) => {
  const { user } = useAuth();
  const { showSuccess, showError, showWarning } = useToast();

  const [isSubmittingReason, setIsSubmittingReason] = useState(false);
  const [reasonText, setReasonText] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [showReasonForm, setShowReasonForm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmComplete, setShowConfirmComplete] = useState(false);

  // Manager Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAssignedToUserId, setEditAssignedToUserId] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>('medium');
  const [projectMembers, setProjectMembers] = useState<ProjectTeamMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Manager Delete Completed Task State
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isDeletingTask, setIsDeletingTask] = useState(false);

  const isManager = user?.role === 'manager';
  const isUserRole = user?.role === 'user';
  const isCompleted = task?.status === 'completed';
  const isAssignedToCurrentUser = Boolean(
    isUserRole && task && taskService.isTaskAssignedToUser(task, user)
  );

  // Sync edit form state when task opens or changes
  useEffect(() => {
    if (task) {
      setEditTitle(task.title || '');
      setEditDescription(task.description || '');
      setEditAssignedToUserId(task.assignedToUserId || '');
      setEditStartDate(toLocalInputFormat(task.startDate));
      setEditEndDate(toLocalInputFormat(task.endDate || task.deadline));
      setEditPriority(task.priority || 'medium');
      setIsEditing(false);
      setEditError(null);
      setShowReasonForm(false);
      setReasonText('');
      setReasonError(null);
    }
  }, [task, isOpen]);

  // Load project members for the task's project when in manager mode
  useEffect(() => {
    if (isManager && task?.projectId) {
      setIsLoadingMembers(true);
      teamService.fetchTeamMembers(task.projectId).then((res) => {
        setIsLoadingMembers(false);
        if (res.success) {
          // Filter strictly to active project members
          const activeOnly = res.members.filter(
            (m) => m.status.toLowerCase() === 'active'
          );
          setProjectMembers(activeOnly);
        } else {
          setProjectMembers([]);
        }
      });
    }
  }, [task?.projectId, isManager]);

  if (!isOpen || !task) return null;

  const handleConfirmMarkCompleted = async () => {
    setIsProcessing(true);
    const result = await taskService.markTaskCompleted(task.id);
    setIsProcessing(false);

    if (result.success) {
      showSuccess('Task marked as completed successfully.');
      setShowConfirmComplete(false);
      if (onUpdated) onUpdated();
      onClose();
    } else {
      showError(result.error || 'Failed to mark task as completed.');
    }
  };

  const handleSubmitIncompleteReason = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanReason = reasonText.trim();
    if (!cleanReason) {
      setReasonError('Please enter a specific reason why this task cannot be completed.');
      return;
    }

    setIsSubmittingReason(true);
    const result = await taskService.markTaskIncomplete(task.id, cleanReason);
    setIsSubmittingReason(false);

    if (result.success) {
      showSuccess('Reason submitted successfully. Task has been carried forward to the next day.');
      setShowReasonForm(false);
      setReasonText('');
      setReasonError(null);
      if (onUpdated) onUpdated();
      onClose();
    } else {
      showError(result.error || 'Failed to submit incomplete status.');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);

    const titleTrimmed = editTitle.trim();
    if (!titleTrimmed) {
      setEditError('Task Title is required.');
      return;
    }

    if (!editDescription.trim()) {
      setEditError('Task Description is required.');
      return;
    }

    if (!editAssignedToUserId) {
      setEditError('Please select an active team member belonging to this project.');
      return;
    }

    // Verify assigned user is an active project member
    const selectedMember = projectMembers.find((m) => m.userId === editAssignedToUserId);
    if (!selectedMember) {
      setEditError('The selected user is not an active member of this project.');
      return;
    }

    if (editStartDate && editEndDate) {
      const s = new Date(editStartDate).getTime();
      const e = new Date(editEndDate).getTime();
      if (e <= s) {
        setEditError('The deadline / end date must be later than the start date.');
        return;
      }
    }

    setIsSavingEdit(true);
    const result = await taskService.updateTask(task.id, {
      title: titleTrimmed,
      description: editDescription.trim(),
      assignedToUserId: editAssignedToUserId,
      startDate: editStartDate,
      endDate: editEndDate,
      priority: editPriority,
    });
    setIsSavingEdit(false);

    if (result.success) {
      showSuccess(`Task "${titleTrimmed}" was updated successfully.`);
      setIsEditing(false);
      if (onUpdated) onUpdated();
    } else {
      setEditError(result.error || 'Failed to update task.');
      showError(result.error || 'Failed to update task.');
    }
  };

  const handleConfirmDeleteCompletedTask = async () => {
    if (!isManager || task.status !== 'completed') return;

    setIsDeletingTask(true);
    const result = await taskService.deleteCompletedTask(task.id);
    setIsDeletingTask(false);

    if (result.success) {
      showSuccess(`Completed task "${task.title}" was permanently deleted.`);
      setShowConfirmDelete(false);
      if (onUpdated) onUpdated();
      onClose();
    } else {
      showError(result.error || 'Failed to delete completed task.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in-0 duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-detail-title"
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-neutral-200">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-neutral-200 bg-[#fbf7fc]">
          <div className="space-y-1 pr-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
                  task.priority === 'urgent' || task.priority === 'high'
                    ? 'bg-red-100 text-red-700 border border-red-200'
                    : task.priority === 'medium'
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                }`}
              >
                {task.priority} Priority
              </span>

              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-medium capitalize ${
                  task.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : task.status === 'not_completed'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                }`}
              >
                {task.status === 'not_completed'
                  ? 'Incomplete / Carried Forward'
                  : task.status.replace('_', ' ')}
              </span>

              {task.isCarriedForward && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                  <RotateCcw className="w-3 h-3" />
                  Carried Forward
                </span>
              )}
            </div>

            <h2 id="task-detail-title" className="text-xl font-bold text-neutral-900 leading-snug">
              {isEditing ? 'Edit Task Details' : task.title}
            </h2>
            <p className="text-xs text-neutral-500">
              Project:{' '}
              <span className="font-semibold text-neutral-700">
                {task.projectName || 'General Work'}
              </span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* MANAGER EDIT FORM */}
          {isEditing && isManager ? (
            <form onSubmit={handleSaveEdit} className="space-y-4">
              {editError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2 text-xs text-red-800">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Task Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#71347b]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Description & Deliverables <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full p-2.5 text-sm bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#71347b]"
                />
              </div>

              {/* Reassign Assignee (Filtered strictly to active project members) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-neutral-700">
                    Assignee (Active Project Members Only) <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-neutral-400">
                    {isLoadingMembers
                      ? 'Loading members...'
                      : `${projectMembers.length} eligible project member(s)`}
                  </span>
                </div>
                <select
                  value={editAssignedToUserId}
                  onChange={(e) => setEditAssignedToUserId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#71347b] cursor-pointer"
                >
                  <option value="">-- Select Project Member --</option>
                  {projectMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name} ({m.email}) — {m.roleName}
                    </option>
                  ))}
                </select>
                {projectMembers.length === 0 && !isLoadingMembers && (
                  <p className="mt-1 text-xs text-amber-700">
                    No active members found for this project. Add users to the project in Team Members first.
                  </p>
                )}
              </div>

              {/* Start Date and End Date / Deadline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Start Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#71347b]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Deadline / End Date & Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#71347b]"
                  />
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Priority</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['low', 'medium', 'high'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setEditPriority(p)}
                      className={`py-1.5 px-3 text-xs font-medium rounded-md border text-center capitalize cursor-pointer transition-colors ${
                        editPriority === p
                          ? 'bg-[#71347b] text-white border-[#71347b]'
                          : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-[#71347b] hover:bg-[#5d2a65] rounded-md transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingEdit ? 'Saving Changes...' : 'Save Task Changes'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* STANDARD VIEW MODE */
            <>
              {/* Description */}
              <div>
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Description & Deliverables
                </h3>
                <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-800 whitespace-pre-wrap leading-relaxed text-[13.5px]">
                  {task.description || 'No detailed description provided.'}
                </div>
              </div>

              {/* Schedule & Assignee Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 bg-neutral-50/60 border border-neutral-200 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
                    <User className="w-4 h-4 text-[#71347b]" />
                    <span>Assigned Account</span>
                  </div>
                  <p className="font-medium text-neutral-900 text-sm">
                    {task.assignedToName || 'Unassigned'}
                  </p>
                  {task.assignedToEmail && (
                    <p className="text-xs text-neutral-500 font-mono">{task.assignedToEmail}</p>
                  )}
                </div>

                <div className="p-3.5 bg-neutral-50/60 border border-neutral-200 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
                    <Calendar className="w-4 h-4 text-[#71347b]" />
                    <span>Assignment Date</span>
                  </div>
                  <p className="font-medium text-neutral-900 text-sm">
                    {formatDisplayDate(task.createdAt)}
                  </p>
                </div>

                <div className="p-3.5 bg-neutral-50/60 border border-neutral-200 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    <span>Start Date & Time</span>
                  </div>
                  <p className="font-medium text-neutral-900 text-sm">
                    {formatDisplayDate(task.startDate)}
                  </p>
                </div>

                <div className="p-3.5 bg-neutral-50/60 border border-neutral-200 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
                    <Clock className="w-4 h-4 text-red-600" />
                    <span>Deadline / End Date & Time</span>
                  </div>
                  <p className="font-semibold text-neutral-900 text-sm">
                    {formatDisplayDate(task.endDate || task.deadline)}
                  </p>
                </div>
              </div>

              {/* Incomplete Reason Log if present */}
              {(task.incompleteReason || task.status === 'not_completed') && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Reason for Incompletion (Carried Forward)</span>
                  </div>
                  <p className="text-sm text-amber-950 font-medium">
                    {task.incompleteReason ||
                      'Marked as incomplete. Carried forward to the next schedule.'}
                  </p>
                  {task.incompleteReasonSubmittedAt && (
                    <p className="text-[11px] text-amber-700">
                      Submitted: {formatDisplayDate(task.incompleteReasonSubmittedAt)}
                    </p>
                  )}
                </div>
              )}

              {/* Completed Timestamp if completed */}
              {isCompleted && task.completedAt && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2.5 text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Task completed on <strong>{formatDisplayDate(task.completedAt)}</strong>.
                  </span>
                </div>
              )}

              {/* Incomplete Reason Submission Form (for User role strictly in My Tasks) */}
              {showReasonForm &&
                allowCompletion &&
                isUserRole &&
                isAssignedToCurrentUser &&
                !isCompleted && (
                  <form
                    onSubmit={handleSubmitIncompleteReason}
                    className="p-4 bg-purple-50/50 border border-[#dfcadf] rounded-lg space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="task-incomplete-reason"
                        className="text-xs font-semibold text-[#71347b] flex items-center gap-1.5"
                      >
                        <AlertCircle className="w-3.5 h-3.5 text-[#71347b]" />
                        Provide Reason for Incompletion <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowReasonForm(false);
                          setReasonError(null);
                        }}
                        className="text-xs text-neutral-500 hover:text-neutral-700 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>

                    <textarea
                      id="task-incomplete-reason"
                      rows={3}
                      value={reasonText}
                      onChange={(e) => {
                        setReasonText(e.target.value);
                        if (reasonError) setReasonError(null);
                      }}
                      placeholder="Explain the impediment, dependencies, or blockers preventing completion by the deadline..."
                      className="w-full p-2.5 text-xs bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#71347b] focus:border-[#71347b]"
                    />

                    {reasonError && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {reasonError}
                      </p>
                    )}

                    <div className="flex justify-end gap-2">
                      <button
                        type="submit"
                        disabled={isSubmittingReason}
                        className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#71347b] hover:bg-[#5d2a65] rounded-md transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        {isSubmittingReason
                          ? 'Submitting Reason...'
                          : 'Submit Reason & Carry Forward'}
                      </button>
                    </div>
                  </form>
                )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 transition-colors cursor-pointer"
          >
            Close
          </button>

          {/* MANAGER ACTIONS: Edit Task and Delete Completed Task */}
          {isManager && !isEditing && (
            <div className="flex items-center gap-2">
              {/* Only completed tasks can be deleted by manager */}
              {isCompleted && (
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(true)}
                  className="px-3.5 py-2 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Permanently delete completed task"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Completed Task</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 text-xs font-medium text-white bg-[#71347b] hover:bg-[#5d2a65] rounded-md transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                title="Edit task details or reassign"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Task</span>
              </button>
            </div>
          )}

          {/* USER ACTIONS: Mark as Completed (ONLY IF allowCompletion === true, from My Tasks) */}
          {allowCompletion &&
            isUserRole &&
            isAssignedToCurrentUser &&
            !isCompleted &&
            !showReasonForm && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowReasonForm(true)}
                  className="px-3.5 py-2 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-md transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  Unable to Complete (Add Reason)
                </button>

                <button
                  type="button"
                  onClick={() => setShowConfirmComplete(true)}
                  disabled={isProcessing}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-md transition-colors shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Mark as Completed
                </button>
              </div>
            )}
        </div>
      </div>

      {/* Confirmation Dialog: Mark as Completed (User) */}
      <ConfirmDialog
        isOpen={showConfirmComplete}
        title="Mark Task as Completed"
        message="Are you sure you want to mark this task as completed?"
        taskTitle={task.title}
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        confirmVariant="emerald"
        isLoading={isProcessing}
        onConfirm={handleConfirmMarkCompleted}
        onCancel={() => setShowConfirmComplete(false)}
      />

      {/* Confirmation Dialog: Delete Completed Task (Manager) */}
      <ConfirmDialog
        isOpen={showConfirmDelete}
        title="Delete Completed Task"
        message="Are you sure you want to permanently delete this completed task? This action cannot be undone."
        taskTitle={task.title}
        confirmLabel="Delete Task"
        cancelLabel="Cancel"
        confirmVariant="danger"
        isLoading={isDeletingTask}
        onConfirm={handleConfirmDeleteCompletedTask}
        onCancel={() => setShowConfirmDelete(false)}
      />
    </div>
  );
};
