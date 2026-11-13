import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Plus,
  Briefcase,
  Shield,
  Trash2,
  ChevronRight,
  ChevronDown,
  FolderKanban,
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { projectService, ProjectRecord } from '../../services/projectService';
import { teamService, ProjectTeamMember } from '../../services/teamService';
import { taskService } from '../../services/taskService';
import { AddTeamMembersDrawer } from './AddTeamMembersDrawer';
import { RemoveMemberModal } from './RemoveMemberModal';

interface ProjectTreeNode {
  project: ProjectRecord;
  members: ProjectTeamMember[];
  completedCount: number;
  pendingCount: number;
  upcomingCount: number;
}

export const TeamMembersPage: React.FC = () => {
  const { selectedProjectId, selectedProject, setSelectedProjectId, projects, refreshProjects } = useProject();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const isManager = user?.role === 'manager';

  const [treeNodes, setTreeNodes] = useState<ProjectTreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Independent expand/collapse state tracked per project ID (default to expanded)
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

  const loadTreeData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Ensure projects are fresh
      await projectService.fetchProjects();
      const allProjects = projectService.getProjects();

      let targetProjects =
        selectedProjectId === 'all'
          ? allProjects
          : allProjects.filter((p) => p.id === selectedProjectId);

      // RESTRICT REGULAR USERS TO AUTHORIZED PROJECTS ONLY:
      if (!isManager && user) {
        const userProjectIds = await teamService.getUserProjectIds(user.id, user.email);
        targetProjects = targetProjects.filter((p) => userProjectIds.includes(p.id));
      }

      const nodes: ProjectTreeNode[] = [];

      for (const proj of targetProjects) {
        // Fetch real team members from database / teamService
        const teamRes = await teamService.fetchTeamMembers(proj.id);
        const members = teamRes.success ? teamRes.members : [];

        // Fetch actual tasks for project
        const tasks = await taskService.getTasks({ projectId: proj.id });

        let completed = 0;
        let pending = 0;
        let upcoming = 0;

        const now = new Date();
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        // Compute member task breakdown counts
        for (const m of members) {
          const userTasks = tasks.filter((t) => t.assignedToUserId === m.userId);
          let mComp = 0;
          let mPend = 0;
          let mUp = 0;

          for (const t of userTasks) {
            if (t.status === 'completed') {
              mComp++;
            } else {
              const due = new Date(t.endDate || t.deadline || t.startDate);
              if (due.getTime() > todayEnd.getTime()) {
                mUp++;
              } else {
                mPend++;
              }
            }
          }

          m.completedTasksCount = mComp;
          m.pendingTasksCount = mPend;
          m.assignedTasksCount = userTasks.length;
        }

        for (const t of tasks) {
          if (t.status === 'completed') {
            completed++;
          } else {
            const due = new Date(t.endDate || t.deadline || t.startDate);
            if (due.getTime() > todayEnd.getTime()) {
              upcoming++;
            } else {
              pending++;
            }
          }
        }

        nodes.push({
          project: proj,
          members,
          completedCount: completed,
          pendingCount: pending,
          upcomingCount: upcoming,
        });
      }

      setTreeNodes(nodes);
    } catch (err) {
      console.error('Error loading team tree data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedProjectId, isManager, user]);

  useEffect(() => {
    loadTreeData();
    const unsubTeam = teamService.subscribe(loadTreeData);
    const unsubTask = taskService.subscribe(loadTreeData);
    const unsubProj = projectService.subscribe(loadTreeData);
    return () => {
      unsubTeam();
      unsubTask();
      unsubProj();
    };
  }, [loadTreeData]);

  const toggleExpandProject = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedMap((prev) => {
      const current = prev[projectId] !== undefined ? prev[projectId] : true;
      return {
        ...prev,
        [projectId]: !current,
      };
    });
  };

  // Drawer and Modal state
  const [activeDrawerProject, setActiveDrawerProject] = useState<{ id: string; name: string } | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<{ member: ProjectTeamMember; projectName: string } | null>(null);

  const handleRemoveConfirm = async () => {
    if (!memberToRemove) return;
    const { member, projectName } = memberToRemove;
    const res = await teamService.removeTeamMember(member.projectId, member.userId);
    if (res.success) {
      showSuccess(`Successfully removed ${member.name} from ${projectName}.`, 'Member Removed');
      setMemberToRemove(null);
      loadTreeData();
    } else {
      showError(res.error || 'Failed to remove team member.', 'Error');
    }
  };

  // Filter tree nodes and members by search query
  const filteredTreeNodes = treeNodes
    .map((node) => {
      const query = searchQuery.toLowerCase().trim();
      if (!query) return node;

      const matchesProject =
        node.project.name.toLowerCase().includes(query) ||
        node.project.code.toLowerCase().includes(query);

      const matchingMembers = node.members.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.email.toLowerCase().includes(query) ||
          m.roleName.toLowerCase().includes(query)
      );

      if (matchesProject || matchingMembers.length > 0) {
        return {
          ...node,
          members: matchesProject ? node.members : matchingMembers,
        };
      }
      return null;
    })
    .filter(Boolean) as ProjectTreeNode[];

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Team Members Tree Roster
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Hierarchical view of authorized projects and assigned team members with task allocations.
          </p>
        </div>

        {selectedProjectId !== 'all' && selectedProject && isManager && (
          <button
            type="button"
            onClick={() => setActiveDrawerProject({ id: selectedProject.id, name: selectedProject.name })}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#71347b] hover:bg-[#5d2a65] rounded-md transition-colors shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Team Members</span>
          </button>
        )}
      </div>

      {/* Search Toolbar */}
      <div className="bg-white border border-neutral-200 rounded-lg p-3.5 shadow-xs flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects, members, or roles..."
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-neutral-50 focus:bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#71347b] focus:border-[#71347b]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
            >
              ✕
            </button>
          )}
        </div>

        <div className="text-xs text-neutral-500">
          Showing {filteredTreeNodes.length} project group{filteredTreeNodes.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* FireFlink-style Hierarchical Tree Table */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-100/80 text-neutral-700 font-semibold">
                <th scope="col" className="py-3 px-4 w-[38%]">Project Name / Team Member</th>
                <th scope="col" className="py-3 px-3 w-[22%]">Role</th>
                <th scope="col" className="py-3 px-3 text-right w-[13%]">Completed Tasks</th>
                <th scope="col" className="py-3 px-3 text-right w-[13%]">Pending Tasks</th>
                <th scope="col" className="py-3 px-4 text-right w-[14%]">Upcoming Tasks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredTreeNodes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-14 text-center">
                    <div className="max-w-sm mx-auto flex flex-col items-center">
                      <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-400 mb-2">
                        <Users className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-semibold text-neutral-800">No project team data found</h3>
                      <p className="text-xs text-neutral-500 mt-1">
                        {searchQuery
                          ? 'No matching projects or team members found.'
                          : 'Select a specific project or create projects and assign team members.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTreeNodes.map((node) => {
                  const proj = node.project;
                  const isExpanded = expandedMap[proj.id] !== undefined ? expandedMap[proj.id] : true;
                  const members = node.members;

                  return (
                    <React.Fragment key={proj.id}>
                      {/* PARENT ROW: PROJECT */}
                      <tr className="bg-[#fbf7fc] hover:bg-[#f5eff7]/70 transition-colors border-t border-neutral-200 font-medium">
                        <td className="py-3 px-4 text-neutral-900">
                          <div className="flex items-center gap-2">
                            {/* Expand / Collapse Arrow */}
                            <button
                              type="button"
                              onClick={(e) => toggleExpandProject(proj.id, e)}
                              className="p-0.5 text-neutral-500 hover:text-[#71347b] transition-colors rounded cursor-pointer shrink-0"
                              aria-label={isExpanded ? 'Collapse project' : 'Expand project'}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                              ) : (
                                <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                              )}
                            </button>

                            <FolderKanban className="w-4 h-4 text-[#71347b] shrink-0" />

                            {/* Project Name clickable to navigate to project landing page */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedProjectId(proj.id);
                              }}
                              className="font-bold text-neutral-900 hover:text-[#71347b] hover:underline truncate text-left cursor-pointer"
                              title="Click to view project details"
                            >
                              {proj.name}
                            </button>

                            <span className="font-mono text-[10px] px-1.5 py-0.2 bg-white text-[#71347b] border border-[#dfcadf] rounded shrink-0">
                              {proj.code}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-neutral-600">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-neutral-700">Status:</span>
                            <span className="capitalize">{proj.status.replace('_', ' ')}</span>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                          {node.completedCount}
                        </td>

                        <td className="py-3 px-3 text-right font-mono font-bold text-amber-700">
                          {node.pendingCount}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-blue-700">
                          {node.upcomingCount}
                        </td>
                      </tr>

                      {/* CHILD ROWS: TEAM MEMBERS */}
                      {isExpanded &&
                        (members.length === 0 ? (
                          <tr className="bg-white">
                            <td colSpan={5} className="py-3 pl-12 pr-4 text-neutral-400 italic text-[11px]">
                              └ No team members assigned to this project yet.{' '}
                              {isManager && (
                                <button
                                  type="button"
                                  onClick={() => setActiveDrawerProject({ id: proj.id, name: proj.name })}
                                  className="text-[#71347b] font-semibold hover:underline not-italic ml-1"
                                >
                                  + Add Members
                                </button>
                              )}
                            </td>
                          </tr>
                        ) : (
                          members.map((member) => {
                            const mComp = member.completedTasksCount || 0;
                            const mPend = member.pendingTasksCount || 0;
                            const mUp = Math.max(0, (member.assignedTasksCount || 0) - mComp - mPend);

                            return (
                              <tr
                                key={`${proj.id}-${member.userId}`}
                                className="bg-white hover:bg-neutral-50/80 transition-colors group border-b border-neutral-100"
                              >
                                <td className="py-2.5 pl-9 pr-4 text-neutral-800">
                                  <div className="flex items-center gap-2">
                                    <span className="text-neutral-300 font-mono select-none">└</span>
                                    <div className="w-6 h-6 rounded-full bg-[#f5eff7] text-[#71347b] border border-[#dfcadf] flex items-center justify-center font-bold text-[10px] shrink-0">
                                      {member.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-semibold text-neutral-900 truncate">{member.name}</p>
                                      <p className="text-[10px] text-neutral-400 font-mono truncate">{member.email}</p>
                                    </div>
                                  </div>
                                </td>

                                <td className="py-2.5 px-3 text-neutral-700">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-100 text-neutral-700">
                                    <Shield className="w-3 h-3 text-neutral-400 shrink-0" />
                                    <span>{member.roleName}</span>
                                  </span>
                                </td>

                                <td className="py-2.5 px-3 text-right font-mono text-neutral-800 font-medium">
                                  {mComp}
                                </td>

                                <td className="py-2.5 px-3 text-right font-mono text-neutral-800 font-medium">
                                  {mPend}
                                </td>

                                <td className="py-2.5 px-4 text-right font-mono text-neutral-800 font-medium flex items-center justify-end gap-2">
                                  <span>{mUp}</span>
                                  {isManager && (
                                    <button
                                      type="button"
                                      onClick={() => setMemberToRemove({ member, projectName: proj.name })}
                                      className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-all cursor-pointer ml-2"
                                      title="Remove member from project"
                                      aria-label={`Remove ${member.name}`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        ))}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Team Members Drawer */}
      {activeDrawerProject && (
        <AddTeamMembersDrawer
          isOpen={Boolean(activeDrawerProject)}
          onClose={() => setActiveDrawerProject(null)}
          projectId={activeDrawerProject.id}
          projectName={activeDrawerProject.name}
          currentMembers={
            treeNodes.find((n) => n.project.id === activeDrawerProject.id)?.members || []
          }
          onMembersAdded={loadTreeData}
        />
      )}

      {/* Remove Member Confirmation Modal */}
      <RemoveMemberModal
        isOpen={Boolean(memberToRemove)}
        onClose={() => setMemberToRemove(null)}
        onConfirm={handleRemoveConfirm}
        member={memberToRemove?.member || null}
        projectName={memberToRemove?.projectName || ''}
      />
    </div>
  );
};
