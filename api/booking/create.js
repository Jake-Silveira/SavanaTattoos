const { createClient } = require('@supabase/supabase-js');
const { verifyAdmin } = require('../_utils/auth');
const { calculateDuration } = require('../_utils/duration');
const { formatTime12 } = require('../_utils/time');

module.exports = async (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { error: authError, status: authStatus } = await verifyAdmin(req);
  if (authError) return res.status(authStatus).json({ error: authError });

  const {
    profile_id, client_id, name, owner_name, phone, email,
    size, body_placement, service, requested_date,
    requested_time, duration_minutes, message, new_client
  } = req.body;

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let finalClientId = client_id || null;
    let finalProfileId = profile_id || null;

    // Create new client if needed
    if (new_client && !client_id) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .insert([{
          owner_name: new_client.owner_name || owner_name,
          phone: new_client.phone || phone,
          email: new_client.email || email || null,
          client_id: code
        }])
        .select()
        .single();

      if (clientError) throw clientError;
      finalClientId = clientData.id;
    }

    // Calculate duration
    let duration = calculateDuration(service, size, null, duration_minutes);

    // Insert lead as confirmed
    const leadData = {
      client_name: name || 'Walk-in',
      service: service,
      size: size,
      body_placement: body_placement || null,
      requested_date: requested_date,
      requested_time: requested_time,
      duration_minutes: duration,
      message: message || null,
      confirmed_time: requested_time,
      status: 'confirmed',
      client_id: finalClientId
    };

    // Add profile_id if linking to existing profile
    if (finalProfileId) {
      leadData.profile_id = finalProfileId;
    }

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert([leadData])
      .select()
      .single();

    if (leadError) throw leadError;

    // Send confirmation email
    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL || 'Savana Tattoos <onboarding@resend.dev>';
    const studioPhone = process.env.STUDIO_PHONE || '(555) 123-4567';
    const studioAddress = process.env.STUDIO_ADDRESS || '123 Ink Avenue, Suite 4';

    if (resendKey && (lead.email || process.env.ADMIN_EMAIL)) {
      const resend = new Resend(resendKey);
      const dateObj = new Date(requested_date + 'T12:00:00');
      const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const dur = parseInt(duration) || 0;
      const hrs = Math.floor(dur / 60);
      const mins = dur % 60;
      let durationStr = '';
      if (hrs > 0) durationStr += hrs + ' hr ';
      if (mins > 0 || hrs === 0) durationStr += mins + ' min';

      const html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; padding: 20px; background: #1a1a2e; color: #c9a87c; border-radius: 12px 12px 0 0;">
            <h1 style="margin: 0; font-size: 24px; letter-spacing: 3px;">SAVANA TATTOOS</h1>
            <p style="color: #a8885c; margin: 4px 0 0;">Appointment Confirmed!</p>
          </div>
          <div style="padding: 25px; background: #fafafa; border-radius: 0 0 12px 12px;">
            <p>Hi <strong>${lead.owner_name || lead.client_name}</strong>,</p>
            <p>Your appointment has been confirmed:</p>
            <div style="background: white; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 3px solid #c9a87c;">
              <p style="margin: 4px 0;"><strong>Date:</strong> ${formattedDate}</p>
              <p style="margin: 4px 0;"><strong>Time:</strong> ${formatTime12(requested_time)}</p>
              <p style="margin: 4px 0;"><strong>Service:</strong> ${service}</p>
              <p style="margin: 4px 0;"><strong>Duration:</strong> ${durationStr}</p>
            </div>
            <p><strong>Arrive 10 minutes early.</strong> Call <strong>${studioPhone}</strong> to reschedule.</p>
          </div>
        </div>
      `;

      if (lead.email) {
        try {
          await resend.emails.send({
            from: fromEmail, to: lead.email,
            subject: 'Your tattoo appointment is confirmed!',
            html
          });
        } catch (err) { console.error('[CREATE] Client email failed:', err.message); }
      } else if (process.env.ADMIN_EMAIL) {
        try {
          await resend.emails.send({
            from: fromEmail, to: process.env.ADMIN_EMAIL,
            subject: 'Appointment confirmed (no client email): ' + (lead.client_name || 'Walk-in'),
            html: '<p>Appointment created but client email was missing.</p>'
          });
        } catch (err) { console.error('[CREATE] Admin fallback failed:', err.message); }
      }
    }

    return res.status(200).json({
      lead,
      client_id: finalClientId
    });

  } catch (error) {
    console.error('[CREATE] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};
