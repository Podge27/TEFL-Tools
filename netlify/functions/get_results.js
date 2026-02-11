const { createClient } = require('@supabase/supabase-js');

exports.handler = async function(event, context) {
  // 1. SECURITY: Only allow POST requests
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { password } = JSON.parse(event.body);

    // ==========================================
    // CONFIGURATION: YOUR ADMIN PASSWORD
    // ==========================================
    // Change "EnglishTeacher2026" to whatever password you want to use.
    // Ideally, store this in Netlify Environment Variables too (e.g. process.env.ADMIN_PASSWORD)
    // but for now, hardcoding it here is okay since this file is backend-only.
    const MY_SECRET_PASSWORD = "EnglishTeacher2026"; 
    // ==========================================

    if (password !== MY_SECRET_PASSWORD) {
      return { statusCode: 401, body: "Wrong Password" };
    }

    // 2. CONNECT TO SUPABASE (Using the SERVICE KEY)
    // CRITICAL: Ensure 'SUPABASE_SERVICE_KEY' is set in Netlify Environment Variables.
    // Do NOT paste the key here directly.
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // 3. FETCH DATA (Newest first)
    const { data, error } = await supabase
      .from('placement_results')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };

  } catch (error) {
    console.error("Admin Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Server Error" }) };
  }
};