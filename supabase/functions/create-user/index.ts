import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";
import { createClient } from "npm:@supabase/supabase-js@^2";

export default {
  fetch: withSupabase(
    { auth: 'user' },
    async (req: Request, ctx: any) => {
      // 1. Only allow POST requests
      if (req.method !== 'POST') {
        return Response.json(
          { error: 'Method not allowed. Only POST requests are supported.' },
          { status: 405 }
        );
      }

      try {
        // 2. Retrieve server-side environment secrets
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

        if (!supabaseUrl || !supabaseServiceKey) {
          return Response.json(
            {
              error:
                'Server configuration error: missing SUPABASE_SERVICE_ROLE_KEY. Please ensure the secret is configured in Supabase Edge Functions.',
            },
            { status: 500 }
          );
        }

        // Initialize admin client strictly for server-side administrative execution
        const adminClient =
          ctx.supabaseAdmin?.auth?.admin
            ? ctx.supabaseAdmin
            : createClient(supabaseUrl, supabaseServiceKey, {
                auth: {
                  autoRefreshToken: false,
                  persistSession: false,
                },
              });

        // 3. Authenticate the caller from verified JWT claims or session
        let callerAuthId: string | undefined = ctx.userClaims?.sub;

        if (!callerAuthId && ctx.supabase) {
          try {
            const { data: callerUser } = await ctx.supabase.auth.getUser();
            callerAuthId = callerUser?.user?.id;
          } catch {
            // Ignore extraction error; handled below
          }
        }

        if (!callerAuthId) {
          const authHeader = req.headers.get('Authorization');
          if (authHeader) {
            const token = authHeader.replace(/^Bearer /i, '').trim();
            const { data: tokenUser } = await adminClient.auth.getUser(token);
            callerAuthId = tokenUser?.user?.id;
          }
        }

        if (!callerAuthId) {
          return Response.json(
            { error: 'Unauthorized: Missing or invalid authentication token.' },
            { status: 401 }
          );
        }

        // 4. Strict Manager Authorization:
        // Query public.app_users strictly linked through auth_user_id
        const { data: callerProfiles, error: callerProfileErr } = await adminClient
          .from('app_users')
          .select('id, auth_user_id, role_id, status, roles:role_id(id, name)')
          .eq('auth_user_id', callerAuthId)
          .limit(1);

        if (callerProfileErr) {
          return Response.json(
            {
              error: `Database authorization check failed: ${callerProfileErr.message}`,
            },
            { status: 500 }
          );
        }

        if (!callerProfiles || callerProfiles.length === 0) {
          return Response.json(
            {
              error:
                'Forbidden: No user profile linked to your authentication account was found in public.app_users.',
            },
            { status: 403 }
          );
        }

        const callerProfile = callerProfiles[0];

        // Require status = 'Active'
        if (callerProfile.status !== 'Active') {
          return Response.json(
            {
              error: 'Forbidden: Your manager account is inactive.',
            },
            { status: 403 }
          );
        }

        // Require the exact Manager role from public.roles
        const callerRoleObj = callerProfile.roles as { id?: string; name?: string } | null;
        const callerRoleName = (callerRoleObj?.name || '').trim();

        if (callerRoleName.toLowerCase() !== 'manager') {
          return Response.json(
            {
              error: `Forbidden: Only active users with the Manager role can create users. Current role: ${callerRoleName || 'Unknown'}.`,
            },
            { status: 403 }
          );
        }

        // 5. Parse and validate request payload
        let body: any;
        try {
          body = await req.json();
        } catch {
          return Response.json(
            { error: 'Invalid JSON payload in request body.' },
            { status: 400 }
          );
        }

        const { fullName, email, phoneNumber, roleId, status, password, redirectUrl } = body;

        if (!fullName || !fullName.trim()) {
          return Response.json({ error: 'Full name is required.' }, { status: 400 });
        }

        if (!email || !email.trim()) {
          return Response.json({ error: 'Email address is required.' }, { status: 400 });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const trimmedEmail = email.trim().toLowerCase();
        if (!emailRegex.test(trimmedEmail)) {
          return Response.json({ error: 'Please enter a valid email address.' }, { status: 400 });
        }

        if (!roleId || !roleId.trim()) {
          return Response.json({ error: 'Role selection is required.' }, { status: 400 });
        }

        const trimmedName = fullName.trim();
        const trimmedPhone = phoneNumber ? phoneNumber.trim() : null;
        const normalizedStatus =
          status && status.toLowerCase() === 'inactive' ? 'Inactive' : 'Active';

        // 6. Verify role exists in public.roles and is not inactive
        const { data: roleRecords, error: roleQueryErr } = await adminClient
          .from('roles')
          .select('id, name, status')
          .eq('id', roleId.trim())
          .limit(1);

        if (roleQueryErr || !roleRecords || roleRecords.length === 0) {
          return Response.json(
            { error: 'Selected role was not found in the roles table.' },
            { status: 400 }
          );
        }

        const targetRole = roleRecords[0];
        if (targetRole.status && targetRole.status.toLowerCase() === 'inactive') {
          return Response.json(
            { error: `Cannot assign inactive role "${targetRole.name}" to a new user.` },
            { status: 400 }
          );
        }

        // 7. Duplicate Check: Prevent duplicate profiles in public.app_users
        const { data: existingAppUsers } = await adminClient
          .from('app_users')
          .select('id, email')
          .ilike('email', trimmedEmail)
          .limit(1);

        if (existingAppUsers && existingAppUsers.length > 0) {
          return Response.json(
            {
              error: `A user profile with email "${trimmedEmail}" already exists in the database.`,
            },
            { status: 409 }
          );
        }

        // 8. Authentication Account Provisioning
        const origin = req.headers.get('origin') || redirectUrl || '';
        const appRedirectUrl = origin ? `${origin.replace(/\/$/, '')}/` : undefined;

        let authUserId: string;
        let inviteLink: string | null = null;
        const hasExplicitPassword = Boolean(password && String(password).trim().length > 0);

        if (!hasExplicitPassword) {
          // Secure Invitation Flow:
          // When no password is supplied, invite the user by email so they set their own password.
          // No shared or default password is assigned!
          const { data: inviteData, error: inviteError } =
            await adminClient.auth.admin.inviteUserByEmail(trimmedEmail, {
              data: {
                full_name: trimmedName,
                phone: trimmedPhone,
                role_id: targetRole.id,
              },
              redirectTo: appRedirectUrl,
            });

          if (inviteError || !inviteData?.user?.id) {
            return Response.json(
              {
                error: `Failed to send user invitation: ${inviteError?.message || 'Could not create auth account.'}`,
              },
              { status: 400 }
            );
          }

          authUserId = inviteData.user.id;

          // Also generate an action link to display in the UI for easy copying if needed
          try {
            const { data: linkData } = await adminClient.auth.admin.generateLink({
              type: 'invite',
              email: trimmedEmail,
              options: {
                redirectTo: appRedirectUrl,
              },
            });
            if (linkData?.properties?.action_link) {
              inviteLink = linkData.properties.action_link;
            }
          } catch (linkEx) {
            console.warn('Notice: Direct invitation link generation notice:', linkEx);
          }
        } else {
          // Explicit password was intentionally provided by the manager
          const rawPassword = String(password).trim();
          if (rawPassword.length < 6) {
            return Response.json(
              { error: 'Password must be at least 6 characters long.' },
              { status: 400 }
            );
          }

          const { data: authResult, error: authError } = await adminClient.auth.admin.createUser({
            email: trimmedEmail,
            password: rawPassword,
            email_confirm: true,
            user_metadata: {
              full_name: trimmedName,
              phone: trimmedPhone,
              role_id: targetRole.id,
            },
          });

          if (authError || !authResult?.user?.id) {
            return Response.json(
              {
                error: `Authentication account creation failed: ${authError?.message || 'Could not create auth user.'}`,
              },
              { status: 400 }
            );
          }

          authUserId = authResult.user.id;

          // Generate password setup / recovery link for reference
          try {
            const { data: linkData } = await adminClient.auth.admin.generateLink({
              type: 'recovery',
              email: trimmedEmail,
              options: {
                redirectTo: appRedirectUrl,
              },
            });
            if (linkData?.properties?.action_link) {
              inviteLink = linkData.properties.action_link;
            }
          } catch (linkEx) {
            console.warn('Notice: Password recovery link notice:', linkEx);
          }
        }

        // 9. Create public.app_users profile with auth_user_id linked
        const newUserId = crypto.randomUUID();
        const { data: insertedUser, error: insertError } = await adminClient
          .from('app_users')
          .insert({
            id: newUserId,
            auth_user_id: authUserId,
            full_name: trimmedName,
            email: trimmedEmail,
            phone: trimmedPhone,
            role_id: targetRole.id,
            status: normalizedStatus,
          })
          .select('id, auth_user_id, full_name, email, phone, role_id, status, created_at, updated_at')
          .single();

        if (insertError) {
          // Clean up the created authentication account if profile insertion fails
          try {
            await adminClient.auth.admin.deleteUser(authUserId);
          } catch (cleanupErr) {
            console.error(
              'Failed to clean up authentication user after profile insertion failure:',
              cleanupErr
            );
          }

          return Response.json(
            {
              error: `Failed to create user profile in app_users: ${insertError.message}. The newly created authentication account was safely rolled back.`,
            },
            { status: 500 }
          );
        }

        // 10. Return success response (never exposing service role key or passwords)
        return Response.json({
          success: true,
          user: insertedUser,
          authUserId,
          inviteLink,
          invitationSent: !hasExplicitPassword,
          message: !hasExplicitPassword
            ? 'User invitation sent. The user can set their own password via email or the invitation link.'
            : 'User authentication account created and linked to profile.',
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return Response.json(
          { error: `Internal server error in create-user function: ${msg}` },
          { status: 500 }
        );
      }
    }
  ),
};
