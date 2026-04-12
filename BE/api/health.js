export default function handler(req, res) {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: {
      hasDbHost: !!process.env.DB_HOST,
      hasDbPort: !!process.env.DB_PORT,
      hasDbUser: !!process.env.DB_USER,
      hasDbName: !!process.env.DB_NAME,
    }
  });
}