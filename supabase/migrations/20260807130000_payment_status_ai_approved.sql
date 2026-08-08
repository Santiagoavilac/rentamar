-- Nuevo estado de pago para el flujo de comprobantes: la IA aprobó el comprobante
-- ('AI_APPROVED') pero la reserva todavía NO está confirmada por un humano (Modo B).
-- Se distingue de 'paid' ('BANK_CONFIRMED') para no cambiar el significado de "pagado".
--
-- Un valor de enum nuevo va en su propia migración: Postgres no permite usarlo en la
-- misma transacción en que se agrega.
alter type public.payment_status add value if not exists 'ai_approved';
