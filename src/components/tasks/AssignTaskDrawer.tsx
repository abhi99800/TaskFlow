import React, { useState, useEffect } from 'react';
import { AlertCircle, Clock, Calendar, CheckCircle2, UserCheck, AlertTriangle } from 'lucide-react';
import { taskService } from '../../services/taskService';
import { projectService, ProjectRecord } from '../../services/projectService';
import { teamService } from '../../services/teamService';
import { userService } from '../../services/userService';
import { TaskPriority, ManagedUser } from '../../types';
import { useToast } from '../../context/ToastContext';
import { useProject } from '../../context/ProjectContext';
import { SideDrawer } from '../common/SideDrawer';

interface AssignTaskDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskAssigned?: () => void;
}

function formatDateTimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export const AssignTaskDrawer: React.FC<AssignTaskDrawerProps> = ({
  isOpen,
  onClose,
  onTaskAssigned,
}) => {
  const { showSuccess, showError, showWarning } = useToast();
  const { selectedProjectId, projects } = useProject();

  const isIndividualMode = selectedProjectId !== 'all';

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [projectId, setProjectId] = useState<string>(isIndividualMode ? selectedProjectId : '');

  const [availableProjects, setAvailableProjects] = useState<ProjectRecord[]>(projects);
  const [availableUsers, setAvailableUsers] = useState<ManagedUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Validation errors map
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    description?: string;
    projectId?: string;
    assignedToUserId?: string;
    startDate?: string;
    endDate?: string;
  }>({});

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load projects and users on open / project change
  useEffect(() => {
    if (!isOpen) return;

    projectService.fetchProjects().then((res) => {
      if (res.success) {
        setAvailableProjects(res.projects);
      } else {
        setAvailableProjects(projectService.getProjects());
      }
    });

    if (isIndividualMode) {
      setProjectId(selectedProjectId);
    } else if (!projectId && availableProjects.length > 0) {
      // default to empty in All Projects mode until user selects project
      setProjectId('');
    }

    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0);
    const later = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    if (!startDate) setStartDate(formatDateTimeLocal(now));
    if (!endDate) setEndDate(formatDateTimeLocal(later));
  }, [isOpen, selectedProjectId, isIndividualMode]);

  // Fetch available users based on project selection
  useEffect(() => {
    let isMounted = true;
    const loadUsers = async () => {
      setIsLoadingUsers(true);

      if (!projectId || projectId === 'all') {
        // In All Projects mode: show all active users
        const res = await userService.fetchActiveUsers();
        if (isMounted) {
          setIsLoadingUsers(false);
          if (res.success) {
            setAvailableUsers(res.users);
          } else {
            setAvailableUsers(userService.getActiveUsers());
          }
        }
      } else {
        // Individual project mode: show only active users assigned to that project
        const res = await teamService.fetchTeamMembers(projectId);
        if (isMounted) {
          setIsLoadingUsers(false);
          if (res.success) {
            const activeProjectUsers: ManagedUser[] = res.members
              .filter((m) => m.status.toLowerCase() === 'active')
              .map((m) => ({
                id: m.userId,
                fullName: m.name,
                email: m.email,
                phoneNumber: m.phoneNumber || '',
                roleId: m.roleId,
                roleName: m.roleName,
                status: m.status,
                createdAt: m.createdAt,
              }));
            setAvailableUsers(activeProjectUsers);
            setAssignedToUserId((prev) => {
              const stillValid = activeProjectUsers.some((u) => u.id === prev);
              return stillValid ? prev : '';
            });
          } else {
            setAvailableUsers([]);
            setAssignedToUserId('');
          }
        }
      }
    };

    loadUsers();

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  const validateFields = () => {
    const errors: typeof fieldErrors = {};

    if (!title.trim()) {
      errors.title = 'Task Title is required.';
    }

    if (!description.trim()) {
      errors.description = 'Task Description is required.';
    }

    if (!projectId) {
      errors.projectId = 'Please select a project.';
    }

    if (!assignedToUserId) {
      errors.assignedToUserId = 'Please select an eligible active user assigned to this project.';
    }

    if (!startDate) {
      errors.startDate = 'Start date and time is required.';
    }

    if (!endDate) {
      errors.endDate = 'End date and time / deadline is required.';
    } else if (startDate) {
      const startTime = new Date(startDate).getTime();
      const endTime = new Date(endDate).getTime();
      if (isNaN(startTime) || isNaN(endTime)) {
        errors.endDate = 'Invalid date and time entered.';
      } else if (endTime <= startTime) {
        errors.endDate = 'The end date and time must be later than the start date and time.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setFormError(null);

    const isValid = validateFields();
    if (!isValid) {
      showError('Please resolve the highlighted field errors before assigning.');
      return;
    }

    const selectedUser = availableUsers.find((u) => u.id === assignedToUserId);
    if (!selectedUser) {
      setFieldErrors((prev) => ({
        ...prev,
        assignedToUserId: 'Selected user is not associated with this project.',
      }));
      showError('Selected user is not associated with this project.');
      return;
    }

    const selectedProj = availableProjects.find((p) => p.id === projectId);

    setIsSubmitting(true);

    const result = await taskService.createTask({
      title,
      description,
      assignedToUserId: selectedUser.id,
      startDate,
      endDate,
      priority,
      projectId: selectedProj?.id,
      projectName: selectedProj?.name || 'General Project',
    });

    if (result.success) {
      setIsSubmitting(false);
      showSuccess(`${title.trim()} assigned to ${selectedUser.fullName} successfully.`);

      resetForm();
      onClose();
      if (onTaskAssigned) onTaskAssigned();
    } else {
      setIsSubmitting(false);
      const errMsg = result.error || 'Failed to create and assign task.';
      setFormError(errMsg);
      if (errMsg.includes('already exists') || errMsg.includes('already assigned')) {
        showWarning(errMsg, 'Task Conflict');
      } else {
        showError(errMsg);
      }
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setAssignedToUserId('');
    setStartDate('');
    setEndDate('');
    setPriority('medium');
    setFieldErrors({});
    setFormError(null);
    setIsSubmitting(false);
  };

  const handleCancel = () => {
    resetForm();
    onClose();
  };

  const footerActions = (
    <div className="flex items-center justify-end gap-3 w-full">
      <button
        type="button"
        onClick={handleCancel}
        disabled={isSubmitting}
        className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-[#71347b] transition-colors cursor-pointer"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting || !projectId || !assignedToUserId}
        className="px-5 py-2 text-sm font-medium text-white bg-[#71347b] hover:bg-[#5d2a65] active:bg-[#4b2152] rounded-md focus-visible:outline-2 focus-visible:outline-[#71347b] transition-colors shadow-xs disabled:opacity-50 flex items-center gap-2 cursor-pointer"
      >
        {isSubmitting ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Assigning Task...</span>
          </>
        ) : (
          <span>Assign Task</span>
        )}
      </button>
    </div>
  );

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={handleCancel}
      title="Create & Assign Task"
      subtitle="Define task parameters, designate an active project-associated assignee, and establish deadlines."
      footer={footerActions}
      maxWidth="max-w-[666px]"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {formError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2.5 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Assignment Failed</p>
              <p>{formError}</p>
            </div>
          </div>
        )}

        {/* Project Context */}
        <div>
          <label htmlFor="assign-task-project" className="block text-xs font-semibold text-neutral-700 mb-1">
            Associated Project <span className="text-red-500">*</span>
          </label>
          <select
            id="assign-task-project"
            value={projectId}
            disabled={isIndividualMode}
            onChange={(e) => {
              setProjectId(e.target.value);
              if (fieldErrors.projectId) {
                setFieldErrors((prev) => ({ ...prev, projectId: undefined }));
              }
            }}
            className={`w-full px-3 py-2 text-sm bg-white border rounded-md focus:outline-none focus:ring-1 focus:ring-[#71347b] transition-colors cursor-pointer ${
              isIndividualMode ? 'bg-neutral-100 text-neutral-700 cursor-not-allowed' : 'border-neutral-300'
            } ${fieldErrors.projectId ? 'border-red-400' : ''}`}
          >
            <option value="">-- Select Project --</option>
            {availableProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
          {isIndividualMode && (
            <p className="mt-1 text-[11px] text-neutral-500">
              Project is locked to the currently selected individual project context.
            </p>
          )}
          {fieldErrors.projectId && (
            <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{fieldErrors.projectId}</span>
            </p>
          )}
        </div>

        {/* Task Title */}
        <div>
          <label htmlFor="assign-task-title" className="block text-xs font-semibold text-neutral-700 mb-1">
            Task Title <span className="text-red-500">*</span>
          </label>
          <input
            id="assign-task-title"
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (fieldErrors.title) {
                setFieldErrors((prev) => ({ ...prev, title: undefined }));
              }
            }}
            placeholder="e.g. Implement Role-Based Access Control and API validation"
            className={`w-full px-3 py-2 text-sm bg-white border rounded-md focus:outline-none focus:ring-1 focus:ring-[#71347b] transition-colors ${
              fieldErrors.title ? 'border-red-400 bg-red-50/20' : 'border-neutral-300'
            }`}
          />
          {fieldErrors.title && (
            <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{fieldErrors.title}</span>
            </p>
          )}
        </div>

        {/* Task Description */}
        <div>
          <label htmlFor="assign-task-desc" className="block text-xs font-semibold text-neutral-700 mb-1">
            Task Description <span className="text-red-500">*</span>
          </label>
          <textarea
            id="assign-task-desc"
            rows={3}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (fieldErrors.description) {
                setFieldErrors((prev) => ({ ...prev, description: undefined }));
              }
            }}
            placeholder="Provide comprehensive details, acceptance criteria, prerequisites, and expected deliverables..."
            className={`w-full px-3 py-2 text-sm bg-white border rounded-md focus:outline-none focus:ring-1 focus:ring-[#71347b] transition-colors resize-y ${
              fieldErrors.description ? 'border-red-400 bg-red-50/20' : 'border-neutral-300'
            }`}
          />
          {fieldErrors.description && (
            <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{fieldErrors.description}</span>
            </p>
          )}
        </div>

        {/* Assign To (Project-associated active user accounts) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="assign-task-user" className="text-xs font-semibold text-neutral-700">
              Assign To <span className="text-red-500">*</span>
            </label>
            <span className="text-[11px] text-neutral-400">
              {isLoadingUsers ? 'Loading members...' : `${availableUsers.length} eligible members`}
            </span>
          </div>
          <select
            id="assign-task-user"
            value={assignedToUserId}
            disabled={isLoadingUsers || availableUsers.length === 0}
            onChange={(e) => {
              setAssignedToUserId(e.target.value);
              if (fieldErrors.assignedToUserId) {
                setFieldErrors((prev) => ({ ...prev, assignedToUserId: undefined }));
              }
            }}
            className={`w-full px-3 py-2 text-sm bg-white border rounded-md focus:outline-none focus:ring-1 focus:ring-[#71347b] transition-colors cursor-pointer ${
              isLoadingUsers || availableUsers.length === 0 ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed' : 'border-neutral-300'
            } ${fieldErrors.assignedToUserId ? 'border-red-400 bg-red-50/20' : ''}`}
          >
            {isLoadingUsers ? (
              <option value="">Loading eligible members...</option>
            ) : availableUsers.length === 0 ? (
              <option value="">
                {projectId
                  ? 'No active users are assigned to this project. Add users from User Management first.'
                  : 'No active users found.'}
              </option>
            ) : (
              <option value="">
                {projectId ? '-- Select Project Member --' : '-- Select Team Member --'}
              </option>
            )}

            {availableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} ({u.email}) — {u.roleName}
              </option>
            ))}
          </select>
          {projectId && !isLoadingUsers && availableUsers.length === 0 && (
            <p className="mt-1 text-xs text-amber-700 font-medium">
              No active users are assigned to this project. Add users from User Management first.
            </p>
          )}
          {fieldErrors.assignedToUserId && (
            <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{fieldErrors.assignedToUserId}</span>
            </p>
          )}
        </div>

        {/* Start Date & Time and End Date & Time / Deadline */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="assign-task-start" className="block text-xs font-semibold text-neutral-700 mb-1">
              Start Date & Time <span className="text-red-500">*</span>
            </label>
            <input
              id="assign-task-start"
              type="datetime-local"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (fieldErrors.startDate) {
                  setFieldErrors((prev) => ({ ...prev, startDate: undefined }));
                }
              }}
              className={`w-full px-3 py-2 text-sm bg-white border rounded-md focus:outline-none focus:ring-1 focus:ring-[#71347b] transition-colors ${
                fieldErrors.startDate ? 'border-red-400 bg-red-50/20' : 'border-neutral-300'
              }`}
            />
            {fieldErrors.startDate && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{fieldErrors.startDate}</span>
              </p>
            )}
          </div>

          <div>
            <label htmlFor="assign-task-end" className="block text-xs font-semibold text-neutral-700 mb-1">
              End Date & Time / Deadline <span className="text-red-500">*</span>
            </label>
            <input
              id="assign-task-end"
              type="datetime-local"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                if (fieldErrors.endDate) {
                  setFieldErrors((prev) => ({ ...prev, endDate: undefined }));
                }
              }}
              className={`w-full px-3 py-2 text-sm bg-white border rounded-md focus:outline-none focus:ring-1 focus:ring-[#71347b] transition-colors ${
                fieldErrors.endDate ? 'border-red-400 bg-red-50/20' : 'border-neutral-300'
              }`}
            />
            {fieldErrors.endDate && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{fieldErrors.endDate}</span>
              </p>
            )}
          </div>
        </div>

        {/* Priority Selection */}
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-2">
            Task Priority
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {(
              [
                { id: 'high', label: 'High Priority', color: 'border-red-300 bg-red-50/50 text-red-700' },
                { id: 'medium', label: 'Medium Priority', color: 'border-blue-300 bg-blue-50/50 text-blue-700' },
                { id: 'low', label: 'Low Priority', color: 'border-neutral-300 bg-neutral-50 text-neutral-700' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPriority(opt.id)}
                className={`py-2 px-3 text-xs font-medium rounded-md border text-center transition-all cursor-pointer ${
                  priority === opt.id
                    ? `${opt.color} font-semibold ring-2 ring-[#71347b] border-transparent shadow-xs`
                    : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Helpful Info banner */}
        <div className="p-3 bg-[#f5eff7] border border-[#dfcadf] rounded-md text-xs text-[#71347b] flex items-start gap-2">
          <Clock className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Tasks are scheduled chronologically. Incomplete deliverables automatically carry forward to subsequent working days until completed or marked with a reason.
          </span>
        </div>
      </form>
    </SideDrawer>
  );
};
