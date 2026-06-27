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
    const body = JSON.parse(event.body);
    const { action } = body;

    // ── Claude AI 圖片辨識 ──
    if (action === 'recognize') {
      const { imageBase64 } = body;
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 }
              },
              {
                type: 'text',
                text: `你是食品包裝文字辨識專家。仔細看這張圖片，找出：
1. 零食/食品的完整名稱（包含品牌，例如：義美小泡芙、旺旺仙貝、樂事洋芋片）
2. 有效日期/保存期限/賞味期限/Best Before/EXP（轉換成 YYYY-MM-DD 格式）

只回傳JSON，不要任何說明：
{"name":"完整產品名稱或空字串","expiry":"YYYY-MM-DD或空字串","confidence":"high/medium/low","raw_date":"原始日期文字或空字串"}`
              }
            ]
          }]
        })
      });
      const data = await res.json();
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    // ── Notion：建立頁面 ──
    if (action === 'createPage') {
      const { token, dbId, properties } = body;
      const res = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify({ parent: { database_id: dbId }, properties })
      });
      const data = await res.json();
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    // ── Notion：更新頁面 ──
    if (action === 'updatePage') {
      const { token, pageId, properties } = body;
      const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify({ properties })
      });
      const data = await res.json();
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    // ── Notion：查詢現有零食 ──
    if (action === 'queryDb') {
      const { token, dbId } = body;
      const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
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
      const data = await res.json();
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    // ── Notion：查詢歷史 ──
    if (action === 'queryHistory') {
      const { token, dbId } = body;
      const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
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
      const data = await res.json();
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };

  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
