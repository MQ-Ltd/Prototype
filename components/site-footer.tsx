import { Github, Twitter, Linkedin } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="w-full border-t border-white/10 bg-black pt-16 pb-8 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
        <div>
          <h2 className="text-2xl font-bold tracking-tighter mb-4 text-white">
            Musi<span className="text-[#C1e328]">Q</span>
          </h2>
          <p className="text-neutral-500 max-w-xs text-sm leading-relaxed">
            Bridging the gap between acoustic instruments and digital intelligence through real-time feedback loops.
          </p>
        </div>
        <div className="flex gap-16 text-sm">
          <div className="flex flex-col gap-4">
            <span className="text-white font-semibold">Product</span>
            <span className="text-neutral-500 hover:text-[#C1e328] cursor-pointer transition-colors">Vision Engine</span>
            <span className="text-neutral-500 hover:text-[#C1e328] cursor-pointer transition-colors">Audio DSP</span>
            <span className="text-neutral-500 hover:text-[#C1e328] cursor-pointer transition-colors">Combined Mode</span>
          </div>
          <div className="flex flex-col gap-4">
            <span className="text-white font-semibold">Socials</span>
            <div className="flex gap-4">
              <Github className="w-5 h-5 text-neutral-500 hover:text-white cursor-pointer transition-colors" />
              <Twitter className="w-5 h-5 text-neutral-500 hover:text-white cursor-pointer transition-colors" />
              <Linkedin className="w-5 h-5 text-neutral-500 hover:text-white cursor-pointer transition-colors" />
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-xs text-neutral-600 gap-4">
        <span>© 2025 MusiQ Project. All rights reserved.</span>
        <span className="font-mono">v1.0.0-beta</span>
      </div>
    </footer>
  );
}
