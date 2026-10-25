import React from 'react';
import { 
  ShieldCheck, 
  ChevronRight, 
  FileCheck2, 
  Lock, 
  ExternalLink,
  Award,
  Factory,
  Globe,
  MapPin,
  Phone,
  Mail
} from 'lucide-react';

export const CompanyLandingPage: React.FC<{
  onNavigateToPortal: () => void;
  onOpenScanner: () => void;
}> = ({ onNavigateToPortal, onOpenScanner }) => {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-slate-900 selection:text-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 md:h-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white">
                <Factory className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-lg leading-tight tracking-tight uppercase">MYMF Industries</span>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none">Steel Fabrication & Galvanizing</span>
              </div>
            </div>
            
            <div className="hidden md:flex items-center gap-8">
              <a href="#about" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">About</a>
              <a href="#services" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">Services</a>
              <a href="#contact" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">Contact</a>
              <button 
                onClick={onNavigateToPortal}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all active:scale-95"
              >
                <Lock className="w-4 h-4" />
                Staff Portal
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-slate-50 rounded-full blur-3xl -z-10 opacity-60" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-widest mb-8 border border-emerald-100 shadow-sm">
            <ShieldCheck className="w-4 h-4" />
            Blockchain-Secured QA/QC Registry
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 max-w-4xl mx-auto leading-[1.1]">
            Uncompromising Quality in <span className="text-slate-500">Metal Protection.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-500 mb-12 max-w-2xl mx-auto leading-relaxed font-medium">
            Mohammed Yehya Al-Aseery Factory provides world-class hot-dip galvanizing services certified to international BS EN ISO 1461 standards.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={onOpenScanner}
              className="w-full sm:w-auto px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:shadow-2xl hover:scale-105 transition-all"
            >
              <FileCheck2 className="w-5 h-5" />
              Verify Certificate
            </button>
            <button 
              onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full sm:w-auto px-8 py-4 bg-white text-slate-900 border-2 border-slate-200 rounded-2xl font-bold flex items-center justify-center gap-3 hover:border-slate-900 transition-all"
            >
              Explore Services
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Stats / Proof */}
      <section className="py-24 bg-slate-900 text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                <Award className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-3xl font-black">BS EN ISO 1461</h3>
              <p className="text-slate-400 font-medium">Strict adherence to international galvanization standards for maximum longevity.</p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                <Globe className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-3xl font-black">10,000+ Projects</h3>
              <p className="text-slate-400 font-medium">Delivering structural integrity to critical infrastructure across the Middle East.</p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                <Lock className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-3xl font-black">Digital Trust</h3>
              <p className="text-slate-400 font-medium">Instant QR-based verification ensuring document authenticity and security.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section id="services" className="py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-16">
            <div className="max-w-xl">
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-4">What We Do</h2>
              <h3 className="text-4xl font-black leading-tight">Advanced Protection for Structural Steel</h3>
            </div>
            <div className="text-slate-500 font-medium max-w-sm">
              From urban infrastructure to remote telecom towers, we ensure every component is built to last.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: 'Hot-Dip Galvanizing', desc: 'Superior corrosion protection using molten zinc immersion.' },
              { title: 'Steel Fabrication', desc: 'Precision manufacturing of towers, mounts, and brackets.' },
              { title: 'QA/QC Inspection', desc: 'Rigorous testing of DFT and coating uniformity.' },
              { title: 'Infrastructure Solutions', desc: 'End-to-end support for energy and telecom sectors.' }
            ].map((service, idx) => (
              <div key={idx} className="group p-8 bg-slate-50 rounded-3xl border border-slate-100 hover:bg-white hover:border-slate-900 transition-all duration-500">
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                  <span className="font-black text-sm">0{idx + 1}</span>
                </div>
                <h4 className="text-lg font-black mb-3">{service.title}</h4>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer / Contact */}
      <footer id="contact" className="bg-slate-50 border-t border-slate-200 pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-24">
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white">
                  <Factory className="w-6 h-6" />
                </div>
                <span className="font-black text-xl tracking-tight uppercase">MYMF Factory</span>
              </div>
              <p className="text-slate-500 font-medium max-w-md mb-8">
                Mohammed Yehya Al-Aseery Factory For Metal Industries is a leader in corrosion protection and metal fabrication.
              </p>
              <div className="flex gap-4">
                <a href="#" className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all">
                  <Globe className="w-4 h-4" />
                </a>
                <a href="#" className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all">
                  <Mail className="w-4 h-4" />
                </a>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
              <div className="space-y-6">
                <h5 className="font-black uppercase tracking-widest text-xs text-slate-400">Headquarters</h5>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3 text-sm font-semibold">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <span>PO Box 370372, Riyadh 11325, Saudi Arabia</span>
                  </li>
                  <li className="flex items-start gap-3 text-sm font-semibold">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <span>+966 11 498 2211</span>
                  </li>
                  <li className="flex items-start gap-3 text-sm font-semibold">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <span>info@mymf.com.sa</span>
                  </li>
                </ul>
              </div>
              <div className="space-y-6">
                <h5 className="font-black uppercase tracking-widest text-xs text-slate-400">Compliance</h5>
                <div className="space-y-2">
                  <p className="text-sm font-bold">CR: 1010997047</p>
                  <p className="text-sm font-bold">VAT: 302154658900006</p>
                  <p className="text-sm font-bold text-emerald-600">ISO 9001:2015 Certified</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
            <p>© 2026 Mohammed Yehya Al-Aseery Factory. All rights reserved.</p>
            <div className="flex gap-8">
              <a href="#" className="hover:text-slate-900 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-slate-900 transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
