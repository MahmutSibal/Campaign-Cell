const http = require('http');
const port = process.env.PORT || 3000;
const serviceName = process.env.SERVICE_NAME || 'Node Service';

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', service: serviceName }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(port, () => {
  console.log(${serviceName} is running on port );
});
