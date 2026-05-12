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
export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: string;
}
export interface IPtyProcess {
    write: (data: string) => void;
    resize: (cols: number, rows: number) => void;
    onData: (cb: (data: string) => void) => void;
    onExit: (cb: (status: {
        exitCode: number;
        signal?: number;
    }) => void) => void;
    kill: () => void;
}
export interface TerminalProps {
    uuid: string;
    projectPath: string;
    initialPrompt?: string | null;
    theme?: string;
    onSendToChat?: (text: string) => void;
}
//# sourceMappingURL=index.d.ts.map