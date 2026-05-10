export type HistoryItem = {
    projectPath: string;
    projectName: string;
    index: string;
    name: string;
    time: string;
    updatedAt: number;
    id: string;
};
export interface ProjectEntry {
    path: string;
    name: string;
    isScanning?: boolean;
}
export type DiscoveryMessage = {
    type: 'project-list';
    projects: {
        path: string;
        name: string;
    }[];
} | {
    type: 'project-scanning';
    projectName: string;
} | {
    type: 'session-found';
    record: HistoryItem;
} | {
    type: 'project-complete';
    projectName: string;
} | {
    type: 'project-error';
    projectName: string;
    error: string;
} | {
    type: 'discovery-complete';
};
//# sourceMappingURL=index.d.ts.map