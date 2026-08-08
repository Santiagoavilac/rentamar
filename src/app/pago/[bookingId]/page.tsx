import PaymentClient, { type BankInfo } from "./PaymentClient";

// Página de pago standalone. Se accede con ?token= (invitado) o con sesión del
// dueño. El token se lee client-side; nunca pasa por props del servidor ni logs.
export default async function PaymentPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;

  // Datos bancarios globales para transferir. No son secretos (van al cliente).
  const bank: BankInfo = {
    holder: process.env.RECEIPT_BANK_HOLDER || "",
    account: process.env.RECEIPT_BANK_ACCOUNT || "",
    bank: process.env.RECEIPT_BANK_NAME || "",
    qrImagePath: process.env.RECEIPT_BANK_QR_PATH || "",
  };

  return <PaymentClient bookingId={bookingId} bank={bank} />;
}
