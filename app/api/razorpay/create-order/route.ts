import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(request: NextRequest) {
  try {
    const { amount, planName, userId, userEmail } = await request.json();

    if (!amount || !planName || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: amount, // Amount in paise (already multiplied by 100 on frontend)
      currency: "INR",
      receipt: `receipt_${userId}_${Date.now()}`,
      notes: {
        planName,
        userId,
        userEmail,
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
    });
  } catch (error) {
    console.error("Razorpay order creation error:", error);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}
