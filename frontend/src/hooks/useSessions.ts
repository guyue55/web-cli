import { useState, useEffect, useMemo } from 'react';

export type HistoryItem = {
  projectPath: string;
  projectName: string;
  index: string;
  name: string;
  time: string;
  updatedAt: number;
  id: string; // UUID
};

export interface ProjectEntry {
  path: string;
  name: string;
  isScanning?: boolean;
}

export function useSessions() {
  const [activeSessions, setActiveSessions] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(true);

  useEffect(() => {
    const host = window.location.hostname || 'localhost';
    
    const fetchActive = async () => {
      try {
        const res = await fetch(`http://${host}:3001/active-sessions`);
        if (res.ok) setActiveSessions(await res.json());
      } catch { /* ignore */ }
    };
    fetchActive();
    const interval = setInterval(fetchActive, 10000);

    const ws = new WebSocket(`ws://${host}:3001/discovery`);

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case 'project-list':
          setProjects(msg.projects.map((p: { path: string; name: string }) => ({ ...p, isScanning: false })));
          break;
        case 'project-scanning':
          setProjects(prev => prev.map(p => p.name === msg.projectName ? { ...p, isScanning: true } : p));
          break;
        case 'session-found':
          setHistory(prev => {
            if (prev.some(h => h.id === msg.record.id)) return prev;
            return [...prev, msg.record];
          });
          break;
        case 'project-complete':
        case 'project-error':
          setProjects(prev => prev.map(p => p.name === msg.projectName ? { ...p, isScanning: false } : p));
          break;
        case 'discovery-complete':
          setIsDiscovering(false);
          break;
      }
    };

    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, []);

  const sortedAndGroupedHistory = useMemo(() => {
    // 1. Group sessions and find latest update for each project
    const groups: Record<string, { items: HistoryItem[], latestUpdate: number }> = {};
    
    // Initialize groups from project list
    projects.forEach(p => {
      groups[p.name] = { items: [], latestUpdate: 0 };
    });

    // Populate and track latest update
    history.forEach(item => {
      if (!groups[item.projectName]) {
        groups[item.projectName] = { items: [], latestUpdate: 0 };
      }
      groups[item.projectName].items.push(item);
      if (item.updatedAt > groups[item.projectName].latestUpdate) {
        groups[item.projectName].latestUpdate = item.updatedAt;
      }
    });

    // 2. Sort sessions within each project (newest first)
    Object.values(groups).forEach(group => {
      group.items.sort((a, b) => b.updatedAt - a.updatedAt);
    });

    // 3. Sort projects themselves by their latest session update
    return Object.entries(groups)
      .sort(([, a], [, b]) => b.latestUpdate - a.latestUpdate)
      .map(([name, group]) => ({ name, items: group.items }));

  }, [projects, history]);

  return {
    activeSessions,
    projects,
    groupedHistory: sortedAndGroupedHistory,
    isDiscovering
  };
}
