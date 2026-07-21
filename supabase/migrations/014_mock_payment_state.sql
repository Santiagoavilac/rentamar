-- Fase 2 — Estado privado del proveedor mock. Emula el sistema del banco externo.
-- NO es parte del dominio de RentaMar: solo lo leen/escriben MockPaymentProvider y
-- los endpoints dev de simulación. Nunca expuesto al cliente.

create table public.mock_payment_state (
  external_id text primary key,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'expired', 'error')),
  updated_at timestamptz not null default now()
);
