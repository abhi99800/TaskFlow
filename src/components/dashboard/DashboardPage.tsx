import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Clock,
  Loader2,
  CheckCircle2,
  Calendar,
  Filter,
  ChevronDown,
} from 'lucide-react';
import { SummaryCard } from '../common/SummaryCard';
import { TaskOverviewTable } from './TaskOverviewTable';
import { UpcomingDeadlines } from './UpcomingDeadlines';
import { ViewStateMode, Task, UpcomingDeadlineItem } from '../../types';
import { taskService } from '../../services/taskService';
import { useAuth } from '../../context/AuthContext';
import { useProject } from '../../context/ProjectContext';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { projects, selectedProjectId, setSelectedProjectId } = useProject();
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [selectedDateFilter, setSelectedDateFilter] = useState('all');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<UpcomingDeadlineItem[]>([]);

  const isUserRole = user?.role === 'user';
  const viewState: ViewStateMode = isLoading ? 'loading' : hasError ? 'error' : 'empty';

  const loadData = async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      let taskList: Task[] = [];
      if (isUserRole) {
        taskList = await taskService.getTasksForUser(user);
      } else {
        taskList = await taskService.getTasks();
      }

      if (selectedProjectId !== 'all') {
        taskList = taskList.filter((t) => t.projectId === selectedProjectId);
      }

      // Apply date filter if specified
      if (selectedDateFilter !== 'all') {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

        if (selectedDateFilter === 'today') {
          taskList = taskList.filter((t) => {
            const dueTime = new Date(t.endDate || t.deadline || t.startDate).getTime();
            return dueTime >= startOfToday && dueTime <= endOfToday;
          });
        } else if (selectedDateFilter === 'week') {
          const oneWeekLater = startOfToday + 7 * 24 * 60 * 60 * 1000;
          taskList = taskList.filter((t) => {
            const dueTime = new Date(t.endDate || t.deadline || t.startDate).getTime();
            return dueTime >= startOfToday && dueTime <= oneWeekLater;
          });
        } else if (selectedDateFilter === 'month') {
          const oneMonthLater = startOfToday + 30 * 24 * 60 * 60 * 1000;
          taskList = taskList.filter((t) => {
            const dueTime = new Date(t.endDate || t.deadline || t.startDate).getTime();
            return dueTime >= startOfToday && dueTime <= oneMonthLater;
          });
        }
      }

      setTasks(taskList);

      const deadlines = await taskService.getUpcomingDeadlines();
      let filteredDeadlines = deadlines;
      if (selectedProjectId !== 'all') {
        const matchingTaskTitles = new Set(taskList.map((t) => t.title));
        filteredDeadlines = filteredDeadlines.filter((d) => matchingTaskTitles.has(d.taskTitle));
      }
      if (isUserRole) {
        const userTasksIds = new Set(taskList.map((t) => `dl-${t.id}`));
        filteredDeadlines = filteredDeadlines.filter((d) => userTasksIds.has(d.id));
      }
      setUpcomingDeadlines(filteredDeadlines);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = taskService.subscribe(loadData);
    return () => unsub();
  }, [user, selectedProjectId, selectedDateFilter]);

  // Compute live metrics
  const totalTasks = tasks.length;
  const pendingTasks = tasks.filter((t) => t.status === 'pending').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-4 sm:space-y-5 w-full">
      {/* Page Heading & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2.5 border-b border-neutral-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            {isUserRole ? 'User Dashboard' : 'Manager Operations Dashboard'}
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {isUserRole
              ? `Deliverables queue and deadline tracking for ${user?.fullName || 'User'}.`
              : 'Enterprise task delegation, workflow status, and deliverable accountability.'}
          </p>
        </div>

        {/* Filter Area */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Project Filter */}
          <div className="relative">
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:border-[#71347b] transition-colors shadow-xs">
              <Filter className="w-3.5 h-3.5 text-neutral-400" aria-hidden="true" />
              <select
                id="project-filter-select"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="bg-transparent text-xs text-neutral-800 font-medium focus:outline-none cursor-pointer pr-1"
              >
                <option value="all">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400" aria-hidden="true" />
            </div>
          </div>

          {/* Date Filter */}
          <div className="relative">
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:border-[#71347b] transition-colors shadow-xs">
              <Calendar className="w-3.5 h-3.5 text-neutral-400" aria-hidden="true" />
              <select
                id="date-filter-select"
                value={selectedDateFilter}
                onChange={(e) => setSelectedDateFilter(e.target.value)}
                className="bg-transparent text-xs text-neutral-800 font-medium focus:outline-none cursor-pointer pr-1"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>

      {/* 4 Summary Cards Section */}
      <section aria-labelledby="summary-cards-heading">
        <h2 id="summary-cards-heading" className="sr-only">
          Task Summary Counters
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Tasks */}
          <SummaryCard
            label="Total Tasks"
            count={viewState === 'empty' ? totalTasks : null}
            icon={CheckSquare}
            statusColor="brand"
            sublabel="Scheduled deliverables"
            isLoading={viewState === 'loading'}
          />

          {/* 2. Pending Tasks */}
          <SummaryCard
            label="Pending Tasks"
            count={viewState === 'empty' ? pendingTasks : null}
            icon={Clock}
            statusColor="amber"
            sublabel="Awaiting commencement"
            isLoading={viewState === 'loading'}
          />

          {/* 3. In Progress */}
          <SummaryCard
            label="In Progress"
            count={viewState === 'empty' ? inProgressTasks : null}
            icon={Loader2}
            statusColor="blue"
            sublabel="Active execution"
            isLoading={viewState === 'loading'}
          />

          {/* 4. Completed */}
          <SummaryCard
            label="Completed"
            count={viewState === 'empty' ? completedTasks : null}
            icon={CheckCircle2}
            statusColor="emerald"
            sublabel="Verified deliverables"
            isLoading={viewState === 'loading'}
          />
        </div>
      </section>

      {/* Deliverable Completion Progress Bar */}
      {totalTasks > 0 && (
        <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-700">
                Overall Progress
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {completionPercentage}% Completed
              </span>
            </div>
            <span className="text-xs text-neutral-500 font-mono">
              {completedTasks} of {totalTasks} deliverables complete
            </span>
          </div>
          <div className="w-full bg-neutral-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Content Grid: Task Overview + Upcoming Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2">
          <TaskOverviewTable
            tasks={tasks}
            isLoading={isLoading}
            hasError={hasError}
            onRetry={loadData}
            onTaskUpdated={loadData}
          />
        </div>

        <div className="lg:col-span-1">
          <UpcomingDeadlines
            items={upcomingDeadlines}
            isLoading={isLoading}
            hasError={hasError}
          />
        </div>
      </div>
    </div>
  );
};
