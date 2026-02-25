"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { RazorpayCheckout } from "@/components/razorpay-checkout";
import { Button } from "@/components/ui/button";

const PLANS = [
  {
    name: "Starter",
    price: 99,
    features: [
      "2 hours/month practice",
      "Basic chord detection",
      "Standard hand tracking",
    ],
  },
  {
    name: "Pro",
    price: 299,
    features: [
      "Unlimited practice hours",
      "Advanced AI feedback",
      "Personalized progress tracking",
      "Premium hand tracking",
    ],
    popular: true,
  },
  {
    name: "Premium",
    price: 599,
    features: [
      "Everything in Pro",
      "1-on-1 video lessons",
      "Advanced analytics",
      "Export progress reports",
    ],
  },
];

export default function PricingPage() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  return (
    <>
      <main className="w-full text-white bg-black min-h-screen">
        {/* Navbar */}
        <div className="fixed top-0 left-0 right-0 z-50">
          <Navbar />
        </div>

        {/* Pricing Container */}
        <section className="relative z-10 w-full min-h-screen flex flex-col items-center justify-center px-6 pt-24">
          {/* Back Button */}
          <div className="absolute top-24 left-6">
            <Link
              href="/"
              className="group flex items-center gap-2 text-white/50 hover:text-white transition-all duration-300"
            >
              <span className="flex items-center justify-center w-8 h-8 rounded-full border border-white/20 group-hover:border-white/40 group-hover:bg-white/5 transition-all">
                <ChevronLeft className="w-4 h-4" />
              </span>
              <span className="text-sm font-medium">Home</span>
            </Link>
          </div>

          {/* Header */}
          <div className="text-center mb-16 max-w-2xl">
            <h1 className="text-5xl font-bold mb-4">
              Choose Your <span style={{ color: "#C1e328" }}>Plan</span>
            </h1>
            <p className="text-white/60 text-lg">
              Unlock your full potential with MusiQ Premium
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mb-12">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border transition-all duration-300 p-8 ${
                  plan.popular
                    ? "border-[#C1e328] bg-white/5 scale-105 shadow-2xl"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#C1e328] text-black px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </div>
                )}

                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold">₹{plan.price}</span>
                  <span className="text-white/60">/month</span>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <span className="text-[#C1e328] mt-1">✓</span>
                      <span className="text-white/80">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div
                  onClick={() => setSelectedPlan(plan.name)}
                  className="w-full"
                >
                  {selectedPlan === plan.name ? (
                    <RazorpayCheckout
                      amount={plan.price}
                      planName={plan.name}
                      onSuccess={(paymentId) => {
                        alert(
                          `Payment successful! Payment ID: ${paymentId}\nPlan activated for you.`
                        );
                        setSelectedPlan(null);
                      }}
                      onError={(error) => {
                        alert(`Payment failed: ${error}`);
                        setSelectedPlan(null);
                      }}
                    />
                  ) : (
                    <Button
                      className={`w-full py-6 text-base font-semibold transition-all ${
                        plan.popular
                          ? "bg-[#C1e328] text-black hover:bg-[#C1e328]/90"
                          : "bg-white/10 text-white hover:bg-white/20 border border-white/20"
                      }`}
                    >
                      Get {plan.name}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* FAQ Section */}
          <div className="max-w-2xl mt-24">
            <h2 className="text-3xl font-bold mb-8 text-center">
              Questions?
            </h2>
            <div className="space-y-6">
              <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                <h4 className="font-semibold mb-2 text-[#C1e328]">
                  Can I change plans anytime?
                </h4>
                <p className="text-white/60">
                  Yes, you can upgrade or downgrade your plan at any time. Changes take effect
                  immediately.
                </p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                <h4 className="font-semibold mb-2 text-[#C1e328]">
                  What payment methods do you accept?
                </h4>
                <p className="text-white/60">
                  We accept all UPI methods, credit/debit cards, and other payment methods
                  supported by Razorpay.
                </p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                <h4 className="font-semibold mb-2 text-[#C1e328]">
                  Is my payment secure?
                </h4>
                <p className="text-white/60">
                  All payments are processed securely through Razorpay with industry-standard
                  encryption.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
