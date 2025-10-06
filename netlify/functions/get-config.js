exports.handler = async function(event, context) {
  return {
    statusCode: 200,
    body: JSON.stringify({
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY,
      adminEmail: process.env.ADMIN_EMAIL
    })
  };
};