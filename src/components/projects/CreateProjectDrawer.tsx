import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { projectService } from '../../services/projectService';
import { useToast } from '../../context/ToastContext';
import { SideDrawer } from '../common/SideDrawer';

interface CreateProjectDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated?: () => void;
}

export const CreateProjectDrawer: React.FC<CreateProjectDrawerProps> = ({
  isOpen,
  onClose,
  onProjectCreated,
}) => {
  const { showSuccess, showError, showWarning } = useToast();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [status, setStatus] = useState<'active' | 'in_progress' | 'completed' | 'on_hold'>('active');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!name.trim()) {
      setError('Project Name is required.');
      showError('Project Name is required.');
      return;
    }
    if (!code.trim()) {
      setError('Project Code identifier is required.');
      showError('Project Code identifier is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await projectService.createProject({
      name,
      code,
      description,
      deadline: deadline || undefined,
      status,
    });

    if (result.success) {
      const createdProjectName = name.trim();
      setIsSubmitting(false);
      handleClose();
      if (onProjectCreated) onProjectCreated();
      showSuccess(`${createdProjectName} project created successfully.`);
    } else {
      setIsSubmitting(false);
      const errMsg = result.error || 'Failed to create project.';
      setError(errMsg);
      if (errMsg.includes('already exists')) {
        showWarning(errMsg, 'Project Conflict');
      } else {
        showError(errMsg);
      }
    }
  };

  const handleClose = () => {
    setName('');
    setCode('');
    setDescription('');
    setDeadline('');
    setStatus('active');
    setError(null);
    setIsSubmitting(false);
    onClose();
  };

  const footerActions = (
    <>
      <button
        type="button"
        onClick={handleClose}
        disabled={isSubmitting}
        className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-[#71347b] transition-colors"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="px-4 py-2 text-sm font-medium text-white bg-[#71347b] hover:bg-[#5d2a65] active:bg-[#4b2152] rounded-md focus-visible:outline-2 focus-visible:outline-[#71347b] transition-colors shadow-xs disabled:opacity-50"
      >
        {isSubmitting ? 'Creating...' : 'Create Project'}
      </button>
    </>
  );

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Project"
      subtitle="Define project scope, key milestones, and deliverables."
      footer={footerActions}
      maxWidth="max-w-[666px]"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Project Name */}
        <div>
          <label htmlFor="proj-name" className="block text-xs font-semibold text-neutral-700 mb-1">
            Project Name <span className="text-red-500">*</span>
          </label>
          <input
            id="proj-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. Mobile Application v2"
            className="w-full px-3 py-2 text-sm bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#71347b] focus:border-[#71347b] transition-colors"
          />
        </div>

        {/* Project Code */}
        <div>
          <label htmlFor="proj-code" className="block text-xs font-semibold text-neutral-700 mb-1">
            Project Code Identifier <span className="text-red-500">*</span>
          </label>
          <input
            id="proj-code"
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. MOB-V2"
            className="w-full px-3 py-2 text-sm bg-white border border-neutral-300 rounded-md uppercase focus:outline-none focus:ring-1 focus:ring-[#71347b] focus:border-[#71347b] transition-colors"
          />
        </div>

        {/* Deadline */}
        <div>
          <label htmlFor="proj-deadline" className="block text-xs font-semibold text-neutral-700 mb-1">
            Target Completion Deadline
          </label>
          <input
            id="proj-deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#71347b] focus:border-[#71347b] transition-colors"
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="proj-desc" className="block text-xs font-semibold text-neutral-700 mb-1">
            Project Description
          </label>
          <textarea
            id="proj-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Summarize objectives, requirements, and deliverables..."
            className="w-full px-3 py-2 text-sm bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#71347b] focus:border-[#71347b] transition-colors resize-none"
          />
        </div>

        {/* Status */}
        <div>
          <label htmlFor="proj-status" className="block text-xs font-semibold text-neutral-700 mb-1">
            Project Status
          </label>
          <select
            id="proj-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="w-full px-3 py-2 text-sm bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#71347b] focus:border-[#71347b] transition-colors"
          >
            <option value="active">Active</option>
            <option value="in_progress">In Progress</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </form>
    </SideDrawer>
  );
};
