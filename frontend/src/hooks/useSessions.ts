import { useState, useEffect, useMemo } from 'react';
import type { HistoryItem, ProjectEntry, SessionMetadata } from '@web-cli/shared';
import { ApiService } from '../services/ApiService';

export type { HistoryItem, ProjectEntry };

export function useSessions() {
  const [activeSessions, setActiveSessions] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [sessionMetadata, setSessionMetadata] = useState<Record<string, SessionMetadata>>({});
  const [isDiscovering, setIsDiscovering] = useState(true);

  useEffect(() => {
    const fetchActive = async () => {
      try {
        const data = await ApiService.getActiveSessions();
        setActiveSessions(data);
      } catch { /* ignore */ }
    };
    const fetchMetadata = async () => {
      try {
        const data = await ApiService.getSessionMetadata();
        setSessionMetadata(data);
      } catch { /* ignore */ }
    };
    fetchActive();
    fetchMetadata();
    const interval = setInterval(fetchActive, 10000);

    const closeDiscovery = ApiService.connectDiscovery((msg) => {
      switch (msg.type) {
        case 'project-list':
          setProjects(msg.projects.map((p) => ({ ...p, isScanning: false })));
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
    });

    return () => {
      clearInterval(interval);
      closeDiscovery();
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
      const key = `${item.projectPath}:${item.id}`;
      const metadata = sessionMetadata[key] || {};
      const hydratedItem: HistoryItem = { ...item, ...metadata };
      if (!groups[item.projectName]) {
        groups[item.projectName] = { items: [], latestUpdate: 0 };
      }
      groups[item.projectName].items.push(hydratedItem);
      if (hydratedItem.updatedAt > groups[item.projectName].latestUpdate) {
        groups[item.projectName].latestUpdate = hydratedItem.updatedAt;
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

  }, [projects, history, sessionMetadata]);

  const renameSessionLocal = (id: string, newName: string) => {
    setHistory(prev => prev.map(h => h.id === id ? { ...h, name: newName } : h));
  };

  const deleteSessionLocal = (id: string) => {
    setHistory(prev => prev.filter(h => h.id !== id));
  };

  const updateSessionMetadataLocal = (projectPath: string, id: string, metadata: SessionMetadata) => {
    const key = `${projectPath}:${id}`;
    setSessionMetadata(prev => {
      const next = { ...prev };
      const merged = { ...(prev[key] || {}), ...metadata };
      if (!merged.pinned && !merged.archived && (!merged.tags || merged.tags.length === 0)) {
        delete next[key];
      } else {
        next[key] = merged;
      }
      return next;
    });
  };

  const clearSessionMetadataLocal = (projectPath: string, id: string) => {
    const key = `${projectPath}:${id}`;
    setSessionMetadata(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  return {
    activeSessions,
    projects,
    groupedHistory: sortedAndGroupedHistory,
    isDiscovering,
    renameSessionLocal,
    deleteSessionLocal,
    updateSessionMetadataLocal,
    clearSessionMetadataLocal
  };
}
