exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const { action, token, dbId, pageId, properties, cursor } = JSON.parse(event.body);

    const notionHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    };

    // 建立頁面
    if (action === 'createPage') {
      const res = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: notionHeaders,
        body: JSON.stringify({ parent: { database_id: dbId }, properties })
      });
      const data = await res.json();
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    // 更新頁面
    if (action === 'updatePage') {
      const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'PATCH',
        headers: notionHeaders,
        body: JSON.stringify({ properties })
      });
      const data = await res.json();
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    // 讀取所有項目
    if (action === 'queryDb') {
      const body = {
        filter: {
          property: 'Status',
          select: { does_not_equal: '已過期' }
        },
        sorts: [{ property: 'ExpiryDate', direction: 'ascending' }],
        page_size: 100
      };
      if (cursor) body.start_cursor = cursor;

      const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
        method: 'POST',
        headers: notionHeaders,
        body: JSON.stringify(body)
      });
      const data = await res.json();
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    // 讀取歷史（已吃完或已過期）
    if (action === 'queryHistory') {
      const body = {
        filter: {
          or: [
            { property: 'Status', select: { equals: '已吃完' } },
            { property: 'Status', select: { equals: '已過期' } }
          ]
        },
        sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
        page_size: 50
      };
      const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
        method: 'POST',
        headers: notionHeaders,
        body: JSON.stringify(body)
      });
      const data = await res.json();
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };

  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
