import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { ProjectTeamMember } from '../../services/teamService';

interface RemoveMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  member: ProjectTeamMember | null;
  projectName: string;
}

export const RemoveMemberModal: React.FC<RemoveMemberModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  member,
  projectName,
}) => {
  if (!isOpen || !member) return null;

  const hasTasks = member.assignedTasksCount > 0;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-neutral-950/50 backdrop-blur-xs animate-in fade-in-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden border border-neutral-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h3 id="modal-title" className="text-base font-semibold text-neutral-900">
              Remove Team Member
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-700 rounded-md transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3">
          <p className="text-sm text-neutral-700 leading-relaxed">
            Are you sure you want to remove <strong className="text-neutral-900">{member.name}</strong> ({member.email}) from project <strong className="text-neutral-900">{projectName}</strong>?
          </p>

          {hasTasks ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>Task Assignment Warning</span>
              </p>
              <p className="leading-relaxed">
                This user currently has <strong className="font-semibold">{member.assignedTasksCount} assigned task(s)</strong> ({member.pendingTasksCount} pending, {member.completedTasksCount} completed) in this project. Removing this member will not delete or silently reassign their task history, but they will no longer be listed on the project roster.
              </p>
            </div>
          ) : (
            <p className="text-xs text-neutral-500">
              This user has no assigned tasks in this project. Their application account and credentials will remain fully intact.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-100 rounded-md transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors shadow-xs cursor-pointer"
          >
            Remove Member
          </button>
        </div>
      </div>
    </div>
  );
};
