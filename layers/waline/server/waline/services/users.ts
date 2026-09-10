/**
 * 用户业务逻辑 —— 从上游 `server/router/waline/user.ts` 平移。
 */
import type { WalineUser } from '../env';
import {
  banUser,
  countUsers,
  createUser,
  deleteUser,
  getAdminUserByEmail,
  getUserById,
  getUserByEmail,
  getUserType,
  getTopCommenters,
  listUsers,
  updateUserFields,
} from '../../database/index';
import { getAvatar } from '../utils/avatar';
import { hashPassword } from '../utils/password';
import {
  getWalineEnv,
  queryInt,
  queryString,
  useWalineUser,
  walineFail,
  walineOk,
} from '../context';

type Envelope = Record<string, unknown>;

/** 管理端/公开返回的用户对象格式（不包含 password） */
export async function formatUser(
  row: any,
): Promise<Record<string, unknown> | null> {
  if (!row) return null;
  return {
    objectId: row.id,
    display_name: row.display_name || '',
    email: row.email || '',
    type: row.type || 'guest',
    url: '',
    avatar: row.avatar || (await getAvatar(row.email || '')),
    label: row.label || '',
    notify_admin_comment: row.notify_admin_comment ?? 1,
    notify_reply: row.notify_reply ?? 1,
    // 仅管理员列表（listUsers）会带上 createdAt，其它查询路径为 undefined
    createdAt: row.createdAt,
  };
}

/**
 * GET /api/user
 *   公开：按评论数排行的用户
 *   管理员：分页用户列表 / `?email=` 精确查用户（导入流程用）
 */
export async function userListResponse(event: H3Event): Promise<Envelope> {
  const env = getWalineEnv(event);
  const isAdmin = useWalineUser(event)?.type === 'administrator';

  // 管理员按邮箱查用户（导入流程用）
  const emailQuery = queryString(event, 'email');
  if (isAdmin && emailQuery) {
    const user = await getAdminUserByEmail(env.DB, emailQuery);
    if (user) {
      return { errno: 0, objectId: String(user.id), ...user, url: '' };
    }
    return { errno: 0 };
  }

  if (isAdmin) {
    const page = Math.max(1, queryInt(event, 'page', 1));
    const pageSize = Math.min(
      100,
      Math.max(1, queryInt(event, 'pageSize', 10)),
    );
    const offset = (page - 1) * pageSize;

    const total = await countUsers(env.DB);
    const rows = await listUsers(env.DB, pageSize, offset);

    return walineOk({
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      data: await Promise.all(rows.map((u) => formatUser(u))),
    });
  }

  // 公开：评论数排行
  const count = Math.min(50, Math.max(1, queryInt(event, 'count', 10)));
  const rows = await getTopCommenters(env.DB, count);

  return walineOk(
    rows.map((u) => ({
      objectId: u.id,
      display_name: u.display_name,
      url: '',
      avatar: u.avatar || '',
      label: u.label || '',
      count: u.comment_count,
    })),
  );
}

/**
 * POST /api/user —— 注册。
 * 首个注册的账号自动成为 administrator。
 */
export async function registerResponse(
  event: H3Event,
  body: {
    display_name?: string;
    email?: string;
    password?: string;
    url?: string;
  },
): Promise<Envelope> {
  const env = getWalineEnv(event);
  const { display_name, email, password, url } = body;

  if (!email || !password) {
    return walineFail(event, 'email and password are required', 400);
  }

  const existing = await getUserByEmail(env.DB, email);
  if (existing) {
    return walineFail(event, 'Registration failed', 409);
  }

  const isFirst = (await countUsers(env.DB)) === 0;
  const hashedPassword = await hashPassword(password);

  const newUserId = await createUser(env.DB, {
    display_name: display_name || email.split('@')[0],
    email,
    password: hashedPassword,
    type: isFirst ? 'administrator' : 'guest',
    url: url || '',
  });

  const newUser = await getUserById(env.DB, newUserId);

  setResponseStatus(event, 201);
  return walineOk(await formatUser(newUser));
}

/**
 * PUT /api/user 与 PUT /api/user/:id 的共用实现。
 *
 * `/api/user` 是 @waline/admin 个人资料页调用的形式：目标用户在服务端
 * 由已验证的 token 决定，忽略请求体里的 id。
 * `/api/user/:id` 则是管理端的通用形式（管理员可改他人，普通用户只能改自己）。
 */
export async function updateUserResponse(
  event: H3Event,
  id: string,
  body: Record<string, unknown>,
  user: WalineUser,
): Promise<Envelope> {
  const env = getWalineEnv(event);

  const updates: Record<string, unknown> = {};
  const isAdmin = user.type === 'administrator';

  const allowedFields = [
    'display_name',
    'url',
    'avatar',
    'label',
    'notify_admin_comment',
    'notify_reply',
  ];
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      // 通知偏好统一规整为 0/1
      updates[field] = field.startsWith('notify_')
        ? body[field]
          ? 1
          : 0
        : body[field];
    }
  }

  if (typeof body.password === 'string' && body.password) {
    updates.password = await hashPassword(body.password);
  }

  // 仅管理员可改角色
  if (isAdmin && body.type !== undefined) {
    updates.type = body.type;
  }

  if (Object.keys(updates).length === 0) {
    return walineFail(event, 'No fields to update', 400);
  }

  await updateUserFields(env.DB, id, updates);

  const updated = await getUserById(env.DB, Number(id));
  return walineOk(await formatUser(updated));
}

/**
 * DELETE /api/user/:id —— 封禁或删除（仅管理员）。
 * 未验证（verify:...）与 guest 直接硬删，其余改为 banned。
 */
export async function deleteUserResponse(
  event: H3Event,
  id: string,
): Promise<Envelope> {
  const env = getWalineEnv(event);

  if (useWalineUser(event)?.type !== 'administrator') {
    return walineFail(event, 'Unauthorized', 403);
  }

  const target = await getUserType(env.DB, Number(id));
  if (!target) {
    return walineFail(event, 'User not found', 404);
  }

  if (target.type.startsWith('verify:') || target.type === 'guest') {
    await deleteUser(env.DB, Number(id));
  } else {
    await banUser(env.DB, Number(id));
  }

  return walineOk();
}
