"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export function Navbar() {
  return (
    <header className="w-full fixed top-0 z-50 bg-black/40 backdrop-blur-lg border-b border-white/10">
      <div className="max-w-6xl mx-auto h-16 px-6 flex items-center justify-between">

        {/* Brand */}
        <Link href="/" className="flex items-center gap-1 text-xl font-bold font-brand">
          <Image 
            src="/logo.png" 
            alt="MusiQ Logo" 
            width={32} 
            height={32}
            className="rounded-lg"
          />
          <span>Musi<span style={{ color: "#C1e328" }}>Q</span></span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-4">
          <Link href="/pricing" className="text-white/60 hover:text-white transition-colors">
            Pricing
          </Link>
          <SignedOut>
            <Link href="/login">
              <Button className="bg-white/10 text-white hover:bg-white/20 font-semibold border border-white/20">
                Sign in
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-[#C1e328] text-black hover:bg-[#C1e328]/90 font-semibold">
                Sign up
              </Button>
            </Link>
          </SignedOut>
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>

        {/* Mobile Menu */}
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6 text-gray-300" />
              </Button>
            </SheetTrigger>

            <SheetContent side="right" className="bg-black p-6 w-64 text-white border-l border-white/10">
              <nav className="flex flex-col space-y-4 mt-6 text-lg">
                <Link href="/pricing" className="w-full">
                  <Button className="w-full bg-white/10 text-white hover:bg-white/20 font-semibold border border-white/20">
                    Pricing
                  </Button>
                </Link>
                <SignedOut>
                  <Link href="/login" className="w-full">
                    <Button className="w-full bg-white/10 text-white hover:bg-white/20 font-semibold border border-white/20">
                      Sign in
                    </Button>
                  </Link>
                  <Link href="/signup" className="w-full">
                    <Button className="w-full bg-[#C1e328] text-black hover:bg-[#C1e328]/90 font-semibold">
                      Sign up
                    </Button>
                  </Link>
                </SignedOut>
                <SignedIn>
                  <UserButton afterSignOutUrl="/" />
                </SignedIn>
              </nav>
            </SheetContent>

          </Sheet>
        </div>

      </div>
    </header>
  );
}
