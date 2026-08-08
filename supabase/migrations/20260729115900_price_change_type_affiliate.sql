-- Nuevo tipo de cambio de precio para la tarifa de afiliados.
-- Va en su propia migracion: un valor de enum no puede usarse en la misma
-- transaccion en que se agrega, y la migracion siguiente ya lo referencia.
alter type public.price_change_type add value if not exists 'affiliate_price';
