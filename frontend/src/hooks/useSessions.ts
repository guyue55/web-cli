import { useState, useEffect, useMemo } from 'react';

export type HistoryItem = {
  projectPath: string;
  projectName: string;
  index: string;
  name: string;
  time: string;
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
  const [isDiscovering, setIsDiscovering] = useState(false);

  useEffect(() => {
    const host = window.location.hostname || 'localhost';
    
    // 1. Fetch active sessions periodically via HTTP
    const fetchActive = async () => {
      try {
        const res = await fetch(`http://${host}:3001/active-sessions`);
        if (res.ok) setActiveSessions(await res.json());
      } catch (e) {}
    };
    fetchActive();
    const interval = setInterval(fetchActive, 10000);

    // 2. Start Discovery via WebSocket for real-time streaming
    const ws = new WebSocket(`ws://${host}:3001/discovery`);
    setIsDiscovering(true);

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case 'project-list':
          setProjects(msg.projects.map((p: any) => ({ ...p, isScanning: false })));
          break;
        case 'project-scanning':
          setProjects(prev => prev.map(p => p.name === msg.projectName ? { ...p, isScanning: true } : p));
          break;
        case 'session-found':
          setHistory(prev => {
            // Avoid duplicates
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
          ws.close();
          break;
      }
    };

    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, []);

  const groupedHistory = useMemo(() => {
    // Start with all projects as keys so they show up immediately
    const acc = projects.reduce((obj, p) => {
      obj[p.name] = [];
      return obj;
    }, {} as Record<string, HistoryItem[]>);

    // Fill with discovered sessions
    return history.reduce((obj, item) => {
      if (!obj[item.projectName]) obj[item.projectName] = [];
      obj[item.projectName].push(item);
      return obj;
    }, acc);
  }, [projects, history]);

  return {
    activeSessions,
    projects,
    groupedHistory,
    isDiscovering
  };
}
