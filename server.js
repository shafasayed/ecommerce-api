const app = require('./app');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Swagger: http://localhost:${PORT}/api-docs`);
});

server.on('error', (error) => {
  console.error('Server could not start:', error.message);
  process.exit(1);
});
