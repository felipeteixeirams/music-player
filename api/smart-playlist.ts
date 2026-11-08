import type { VercelRequest, VercelResponse } from '@vercel/node';
import { guard, POLICIES } from './_guard.js';
import { smartPlaylistEndpoint } from './_smartPlaylist.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido' });
  }
  if (!(await guard(req, res, POLICIES.catalog))) return;
  const { status, body } = await smartPlaylistEndpoint(req.body);
  return res.status(status).json(body);
}
