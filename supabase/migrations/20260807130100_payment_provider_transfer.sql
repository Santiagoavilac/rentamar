-- El BNB ya no se usa como pasarela. El pago real es una transferencia/QR bancario por
-- fuera del sistema y el cliente sube el comprobante. Este proveedor representa ese canal.
alter type public.payment_provider add value if not exists 'transfer';
