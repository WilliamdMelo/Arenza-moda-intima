module.exports = (req, res) => {
    const { SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL } = process.env;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        res.status(500).json({
            error: 'Supabase credentials are missing. Defina SUPABASE_URL e SUPABASE_ANON_KEY nas variáveis de ambiente.'
        });
        return;
    }

    res.status(200).json({
        url: SUPABASE_URL,
        anonKey: SUPABASE_ANON_KEY,
        adminEmail: ADMIN_EMAIL || null
    });
};
