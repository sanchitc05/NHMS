import { Phone, Mail, MapPin } from 'lucide-react';
import logoImage from '@/assets/logo.jpeg';

export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground mt-auto">
      <div className="gov-container py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Logo and About */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <img 
                src={logoImage} 
                alt="NHMS Logo" 
                className="w-10 h-10 rounded-full object-cover"
              />
              <h3 className="font-bold text-lg">NHMS</h3>
            </div>
            <p className="text-sm text-primary-foreground/70">
              Ensuring safer highways and efficient travel across the nation.
            </p>
          </div>

          {/* Emergency */}
          <div>
            <h4 className="font-semibold text-sm uppercase tracking-wider mb-4">Emergency</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/70">
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Highway Helpline: 1033
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Ambulance: 108
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Police: 100
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-sm uppercase tracking-wider mb-4">Contact Us</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/70">
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                support@nhms.gov.in
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Transport Bhawan, New Delhi
              </li>
            </ul>
          </div>

          {/* Team Points of Contact */}
          <div>
            <h4 className="font-semibold text-sm uppercase tracking-wider mb-4">Points of Contact</h4>
            <ul className="space-y-3 text-sm text-primary-foreground/70">
              <li className="flex flex-col gap-1">
                <span className="font-semibold text-primary-foreground/90">Aarna Garg</span>
                <a href="tel:+919368410466" className="flex items-center gap-2 hover:text-white transition-colors"><Phone className="w-3 h-3" /> +91 93684 10466</a>
              </li>
              <li className="flex flex-col gap-1">
                <span className="font-semibold text-primary-foreground/90">Garima Singh</span>
                <a href="tel:+917696033864" className="flex items-center gap-2 hover:text-white transition-colors"><Phone className="w-3 h-3" /> +91 76960 33864</a>
              </li>
              <li className="flex flex-col gap-1">
                <span className="font-semibold text-primary-foreground/90">Kirti</span>
                <a href="tel:+918527503823" className="flex items-center gap-2 hover:text-white transition-colors"><Phone className="w-3 h-3" /> +91 85275 03823</a>
              </li>
              <li className="flex flex-col gap-1">
                <span className="font-semibold text-primary-foreground/90">Akilah</span>
                <a href="tel:+919058202922" className="flex items-center gap-2 hover:text-white transition-colors"><Phone className="w-3 h-3" /> +91 90582 02922</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-primary-foreground/20 mt-8 pt-8 text-center text-sm text-primary-foreground/60">
          <p>© 2024 National Highway Management System. Government of India. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
