export default async function handler(req, res) {
  const { path } = req.query;
  
  // Исправление #3: path может быть строкой
  const pathArray = Array.isArray(path) ? path : [path];
  const targetUrl = `https://fgis.gost.ru/fundmetrology/${pathArray.join('/')}`;
  
  try {
    // Исправление #2: whitelist заголовков вместо ...req.headers
    const headers = {
      'User-Agent': req.headers['user-agent'] || 'Metrolog-Manage/1.0',
      'Accept': req.headers['accept'] || 'application/json',
    };
    
    const response = await fetch(targetUrl, { headers });
    
    const contentType = response.headers.get('content-type') || 'application/json';
    
    // Исправление #1: обработка бинарных ответов (PDF)
    if (contentType.includes('application/pdf') || contentType.includes('application/octet-stream')) {
      const buffer = await response.arrayBuffer();
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', buffer.byteLength);
      return res.status(response.status).send(Buffer.from(buffer));
    }
    
    // JSON ответы
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy error', message: error.message });
  }
}
