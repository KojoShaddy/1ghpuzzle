import { createScoringMiddleware } from '../server/scoringApiPlugin.js';

const middleware = createScoringMiddleware();

export default async function handler(req, res) {
  await middleware(req, res, () => {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'API endpoint not found' }));
  });
}
