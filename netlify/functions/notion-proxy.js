exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  try {
    const { action, token, dbId, pageId, properties } = JSON.parse(event.body);
    let url, method;
    if (action === 'createPage') {
      url = 'https://api.notion.com/v1/pages';
      method = 'POST';
    } else if (action === 'updatePage') {
      url = `https://api.notion.com/v1/pages/${pageId}`;
      method = 'PATCH';
    } else {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
    }
    const body = action === 'createPage'
      ? JSON.stringify({ parent: { database_id: dbId }, properties })
      : JSON.stringify({ properties });
    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body
    });
    const data = await res.json();
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
