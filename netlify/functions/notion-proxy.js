exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };

  try {
    const body = JSON.parse(event.body);
    const { action } = body;

    // ── Claude AI 圖片辨識 ──
    if (action === 'recognize') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6', max_tokens: 500,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: body.imageBase64 } },
            { type: 'text', text: `你是食品包裝文字辨識專家。仔細看這張圖片找出：
1. 零食/食品完整名稱（含品牌，例如：義美小泡芙、旺旺仙貝）
2. 有效日期/保存期限/EXP（轉成 YYYY-MM-DD）
只回傳JSON不要說明：{"name":"名稱或空字串","expiry":"YYYY-MM-DD或空字串","confidence":"high/medium/low","raw_date":"原始日期文字"}` }
          ]}]
        })
      });
      const data = await res.json();
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    const notionHeaders = { 'Authorization': `Bearer ${body.token}`, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' };

    if (action === 'createPage') {
      const res = await fetch('https://api.notion.com/v1/pages', { method: 'POST', headers: notionHeaders, body: JSON.stringify({ parent: { database_id: body.dbId }, properties: body.properties }) });
      return { statusCode: 200, headers, body: JSON.stringify(await res.json()) };
    }
    if (action === 'updatePage') {
      const res = await fetch(`https://api.notion.com/v1/pages/${body.pageId}`, { method: 'PATCH', headers: notionHeaders, body: JSON.stringify({ properties: body.properties }) });
      return { statusCode: 200, headers, body: JSON.stringify(await res.json()) };
    }
    if (action === 'queryDb') {
      const res = await fetch(`https://api.notion.com/v1/databases/${body.dbId}/query`, {
        method: 'POST', headers: notionHeaders,
        body: JSON.stringify({
          filter: { and: [{ property: 'Status', select: { does_not_equal: '已吃完' } }, { property: 'Status', select: { does_not_equal: '已過期' } }] },
          sorts: [{ property: 'ExpiryDate', direction: 'ascending' }], page_size: 100
        })
      });
      return { statusCode: 200, headers, body: JSON.stringify(await res.json()) };
    }
    if (action === 'queryHistory') {
      const res = await fetch(`https://api.notion.com/v1/databases/${body.dbId}/query`, {
        method: 'POST', headers: notionHeaders,
        body: JSON.stringify({
          filter: { or: [{ property: 'Status', select: { equals: '已吃完' } }, { property: 'Status', select: { equals: '已過期' } }] },
          sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }], page_size: 50
        })
      });
      return { statusCode: 200, headers, body: JSON.stringify(await res.json()) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
