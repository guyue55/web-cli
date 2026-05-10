import { Router } from 'express';
import { SessionController } from '../controllers/SessionController.js';
import { FileController } from '../controllers/FileController.js';

export const apiRouter = Router();

apiRouter.get('/active-sessions', SessionController.getActiveSessions);
apiRouter.get('/history', SessionController.getHistory);
apiRouter.post('/history/refresh', SessionController.triggerRefresh);
apiRouter.get('/history/:uuid/transcript', SessionController.getTranscript);
apiRouter.delete('/history/:uuid', SessionController.deleteSession);

apiRouter.get('/files', FileController.getFiles);
