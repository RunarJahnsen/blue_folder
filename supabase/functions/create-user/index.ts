// Edge Function: create-user — oppretter auth-bruker og group_members-rad
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { username, password, groupId, role } = await req.json();
    if (!username || !password || !groupId || !role) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';

    // Verify caller identity from JWT
    const callerClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: callerUser } } = await callerClient.auth.getUser();
    if (!callerUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify caller is admin in the group
    const { data: membership } = await adminClient
      .from('group_members')
      .select('role')
      .eq('user_id', callerUser.id)
      .eq('group_id', groupId)
      .single();

    if (membership?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create the auth user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: `${username}@intern`,
      password,
      email_confirm: true,
    });

    if (createError || !newUser.user) {
      return new Response(JSON.stringify({ error: createError?.message ?? 'Failed to create user' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Add to group_members
    const { error: memberError } = await adminClient.from('group_members').insert({
      user_id: newUser.user.id,
      group_id: groupId,
      username,
      role,
    });

    if (memberError) {
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      return new Response(JSON.stringify({ error: 'Failed to add user to group' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
