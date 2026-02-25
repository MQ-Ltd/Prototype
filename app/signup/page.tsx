"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/navbar";
import { ChevronLeft } from "lucide-react";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  const [showContent, setShowContent] = useState(false);

  // Show content on mount
  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <motion.main 
        className="w-full text-white bg-black min-h-screen"
      >
        {/* Navbar */}
        <motion.div
          className="fixed top-0 left-0 right-0 z-50"
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <Navbar />
        </motion.div>

        {/* Sign Up Container */}
        <section className="relative z-10 w-full min-h-screen flex items-center justify-center px-6 pt-20">
          {/* Back Button */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: showContent ? 1 : 0, x: showContent ? 0 : -20 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="absolute top-24 left-6"
          >
            <Link 
              href="/"
              className="group flex items-center gap-2 text-white/50 hover:text-white transition-all duration-300"
            >
              <span className="flex items-center justify-center w-8 h-8 rounded-full border border-white/20 group-hover:border-white/40 group-hover:bg-white/5 transition-all">
                <ChevronLeft className="w-4 h-4" />
              </span>
              <span className="text-sm font-medium">Home</span>
            </Link>
          </motion.div>

          {/* Clerk SignUp Component */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: showContent ? 1 : 0, scale: showContent ? 1 : 0.95 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative z-10"
          >
            <SignUp 
              appearance={{
                baseTheme: "dark",
                elements: {
                  rootBox: "w-full",
                  card: "bg-black border border-white/10 rounded-2xl shadow-2xl",
                  cardBox: "bg-black",
                  header: "bg-black border-b border-white/10",
                  headerTitle: "text-white text-2xl font-bold",
                  headerSubtitle: "text-white text-sm",
                  socialButtonsBlockButton: "border border-white/30 bg-white/10 text-white hover:bg-white/20 min-h-[44px]",
                  socialButtonsBlockButtonText: "text-white font-medium text-sm ml-2",
                  socialButtonIcon: "!text-white",
                  dividerLine: "bg-white/10",
                  dividerText: "text-white/50 text-xs",
                  formFieldLabel: "text-white/80 font-medium text-sm",
                  formFieldLabelRequired: "text-red-400",
                  formFieldInput: "bg-white/5 border border-white/20 text-white placeholder-white/40 focus:border-[#C1e328] focus:ring-2 focus:ring-[#C1e328]/30 rounded-lg",
                  formFieldInputShowPasswordButton: "text-white/60 hover:text-white",
                  formButtonPrimary: "bg-black text-black border border-white/30 hover:bg-white hover:text-black hover:border-white/50 font-semibold rounded-lg",
                  formButtonPrimaryText: "text-black font-semibold",
                  formButtonPrimaryLoadingSpinner: "text-white",
                  footerActionLink: "text-[#C1e328] hover:text-[#C1e328]/80 font-semibold",
                  footerActionText: "text-white/60 text-sm",
                  footerPageLink: "text-[#C1e328] hover:text-[#C1e328]/80",
                  identityPreview: "bg-white/5 border border-white/10 text-white rounded-lg",
                  identityPreviewText: "text-white/80",
                  identityPreviewEditButtonIcon: "text-white/60",
                  identityPreviewEditButton: "hover:bg-white/10",
                  backupCodeFieldInputBox: "bg-white/5 border border-white/20 text-white",
                  codeBox: "bg-black border border-white/10",
                  otpCodeFieldInput: "bg-white/5 border border-white/20 text-white",
                  badge: "bg-white/10 text-white",
                  alertBox: "bg-red-500/10 border border-red-500/20",
                  alertText: "text-red-400",
                  logoutButton: "text-white/60 hover:text-white"
                },
                variables: {
                  colorPrimary: "#000000",
                  colorBackground: "#000000",
                  colorInputBackground: "rgba(255,255,255,0.05)",
                  colorInputBorder: "rgba(255,255,255,0.2)",
                  colorInputText: "#ffffff",
                  colorText: "#ffffff",
                  colorTextSecondary: "rgba(255,255,255,0.6)",
                  colorNeutral: "rgba(255,255,255,0.1)",
                  colorTextOnPrimaryBackground: "#000000",
                  borderRadius: "0.5rem"
                }
              }}
              redirectUrl="/"
            />
            <style>{`
              .cl-socialButtonsBlockButton {
                border-color: rgba(255, 255, 255, 0.6) !important;
                background-color: rgba(255, 255, 255, 1) !important;
                color: #000000 !important;
              }
              .cl-socialButtonsBlockButton:hover {
                background-color: rgba(255, 255, 255, 0.8) !important;
              }
              .cl-socialButtonsBlockButton svg {
                filter: brightness(0) invert(1) !important;
              }
              .cl-formButtonPrimary {
                background-color: #C1e328 !important;
                color: #000000 !important;
                border: 1px solid #C1e328 !important;
              }
              .cl-formButtonPrimary:hover {
                background-color: #C1e328 !important;
                opacity: 0.9;
                color: #000000 !important;
              }
              .cl-formButtonPrimary span {
                color: #000000 !important;
                font-weight: 600 !important;
              }
              .cl-headerTitle {
                background: linear-gradient(90deg, #ffffff 0%, #ffffff 92%, #C1e328 100%);
                -webkit-background-clip: text;
                background-clip: text;
                -webkit-text-fill-color: transparent;
              }
              .cl-footerActionLink {
                color: #C1e328 !important;
              }
              .cl-footerActionLink:hover {
                color: #C1e328 !important;
                opacity: 0.8;
              }
            `}</style>
          </motion.div>
        </section>
      </motion.main>
    </>
  );
}
