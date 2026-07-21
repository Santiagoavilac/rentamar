import PaymentClient from "./PaymentClient";

// Página de pago standalone. Se accede con ?token= (invitado) o con sesión del
// dueño. El token se lee client-side; nunca pasa por props del servidor ni logs.
export default async function PaymentPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return <PaymentClient bookingId={bookingId} />;
}
