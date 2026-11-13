import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search,
  ChevronDown,
  ChevronUp,
  Briefcase,
  Monitor,
  Check,
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useNavigation } from '../../context/NavigationContext';

/**
 * Text component that truncates when content exceeds available container width,
 * and ONLY renders a tooltip of the full name if the text is actually truncated.
 */
interface TruncatedProjectTextProps {
  text: string;
  className?: string;
}

const TruncatedProjectText: React.FC<TruncatedProjectTextProps> = ({
  text,
  className = '',
}) => {
  const textRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const evaluateTruncation = useCallback(() => {
    if (textRef.current) {
      const overflowing = textRef.current.scrollWidth > textRef.current.clientWidth;
      setIsTruncated(overflowing);
      return overflowing;
    }
    return false;
  }, []);

  const handleMouseEnter = () => {
    const truncated = evaluateTruncation();
    if (truncated && textRef.current) {
      const rect = textRef.current.getBoundingClientRect();
      setTooltipPos({
        top: rect.bottom + 4,
        left: Math.max(8, rect.left),
      });
      setShowTooltip(true);
    } else {
      setShowTooltip(false);
    }
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  return (
    <>
      <span
        ref={textRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`truncate block min-w-0 ${className}`}
        title={isTruncated ? text : undefined}
      >
        {text}
      </span>

      {showTooltip && isTruncated && (
        <div
          role="tooltip"
          className="fixed z-[3000] px-2.5 py-1 text-[11px] font-medium leading-tight text-white bg-neutral-900/95 backdrop-blur-xs rounded shadow-xl max-w-[240px] break-words pointer-events-none animate-in fade-in-0 duration-100 border border-neutral-700/50"
          style={{
            top: `${tooltipPos.top}px`,
            left: `${tooltipPos.left}px`,
          }}
        >
          {text}
        </div>
      )}
    </>
  );
};

interface ProjectNavDropdownProps {
  isMobile?: boolean;
}

export const ProjectNavDropdown: React.FC<ProjectNavDropdownProps> = ({ isMobile = false }) => {
  const { projects, selectedProjectId, selectedProject, setSelectedProjectId } = useProject();
  const { currentRoute, navigateTo, setIsMobileMenuOpen } = useNavigation();

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const toggleDropdown = () => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      setSearchQuery('');
    }
  };

  // Requirement 3: When the user clicks the Project navigation label, navigate to the All Projects landing page.
  // Requirement 4: When All Projects is selected, show the All Projects landing page without incorrectly retaining a project-specific active state.
  const handleLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    setSelectedProjectId('all');
    navigateTo('projects');
    if (isMobile) {
      setIsMobileMenuOpen(false);
    }
  };

  // Requirement 3: Clicking the dropdown arrow must open the dropdown without navigating away from the current page.
  const handleArrowClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleDropdown();
  };

  // Requirement 2: Option 1 - All Projects
  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProjectId('all');
    navigateTo('projects');
    setIsOpen(false);
    setSearchQuery('');
    if (isMobile) {
      setIsMobileMenuOpen(false);
    }
  };

  // Requirement 2: Option 2 - Individual Project Names
  const handleSelectProject = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProjectId(projectId);
    navigateTo('projects');
    setIsOpen(false);
    setSearchQuery('');
    if (isMobile) {
      setIsMobileMenuOpen(false);
    }
  };

  // Filter projects by search query
  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const isProjectsRouteActive = currentRoute === 'projects';
  const hasActiveProject = selectedProjectId !== 'all' && selectedProject !== null;
  const displayLabel = hasActiveProject ? selectedProject.name : 'Projects';

  // Mobile layout rendering
  if (isMobile) {
    return (
      <div className="w-full flex flex-col" ref={dropdownRef}>
        <div
          className={`flex items-center justify-between rounded-md transition-colors ${
            isProjectsRouteActive
              ? 'bg-white text-[#71347b] font-semibold shadow-xs'
              : 'text-white/85 hover:bg-white/10 hover:text-white'
          }`}
        >
          {/* Label click navigates to All Projects */}
          <button
            type="button"
            onClick={handleLabelClick}
            className="flex-1 px-3 py-2 text-xs font-medium text-left truncate flex items-center gap-2 cursor-pointer"
            aria-label="Navigate to All Projects"
          >
            <Briefcase className="w-3.5 h-3.5 shrink-0 opacity-80" />
            <span className="truncate">{displayLabel}</span>
          </button>

          {/* Arrow click toggles dropdown */}
          <button
            type="button"
            onClick={handleArrowClick}
            className={`p-2 hover:bg-black/10 rounded-r-md transition-colors cursor-pointer shrink-0 ${
              isProjectsRouteActive ? 'text-[#71347b]' : 'text-white/80 hover:text-white'
            }`}
            aria-expanded={isOpen}
            aria-label="Toggle project switcher"
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Mobile dropdown content */}
        {isOpen && (
          <div className="mt-1 bg-white text-neutral-900 rounded-md p-1 shadow-lg border border-neutral-200 text-xs">
            {/* Search Input */}
            <div className="p-1 border-b border-neutral-100">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-neutral-50 border border-neutral-200 rounded">
                <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search projects..."
                  className="w-full text-xs text-neutral-800 placeholder:text-neutral-400 bg-transparent focus:outline-none"
                />
              </div>
            </div>

            {/* List */}
            <div className="max-h-52 overflow-y-auto py-1">
              <button
                type="button"
                onClick={handleSelectAll}
                className={`w-full text-left px-2.5 py-1.5 text-xs flex items-center justify-between rounded cursor-pointer ${
                  selectedProjectId === 'all'
                    ? 'bg-[#f5eff7] text-[#71347b] font-semibold'
                    : 'text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Briefcase className="w-3.5 h-3.5 text-[#71347b] shrink-0" />
                  <span>All Projects</span>
                </div>
                {selectedProjectId === 'all' && <Check className="w-3.5 h-3.5 text-[#71347b] shrink-0" />}
              </button>

              <div className="my-1 border-t border-neutral-100" />

              {filteredProjects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={(e) => handleSelectProject(p.id, e)}
                  className={`w-full text-left px-2.5 py-1.5 text-xs flex items-center justify-between rounded cursor-pointer ${
                    selectedProjectId === p.id
                      ? 'bg-[#f5eff7] text-[#71347b] font-semibold'
                      : 'text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Monitor className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                    <span className="truncate">{p.name}</span>
                  </div>
                  {selectedProjectId === p.id && <Check className="w-3.5 h-3.5 text-[#71347b] shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop horizontal navbar unified item
  return (
    <div className="relative flex items-center h-full" ref={dropdownRef}>
      {/*
        Unified Single Navigation Item:
        - Exact height matching existing nav items: h-7
        - Visual states:
          * On projects route: bg-white text-[#71347b] font-semibold shadow-xs
          * On other route but project active: bg-white/15 text-white border border-white/20 hover:bg-white/25
          * On other route and all projects: text-white/85 hover:text-white hover:bg-white/10
      */}
      <div
        className={`h-7 rounded-full flex items-center transition-all select-none shrink-0 border ${
          isProjectsRouteActive
            ? 'bg-white text-[#71347b] border-white shadow-xs font-semibold'
            : hasActiveProject
            ? 'bg-white/15 text-white border-white/25 hover:bg-white/20 font-medium'
            : 'bg-transparent text-white/85 border-transparent hover:text-white hover:bg-white/10 font-medium'
        }`}
      >
        {/*
          1. Project Label Click Target:
          Clicking the label navigates to the All Projects landing page.
        */}
        <button
          type="button"
          onClick={handleLabelClick}
          className={`h-full pl-3 pr-1.5 text-xs flex items-center gap-1.5 transition-colors cursor-pointer rounded-l-full focus-visible:outline-none ${
            isProjectsRouteActive
              ? 'hover:text-[#5d2a65]'
              : 'hover:text-white'
          }`}
          title={hasActiveProject ? `Active Project: ${selectedProject.name} (Click for All Projects)` : 'Click for All Projects'}
          aria-label={hasActiveProject ? `Project: ${selectedProject.name}. Click to view All Projects.` : 'Projects. Click to view All Projects.'}
        >
          <span className="max-w-[130px] sm:max-w-[160px] md:max-w-[200px] block min-w-0">
            <TruncatedProjectText text={displayLabel} />
          </span>
        </button>

        {/* Subtle separator divider inside the capsule */}
        <span
          className={`h-3.5 w-px shrink-0 ${
            isProjectsRouteActive
              ? 'bg-[#71347b]/20'
              : 'bg-white/20'
          }`}
          aria-hidden="true"
        />

        {/*
          2. Dropdown Arrow Click Target:
          Clicking the dropdown arrow opens the dropdown without navigating away from the current page.
        */}
        <button
          type="button"
          onClick={handleArrowClick}
          className={`h-full pl-1.5 pr-2.5 flex items-center justify-center rounded-r-full transition-colors cursor-pointer focus-visible:outline-none ${
            isProjectsRouteActive
              ? 'hover:bg-neutral-100 text-[#71347b]'
              : 'hover:bg-white/15 text-white/90 hover:text-white'
          }`}
          aria-expanded={isOpen}
          aria-haspopup="true"
          aria-label="Switch Project"
        >
          {isOpen ? (
            <ChevronUp className="w-3.5 h-3.5 stroke-[2.5]" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
          )}
        </button>
      </div>

      {/*
        Dropdown Options Popup:
        - All Projects at top
        - Individual project names below
        - Closes after selecting an option
        - Closes when clicking outside or pressing Escape
      */}
      {isOpen && (
        <div
          role="menu"
          aria-label="Projects Menu"
          className="bg-white border border-[#dfcadf] shadow-xl flex flex-col overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100 rounded-[4px] absolute top-[38px] left-0 w-[230px] z-[2000]"
        >
          {/* Top Search Input */}
          <div className="p-1.5 border-b border-neutral-100 bg-neutral-50/60">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-white border border-[#dfcadf] rounded-[3px] shadow-2xs focus-within:border-[#71347b] transition-colors">
              <Search
                className="w-3.5 h-3.5 shrink-0 text-[#71347b]"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Projects"
                className="w-full text-[11px] text-neutral-800 placeholder:text-neutral-400 bg-transparent focus:outline-none font-medium"
              />
            </div>
          </div>

          {/* Project List */}
          <div className="max-h-64 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-neutral-200">
            {/* Option 1: "All Projects" Always displayed at the top */}
            {(!searchQuery || 'all projects'.includes(searchQuery.toLowerCase())) && (
              <button
                type="button"
                onClick={handleSelectAll}
                className={`w-full text-left px-2.5 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer rounded-[3px] group ${
                  selectedProjectId === 'all'
                    ? 'bg-[#f5eff7] font-semibold text-[#71347b]'
                    : 'text-neutral-700 hover:bg-[#fbf7fc] hover:text-[#71347b]'
                }`}
                role="menuitem"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1 pr-1">
                  <Briefcase
                    className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                      selectedProjectId === 'all' ? 'text-[#71347b]' : 'text-neutral-500 group-hover:text-[#71347b]'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <TruncatedProjectText text="All Projects" />
                  </div>
                </div>
                {selectedProjectId === 'all' && (
                  <Check className="w-3.5 h-3.5 shrink-0 ml-1 text-[#71347b] stroke-[2.5]" />
                )}
              </button>
            )}

            {/* Separator between All Projects and Individual Projects */}
            {(!searchQuery || 'all projects'.includes(searchQuery.toLowerCase())) &&
              filteredProjects.length > 0 && (
                <div className="my-1 border-t border-neutral-100" />
              )}

            {/* Option 2: Individual Project Names */}
            {filteredProjects.length > 0 ? (
              filteredProjects.map((proj) => {
                const isSelected = selectedProjectId === proj.id;
                return (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={(e) => handleSelectProject(proj.id, e)}
                    className={`w-full text-left px-2.5 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer rounded-[3px] group ${
                      isSelected
                        ? 'bg-[#f5eff7] font-semibold text-[#71347b]'
                        : 'text-neutral-700 hover:bg-[#fbf7fc] hover:text-[#71347b]'
                    }`}
                    role="menuitem"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 pr-1">
                      <Monitor
                        className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                          isSelected ? 'text-[#71347b]' : 'text-neutral-400 group-hover:text-[#71347b]'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <TruncatedProjectText text={proj.name} />
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-1">
                      <span className="font-mono text-[10px] px-1 py-0.2 bg-neutral-100 text-neutral-500 rounded border border-neutral-200">
                        {proj.code}
                      </span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-[#71347b] stroke-[2.5]" />
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-3 text-center text-[11px] text-neutral-400 italic">
                No matching projects
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
