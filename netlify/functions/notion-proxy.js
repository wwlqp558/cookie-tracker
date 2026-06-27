exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const { action, token, dbId, pageId, properties, imageBase64 } = JSON.parse(event.body);

    // 1. AI 圖片辨識
    if (action === 'recognize') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 300,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
              { type: 'text', text: '請辨識這張食品包裝圖片，找出：1.產品完整名稱（含品牌）2.有效日期（轉成YYYY-MM-DD）。只回傳JSON不要說明：{"name":"名稱","expiry":"YYYY-MM-DD","raw_date":"原始日期文字"}' }
            ]
          }]
        })
      });
      const data = await res.json();
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    const notionH = {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    };

    // 2. 新增 Notion 頁面
    if (action === 'create') {
      const res = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: notionH,
        body: JSON.stringify({ parent: { database_id: dbId }, properties })
      });
      return { statusCode: 200, headers, body: JSON.stringify(await res.json()) };
    }

    // 3. 更新 Notion 頁面
    if (action === 'update') {
      const res = await fetch('https://api.notion.com/v1/pages/' + pageId, {
        method: 'PATCH',
        headers: notionH,
        body: JSON.stringify({ properties })
      });
      return { statusCode: 200, headers, body: JSON.stringify(await res.json()) };
    }

    // 4. 讀取現有零食
    if (action === 'list') {
      const res = await fetch('https://api.notion.com/v1/databases/' + dbId + '/query', {
        method: 'POST',
        headers: notionH,
        body: JSON.stringify({
          filter: {
            and: [
              { property: 'Status', select: { does_not_equal: '已吃完' } },
              { property: 'Status', select: { does_not_equal: '已過期' } }
            ]
          },
          sorts: [{ property: 'ExpiryDate', direction: 'ascending' }],
          page_size: 100
        })
      });
      return { statusCode: 200, headers, body: JSON.stringify(await res.json()) };
    }

    // 5. 讀取歷史
    if (action === 'history') {
      const res = await fetch('https://api.notion.com/v1/databases/' + dbId + '/query', {
        method: 'POST',
        headers: notionH,
        body: JSON.stringify({
          filter: {
            or: [
              { property: 'Status', select: { equals: '已吃完' } },
              { property: 'Status', select: { equals: '已過期' } }
            ]
          },
          sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
          page_size: 50
        })
      });
      return { statusCode: 200, headers, body: JSON.stringify(await res.json()) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown action' }) };

  } catch (e) {
    return { statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }, body: JSON.stringify({ error: e.message }) };
  }
};
