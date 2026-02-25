import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { orderId, paymentId, signature, userId } = await request.json();

    if (!orderId || !paymentId || !signature || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify payment signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (generatedSignature !== signature) {
      return NextResponse.json(
        { error: "Payment verification failed" },
        { status: 400 }
      );
    }

    // TODO: Update user profile in Convex/Database to mark as Premium
    // Example:
    // await updateUserPremiumStatus(userId, true);
    // Or integrate with Convex:
    // const convex = new ConvexClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    // await convex.mutation(api.users.updatePremium, { userId, isPremium: true });

    console.log(`Payment verified for user ${userId}: ${paymentId}`);

    return NextResponse.json({
      success: true,
      message: "Payment verified successfully",
      paymentId,
      orderId,
      userId,
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    return NextResponse.json(
      { error: "Payment verification failed" },
      { status: 500 }
    );
  }
}
