import { Router } from 'express';
import { SessionController } from '../controllers/SessionController.js';
import { FileController } from '../controllers/FileController.js';

export const apiRouter = Router();

apiRouter.get('/active-sessions', SessionController.getActiveSessions);
apiRouter.get('/history', SessionController.getHistory);
apiRouter.get('/history-metadata', SessionController.getSessionMetadata);
apiRouter.post('/history/refresh', SessionController.triggerRefresh);
apiRouter.get('/history/:uuid/transcript', SessionController.getTranscript);
apiRouter.delete('/history/:uuid', SessionController.deleteSession);
apiRouter.patch('/history/:uuid/metadata', SessionController.updateSessionMetadata);
apiRouter.patch('/history/:uuid/rename', SessionController.renameSession);
apiRouter.post('/history/:uuid/restart', SessionController.forceRestartSession);

apiRouter.get('/files', FileController.getFiles);
apiRouter.get('/workspace-roots', FileController.getWorkspaceRoots);
apiRouter.post('/files/directory', FileController.createDirectory);
