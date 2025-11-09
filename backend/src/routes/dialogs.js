import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getDialogs,
  searchDialogs,
  createDialog,
  getPublicDialogs,
  joinPublicDialog,
  getDialogById,
  deleteDialog,
  getDialogMembers,
  addDialogMember,
  removeDialogMember,
} from '../controllers/dialogsController.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getDialogs);
router.get('/search', searchDialogs);
router.post('/', createDialog);
router.get('/public', getPublicDialogs);
router.post('/:dialogId/join', joinPublicDialog);
router.get('/:dialogId', getDialogById);
router.delete('/:dialogId', deleteDialog);
router.get('/:dialogId/members', getDialogMembers);
router.post('/:dialogId/members', addDialogMember);
router.delete('/:dialogId/members/:userId', removeDialogMember);

export default router;
