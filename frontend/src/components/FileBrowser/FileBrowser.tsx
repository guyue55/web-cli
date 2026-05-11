import React, { useState, useEffect } from 'react';
import { ApiService } from '../../services/ApiService';

interface FileItem {
  name: string;
  isDirectory: boolean;
  path: string;
}

const FileBrowser: React.FC = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');

  const fetchFiles = async () => {
    try {
      const data = await ApiService.getFiles(currentPath || undefined);
      setFiles(data);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFiles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath]);

  const handleFileClick = (file: FileItem) => {
    if (file.isDirectory) {
      setCurrentPath(file.path);
    } else {
      // Copy path to clipboard
      navigator.clipboard.writeText(file.path);
    }
  };

  const goUp = () => {
    const parts = currentPath.split('/');
    parts.pop();
    setCurrentPath(parts.join('/') || '/');
  };

  return (
    <div className="file-browser">
      <div className="file-browser-header">
        <h3>文件</h3>
        <button onClick={goUp} title="返回上级">
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_upward</span>
        </button>
      </div>
      <ul className="file-list">
        {files.map(file => (
          <li key={file.path} onClick={() => handleFileClick(file)} title={file.isDirectory ? undefined : "点击复制完整路径"}>
            <span className="material-symbols-outlined file-icon" style={{ fontSize: 18, color: file.isDirectory ? 'var(--accent-blue)' : 'var(--text-dim)' }}>
              {file.isDirectory ? 'folder' : 'description'}
            </span>
            <span className="file-name">{file.name}</span>
            {!file.isDirectory && (
               <span className="material-symbols-outlined" style={{ fontSize: 14, marginLeft: 'auto', opacity: 0.3 }}>content_copy</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FileBrowser;
