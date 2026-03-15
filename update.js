// Updates the N&S Status of a Concern or Outcome page in Notion
const NOTION_VERSION = '2022-06-28';
const VALID_STATUSES = ['Needs Review', 'Confirmed', 'Gap Detected'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.NOTION_TOKEN;
  if (!token) return res.status(500).json({ error: 'NOTION_TOKEN environment variable is not set.' });

  const { pageId, status } = req.body ?? {};
  if (!pageId) return res.status(400).json({ error: 'pageId is required' });
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  try {
    const r = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: { 'N&S Status': { select: { name: status } } },
      }),
    });
    const d = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: d.message });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
