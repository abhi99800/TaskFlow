import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Clock,
  AlertCircle,
  Briefcase,
  Users,
  CheckSquare,
  TrendingUp,
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { taskService } from '../../services/taskService';
import { projectService, ProjectRecord } from '../../services/projectService';
import { Task } from '../../types';

export const ReportsPage: React.FC = () => {
  const { selectedProjectId, selectedProject, setSelectedProjectId, projects } = useProject();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadReportData = async () => {
    setIsLoading(true);
    try {
      const res = await taskService.fetchTasks();
      if (res.success) {
        setTasks(res.tasks);
        setFetchError(null);
      } else {
        setTasks(await taskService.getTasks());
        setFetchError(res.error || null);
      }
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
    const unsub = taskService.subscribe(loadReportData);
    return () => unsub();
  }, []);

  // Filter tasks based on selected project mode
  const filteredTasks =
    selectedProjectId === 'all'
      ? tasks
      : tasks.filter((t) => t.projectId === selectedProjectId);

  const total = filteredTasks.length;
  const completed = filteredTasks.filter((t) => t.status === 'completed').length;
  const inProgress = filteredTasks.filter((t) => t.status === 'in_progress').length;
  const pending = filteredTasks.filter((t) => t.status === 'pending').length;
  const notCompleted = filteredTasks.filter((t) => t.status === 'not_completed' || t.isCarriedForward).length;

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Project-wise breakdown for All Projects mode
  const projectBreakdown = projects.map((proj) => {
    const projTasks = tasks.filter((t) => t.projectId === proj.id);
    const pTotal = projTasks.length;
    const pComp = projTasks.filter((t) => t.status === 'completed').length;
    const pRate = pTotal > 0 ? Math.round((pComp / pTotal) * 100) : 0;
    return {
      project: proj,
      total: pTotal,
      completed: pComp,
      pending: pTotal - pComp,
      rate: pRate,
    };
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            {selectedProjectId === 'all' ? 'Consolidated Reports & Analytics' : `Project Report: ${selectedProject?.name}`}
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {selectedProjectId === 'all'
              ? 'Performance metrics, completion velocity, and workload distribution across all workspace projects.'
              : `Deliverable metrics, completion status, and execution analytics for ${selectedProject?.code}.`}
          </p>
        </div>

        {selectedProjectId !== 'all' && (
          <button
            type="button"
            onClick={() => setSelectedProjectId('all')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#71347b] bg-[#f5eff7] hover:bg-[#ebd5ef] border border-[#dfcadf] rounded-md transition-colors cursor-pointer"
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Switch to All Projects Report</span>
          </button>
        )}
      </div>

      {fetchError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-neutral-200 shadow-xs">
          <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1">
            Total Deliverables
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-neutral-900">{total}</span>
            <CheckSquare className="w-5 h-5 text-[#71347b] opacity-80" />
          </div>
          <span className="text-xs text-neutral-400 mt-2 block">
            {selectedProjectId === 'all' ? 'Across all workspace projects' : 'Assigned to selected project'}
          </span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-neutral-200 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider block mb-1">
            Completion Rate
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-emerald-700">{completionRate}%</span>
            <TrendingUp className="w-5 h-5 text-emerald-600 opacity-80" />
          </div>
          <span className="text-xs text-neutral-400 mt-2 block">
            {completed} of {total} tasks verified complete
          </span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-neutral-200 shadow-xs">
          <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider block mb-1">
            Active / In Progress
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-blue-700">{inProgress + pending}</span>
            <Clock className="w-5 h-5 text-blue-600 opacity-80" />
          </div>
          <span className="text-xs text-neutral-400 mt-2 block">
            {inProgress} active, {pending} pending
          </span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-neutral-200 shadow-xs">
          <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider block mb-1">
            Incomplete / Overdue
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-amber-700">{notCompleted}</span>
            <AlertCircle className="w-5 h-5 text-amber-600 opacity-80" />
          </div>
          <span className="text-xs text-neutral-400 mt-2 block">Carried forward deliverables</span>
        </div>
      </div>

      {/* Project-wise Breakdown (Shown in All Projects mode) */}
      {selectedProjectId === 'all' && (
        <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-bold text-neutral-900">Project-Wise Progress Breakdown</h2>
            <p className="text-xs text-neutral-500">Comparative completion velocity across all portfolio projects.</p>
          </div>

          <div className="space-y-3">
            {projectBreakdown.map((item) => (
              <div key={item.project.id} className="p-3.5 bg-neutral-50 rounded-lg border border-neutral-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-[#f5eff7] text-[#71347b] border border-[#dfcadf] rounded">
                      {item.project.code}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedProjectId(item.project.id)}
                      className="text-xs font-bold text-neutral-900 hover:text-[#71347b] hover:underline cursor-pointer"
                    >
                      {item.project.name}
                    </button>
                  </div>
                  <span className="text-xs font-mono font-semibold text-neutral-700">
                    {item.completed} / {item.total} completed ({item.rate}%)
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#71347b] rounded-full transition-all duration-500"
                    style={{ width: `${item.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
