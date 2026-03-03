-- Seat System
-- Enables subscription owners to invite members who share Full Access.
-- Two capacities: 3-seat (owner + 2 members) and 5-seat (owner + 4 members).
--
-- seat_accounts: one row per seat subscription owner.
--   The owner's profiles.membership_plan is set to "individual" so isPremium()
--   continues to work without change. This table tracks capacity separately.
--
-- seat_members: one row per invite sent by an owner.
--   Statuses: invited → active → revoked/expired
--   invite_token: 64-char hex, expires in 7 days, unique constraint.

-- ----------------------------------------------------------------------------
-- seat_accounts
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.seat_accounts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_subscription_id text NOT NULL,
  stripe_customer_id    text NOT NULL,
  seat_limit            int NOT NULL CHECK (seat_limit IN (3, 5)),
  status                text NOT NULL CHECK (status IN ('active', 'trialing', 'past_due', 'canceled')),
  current_period_end    timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seat_accounts_owner_unique UNIQUE (owner_user_id),
  CONSTRAINT seat_accounts_subscription_unique UNIQUE (stripe_subscription_id)
);

COMMENT ON TABLE public.seat_accounts IS
  'One row per seat subscription. Tracks owner, Stripe subscription, seat capacity, and status.';

ALTER TABLE public.seat_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seat_accounts_select_owner"
  ON public.seat_accounts FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

-- All writes via service role (webhooks + API routes use admin client)
CREATE POLICY "seat_accounts_service_role_all"
  ON public.seat_accounts TO service_role
  USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- seat_members
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.seat_members (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_account_id  uuid NOT NULL REFERENCES public.seat_accounts(id) ON DELETE CASCADE,
  invite_email     text NOT NULL,
  status           text NOT NULL CHECK (status IN ('invited', 'active', 'revoked', 'expired')),
  invite_token     text NOT NULL,
  invited_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL,
  accepted_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  accepted_at      timestamptz,
  revoked_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seat_members_token_unique UNIQUE (invite_token)
);

COMMENT ON TABLE public.seat_members IS
  'One row per invite. Tracks invite email, token, expiry, and acceptance.';

ALTER TABLE public.seat_members ENABLE ROW LEVEL SECURITY;

-- Active members can read the account they belong to
CREATE POLICY "seat_accounts_select_member"
  ON public.seat_accounts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.seat_members sm
      WHERE sm.seat_account_id = id
        AND sm.accepted_user_id = auth.uid()
        AND sm.status = 'active'
    )
  );

-- Owner can read all members of their seat_account
CREATE POLICY "seat_members_select_owner"
  ON public.seat_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.seat_accounts sa
      WHERE sa.id = seat_account_id
        AND sa.owner_user_id = auth.uid()
    )
  );

-- Accepted member can read their own row
CREATE POLICY "seat_members_select_self"
  ON public.seat_members FOR SELECT TO authenticated
  USING (accepted_user_id = auth.uid());

-- All writes via service role
CREATE POLICY "seat_members_service_role_all"
  ON public.seat_members TO service_role
  USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS seat_members_accepted_user_id_idx
  ON public.seat_members (accepted_user_id)
  WHERE accepted_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS seat_members_invite_token_idx
  ON public.seat_members (invite_token);

CREATE INDEX IF NOT EXISTS seat_members_seat_account_id_status_idx
  ON public.seat_members (seat_account_id, status);
