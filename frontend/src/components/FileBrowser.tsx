import React, { useState, useEffect } from 'react';

interface FileItem {
  name: string;
  isDirectory: boolean;
  path: string;
}

const FileBrowser: React.FC = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');

  useEffect(() => {
    fetchFiles();
  }, [currentPath]);

  const fetchFiles = async () => {
    try {
      const host = window.location.hostname;
      const url = currentPath 
        ? `http://${host}:3001/files?path=${encodeURIComponent(currentPath)}` 
        : `http://${host}:3001/files`;
      const response = await fetch(url);
      const data = await response.json();
      setFiles(data);
    } catch (e) {
      console.error('Failed to fetch files', e);
    }
  };

  const handleFileClick = (file: FileItem) => {
    if (file.isDirectory) {
      setCurrentPath(file.path);
    } else {
      // In a real app, we might open a file editor
      alert(`Opening file: ${file.name}`);
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
        <h3>Files</h3>
        <button onClick={goUp}>↑</button>
      </div>
      <ul className="file-list">
        {files.map(file => (
          <li key={file.path} onClick={() => handleFileClick(file)}>
            {file.isDirectory ? '📁' : '📄'} {file.name}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FileBrowser;
