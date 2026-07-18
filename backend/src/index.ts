import 'dotenv/config';
import app from './api.js';

const API_PORT = Number(process.env.API_PORT ?? 3000);

app.listen(API_PORT, () => {
  console.log(`[API] REST server listening on http://localhost:${API_PORT}`);
});
