// Notion API proxy — fetches all cascade data and returns structured JSON
const NOTION_VERSION = '2022-06-28';
 
// Database IDs from the SFF Cascade Prototype
const DB = {
  concerns:     '694749a66d604a6aaaff33bb9f2366cb',
  outcomes:     '814451f6e51b4070897f55a36d8ef483',
  results:      '98906776d15a444a8a5f382ebff9f13a',
  conditions:   '6af4b68119c046f2a9cbd05b320272b9',
  breakdowns:   '5564945967ea4e80be055e53cd774425',
  relevantInfo: '1fd91faccaee420d90d66c047da59771',
};
 
async function queryAll(dbId, token) {
  const all = [];
  let cursor;
  do {
    const body = { page_size: 100, ...(cursor && { start_cursor: cursor }) };
    const r = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || 'Notion API error');
    all.push(...(d.results || []));
    cursor = d.has_more ? d.next_cursor : null;
  } while (cursor);
  return all;
}
 
const prop     = (p, k) => p.properties?.[k];
const title    = (p, k) => prop(p, k)?.title?.[0]?.plain_text ?? '';
const select   = (p, k) => prop(p, k)?.select?.name ?? null;
const relation = (p, k) => (prop(p, k)?.relation ?? []).map(r => r.id);
const richText = (p, k) => prop(p, k)?.rich_text?.[0]?.plain_text ?? '';
const dateVal  = (p, k) => prop(p, k)?.date?.start ?? null;
const urlProp  = (p, k) => prop(p, k)?.url ?? null;
 
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
 
  const token = process.env.NOTION_TOKEN;
  if (!token) return res.status(500).json({ error: 'NOTION_TOKEN environment variable is not set.' });
 
  try {
    const [cPages, oPages, rPages, condPages, bdPages, riPages] = await Promise.all([
      queryAll(DB.concerns,     token),
      queryAll(DB.outcomes,     token),
      queryAll(DB.results,      token),
      queryAll(DB.conditions,   token),
      queryAll(DB.breakdowns,   token),
      queryAll(DB.relevantInfo, token),
    ]);
 
    res.json({
      concerns: cPages.map(p => ({
        id:         p.id,
        text:       title(p, 'Concern'),
        area:       select(p, 'Area'),
        nsStatus:   select(p, 'N&S Status') ?? 'Needs Review',
        outcomeIds: relation(p, 'Outcomes'),
      })),
      outcomes: oPages.map(p => ({
        id:         p.id,
        text:       title(p, 'Outcome'),
        area:       select(p, 'Area'),
        nsStatus:   select(p, 'N&S Status') ?? 'Needs Review',
        concernIds: relation(p, 'Concerns'),
        resultIds:  relation(p, 'Results'),
      })),
      results: rPages.map(p => ({
        id:        p.id,
        text:      title(p, 'Result'),
        area:      select(p, 'Area'),
        status:    select(p, 'Status') ?? 'To Do',
        dueDate:   dateVal(p, 'Due Date'),
        outcomeId: relation(p, 'Outcome')[0] ?? null,
      })),
      conditions: condPages.map(p => ({
        id:   p.id,
        text: title(p, 'Condition'),
        area: select(p, 'Area'),
      })),
      breakdowns: bdPages.map(p => ({
        id:         p.id,
        text:       title(p, 'Statement'),
        area:       select(p, 'Area'),
        date:       dateVal(p, 'Date Occurred'),
        resolution: richText(p, 'Resolution'),
      })),
      relevantInfo: riPages.map(p => ({
        id:    p.id,
        text:  title(p, 'Name'),
        url:   urlProp(p, 'URL'),
        type:  select(p, 'Type'),
        area:  select(p, 'Area'),
        notes: richText(p, 'Notes'),
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
 
