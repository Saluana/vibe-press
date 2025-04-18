import { wpError } from "../../core/utils/wpError";
import {serverHooks} from "../../core/hooks/hookEngine.server";
import {createUser, getUserByLoginOrEmail, updateUser, deleteUser} from "../../core/services/user/user.services";
import {getUserMeta, setUserMeta, deleteUserMeta} from "../../core/services/user/userMeta.services";

import { Router, Request, Response } from 'express';

const router = Router();

export default router;
