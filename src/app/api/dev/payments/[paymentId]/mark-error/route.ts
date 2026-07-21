import { handleSimulate } from "../handler";

export async function POST(request: Request, ctx: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await ctx.params;
  return handleSimulate(request, paymentId, "error");
}
