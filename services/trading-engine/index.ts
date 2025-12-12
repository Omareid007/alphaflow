import http from 'http';

const PORT = process.env.PORT || 3001;
const SERVICE_NAME = process.env.SERVICE_NAME || 'trading-engine';

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', service: SERVICE_NAME }));
    return;
  }
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ service: SERVICE_NAME, message: 'Trading Engine placeholder' }));
});

server.listen(PORT, () => {
  console.log(`[${SERVICE_NAME}] Running on port ${PORT}`);
});
