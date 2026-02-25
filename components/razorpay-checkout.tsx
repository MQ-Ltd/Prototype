"use client";

import { useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface RazorpayCheckoutProps {
  amount: number; // Amount in INR (paise, so multiply by 100)
  planName: string;
  onSuccess?: (paymentId: string) => void;
  onError?: (error: string) => void;
}

export function RazorpayCheckout({
  amount,
  planName,
  onSuccess,
  onError,
}: RazorpayCheckoutProps) {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Load Razorpay SDK
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => {
      console.error("Failed to load Razorpay SDK");
      onError?.("Failed to load payment SDK");
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [onError]);

  const handlePayment = async () => {
    if (!isSignedIn || !user) {
      onError?.("Please sign in first");
      return;
    }

    if (!scriptLoaded) {
      onError?.("Payment SDK not loaded");
      return;
    }

    setLoading(true);

    try {
      // Create Razorpay order on backend
      const response = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amount * 100, // Convert to paise (1 INR = 100 paise)
          planName,
          userId: user.id,
          userEmail: user.primaryEmailAddress?.emailAddress,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create order");
      }

      const { orderId } = await response.json();

      // Razorpay payment options
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: amount * 100, // Amount in paise
        currency: "INR",
        name: "MusiQ",
        description: `${planName} Plan`,
        order_id: orderId,
        prefill: {
          name: user.firstName || "",
          email: user.primaryEmailAddress?.emailAddress || "",
        },
        theme: {
          color: "#C1e328",
        },
        handler: async (response: any) => {
          try {
            // Verify payment on backend
            const verifyResponse = await fetch("/api/razorpay/verify-payment", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                userId: user.id,
              }),
            });

            if (!verifyResponse.ok) {
              throw new Error("Payment verification failed");
            }

            onSuccess?.(response.razorpay_payment_id);
          } catch (error) {
            console.error("Payment verification error:", error);
            onError?.(
              error instanceof Error ? error.message : "Payment verification failed"
            );
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      console.error("Payment error:", error);
      onError?.(error instanceof Error ? error.message : "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handlePayment}
      disabled={loading || !scriptLoaded || !isSignedIn}
      className="bg-[#C1e328] text-black hover:bg-[#C1e328]/90 font-semibold"
    >
      {loading ? "Processing..." : `Pay ₹${amount} - ${planName}`}
    </Button>
  );
}
