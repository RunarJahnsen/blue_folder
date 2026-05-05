import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function ok(body: object) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function err(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return err(401, 'Unauthorized');

    const body = await req.json();
    const { action, groupId } = body;
    if (!action || !groupId) return err(400, 'Missing action or groupId');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const adminClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    // Verify caller identity
    const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return err(401, 'Unauthorized');

    // ── Admin actions ─────────────────────────────────────────────────────────
    if (action === 'change_role' || action === 'remove_member' || action === 'reset_password') {
      const { data: membership } = await adminClient
        .from('group_members')
        .select('role')
        .eq('user_id', caller.id)
        .eq('group_id', groupId)
        .single();
      if (membership?.role !== 'admin') return err(403, 'Forbidden');

      if (action === 'change_role') {
        const { userId, newRole } = body;
        if (!userId || !newRole) return err(400, 'Missing userId or newRole');
        const { error } = await adminClient
          .from('group_members')
          .update({ role: newRole })
          .eq('user_id', userId)
          .eq('group_id', groupId);
        if (error) return err(500, error.message);
        return ok({ success: true });
      }

      if (action === 'remove_member') {
        const { userId } = body;
        if (!userId) return err(400, 'Missing userId');
        const { error } = await adminClient
          .from('group_members')
          .delete()
          .eq('user_id', userId)
          .eq('group_id', groupId);
        if (error) return err(500, error.message);
        return ok({ success: true });
      }

      if (action === 'reset_password') {
        const { userId, newPassword } = body;
        if (!userId || !newPassword) return err(400, 'Missing userId or newPassword');
        const { error } = await adminClient.auth.admin.updateUserById(userId, { password: newPassword });
        if (error) return err(400, error.message);
        return ok({ success: true });
      }
    }

    // ── Self-service action ───────────────────────────────────────────────────
    if (action === 'update_username') {
      const { newUsername } = body;
      if (!newUsername?.trim()) return err(400, 'Missing newUsername');

      const { data: membership } = await adminClient
        .from('group_members')
        .select('role')
        .eq('user_id', caller.id)
        .eq('group_id', groupId)
        .single();
      if (!membership) return err(403, 'Forbidden');

      const trimmed = newUsername.trim();

      await adminClient
        .from('group_members')
        .update({ username: trimmed })
        .eq('user_id', caller.id)
        .eq('group_id', groupId);

      await adminClient.auth.admin.updateUserById(caller.id, {
        user_metadata: { username: trimmed },
      });

      await adminClient
        .from('folders')
        .update({ owner_username: trimmed })
        .eq('owner_user_id', caller.id);

      return ok({ success: true });
    }

    return err(400, 'Unknown action');
  } catch {
    return err(500, 'Internal server error');
  }
});
