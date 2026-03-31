import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Layout } from '@/components/layout/Layout';
import {
  MapPin,
  IndianRupee,
  AlertTriangle,
  ChevronRight,
  Gauge,
  Cloud,
  MessageCircle,
  Phone,
  ShieldCheck,
  Zap,
  Linkedin,
  Instagram,
  Mail,
} from 'lucide-react';

const features = [
  {
    icon: MapPin,
    title: 'Route Planning',
    description: 'Multiple route options with time, distance, and cost comparison',
  },
  {
    icon: IndianRupee,
    title: 'Toll Calculator',
    description: 'Accurate toll estimates based on vehicle type and route',
  },
  {
    icon: Cloud,
    title: 'Live Updates',
    description: 'Real-time traffic and weather conditions along your route',
  },
  {
    icon: Gauge,
    title: 'Speed Monitoring',
    description: 'Automatic speed limit alerts and overspeeding warnings',
  },
  {
    icon: AlertTriangle,
    title: 'Emergency Assistance',
    description: 'Quick access to hospitals, police, and helpline 1033',
  },
  {
    icon: MessageCircle,
    title: 'Virtual Assistant',
    description: '24/7 chatbot support for all your highway queries',
  },
];

const stats = [
  { label: 'National Highways', value: '150,000+ km' },
  { label: 'Toll Plazas', value: '800+' },
  { label: 'Emergency Centers', value: '2,500+' },
  { label: 'Daily Travelers', value: '50 Lakh+' },
];

export default function Index() {
  return (
    <Layout showChatbot={true}>
      {/* Hero Section */}
      <section className="relative min-h-screen overflow-hidden flex items-center justify-center pt-20">
        <div className="absolute inset-0 z-0 bg-[#0B0F19]" />
        
        {/* Animated Gradient Background Orbs */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[10%] left-[20%] w-[35rem] h-[35rem] bg-primary/30 rounded-full blur-[120px] animate-pulse-slow mix-blend-screen" />
          <div className="absolute bottom-[20%] right-[10%] w-[45rem] h-[45rem] bg-accent/20 rounded-full blur-[150px] animate-float mix-blend-screen" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60rem] h-[60rem] bg-indigo-600/10 rounded-full blur-[130px]" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
        </div>

        <div className="gov-container relative z-10 w-full">
          <div className="max-w-4xl mx-auto text-center animate-slide-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary mb-8 font-medium text-sm backdrop-blur-sm">
              <Zap className="w-4 h-4" />
              <span>Next-Gen Highway Intelligence</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-extrabold text-foreground mb-6 leading-tight tracking-tight">
              National Highway <br />
              <span className="text-gradient font-black">Management System</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto font-light leading-relaxed">
              Your intelligent travel companion for safer, efficient, and hassle-free highway journeys across India.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-5 justify-center items-center">
              <Button asChild size="xl" className="h-14 px-8 text-lg rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow-primary transition-all duration-300 hover:scale-105">
                <Link to="/register">
                  Get Started
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="xl" className="h-14 px-8 text-lg rounded-full border-border/60 bg-background/50 backdrop-blur-sm hover:bg-muted transition-all duration-300">
                <Link to="/login">
                  Sign In
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative z-20 -mt-16 lg:-mt-24">
        <div className="gov-container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
            {stats.map((stat, idx) => (
              <div key={stat.label} className="glass-card flex flex-col items-center justify-center p-6 lg:p-8 animate-fade-in hover:scale-105 transition-all duration-300 border-white/10 bg-white/5 backdrop-blur-2xl hover:border-primary/50 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)]" style={{ animationDelay: `${idx * 100}ms` }}>
                <p className="text-3xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-primary to-accent mb-2 drop-shadow-sm">{stat.value}</p>
                <p className="text-xs lg:text-sm text-muted-foreground font-semibold uppercase tracking-widest">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 lg:py-32 relative bg-background">
        <div className="absolute inset-0 bg-grid-black/[0.02] dark:bg-grid-white/[0.02] bg-[size:30px_30px]" />
        <div className="gov-container relative z-10">
          <div className="text-center mb-16 animate-fade-in max-w-3xl mx-auto">
            <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-6 tracking-tight">
              Everything You Need for <span className="text-gradient">Safe Travel</span>
            </h2>
            <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed">
              Experience the next generation of highway management with our comprehensive suite of advanced safety and convenience tools.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="gov-card group hover:shadow-glow-primary transition-all duration-300 animate-fade-in bg-background"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary group-hover:shadow-glow-primary transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
                    <Icon className="w-7 h-7 text-primary group-hover:text-primary-foreground transition-colors" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-muted/50">
        <div className="gov-container">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground">
              Simple steps to start your journey with NHMS
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Register', desc: 'Create your account with vehicle details' },
              { step: '2', title: 'Plan Route', desc: 'Enter source and destination to see options' },
              { step: '3', title: 'Travel Safe', desc: 'Get real-time updates and emergency support' },
            ].map((item, idx) => (
              <div key={item.step} className="text-center animate-fade-in" style={{ animationDelay: `${idx * 150}ms` }}>
                <div className="w-16 h-16 rounded-full bg-accent text-accent-foreground text-2xl font-bold flex items-center justify-center mx-auto mb-4 shadow-glow">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary z-0" />
        <div className="absolute inset-0 bg-[url('/background.jpeg')] opacity-10 mix-blend-overlay z-0 bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary to-transparent z-0" />
        
        <div className="gov-container relative z-10 text-center">
          <ShieldCheck className="w-20 h-20 text-primary-foreground/90 mx-auto mb-8 animate-pulse-slow" />
          <h2 className="text-4xl lg:text-5xl font-black text-primary-foreground mb-6 tracking-tight">
            Ready to Start Your Journey?
          </h2>
          <p className="text-xl lg:text-2xl text-primary-foreground/80 mb-10 max-w-3xl mx-auto font-light leading-relaxed">
            Join millions of smart travelers using NHMS for safer, more efficient, and premium highway experiences.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Button asChild size="xl" className="h-14 px-8 text-lg rounded-full bg-white text-primary hover:bg-gray-100 shadow-xl transition-all hover:scale-105 font-semibold">
              <Link to="/register">
                Start For Free
                <ChevronRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="xl" className="h-14 px-8 text-lg rounded-full border-2 border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:border-primary-foreground transition-all">
              <a href="tel:1033">
                <Phone className="w-5 h-5 mr-3" />
                Emergency 1033
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-24 bg-background relative" id="contact">
        <div className="absolute inset-0 bg-grid-black/[0.02] dark:bg-grid-white/[0.02] bg-[size:30px_30px]" />
        <div className="gov-container relative z-10">
          <div className="text-center mb-16 animate-fade-in max-w-3xl mx-auto">
            <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-6 tracking-tight">
              Get in <span className="text-gradient">Touch</span>
            </h2>
            <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed">
              We're here to help! Connect with us through our socials or reach out to our team members directly.
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            {/* Social Links */}
            <div className="glass-card bg-white/40 dark:bg-black/20 p-10 flex flex-col items-center text-center hover:border-primary/50 transition-all duration-300 group shadow-xl">
              <h3 className="text-2xl font-bold mb-8 text-foreground group-hover:text-primary transition-colors">Connect with Us</h3>
              <div className="flex flex-wrap justify-center gap-6">
                <a href="#" className="flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-muted/80 transition-all hover:scale-105 hover:text-blue-600">
                  <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                    <Linkedin className="w-7 h-7" />
                  </div>
                  <span className="font-semibold text-sm">LinkedIn</span>
                </a>
                <a href="#" className="flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-muted/80 transition-all hover:scale-105 hover:text-pink-600">
                  <div className="w-14 h-14 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 shadow-sm">
                    <Instagram className="w-7 h-7" />
                  </div>
                  <span className="font-semibold text-sm">Instagram</span>
                </a>
                <a href="#" className="flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-muted/80 transition-all hover:scale-105 hover:text-green-600">
                  <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-green-600 shadow-sm">
                    <MessageCircle className="w-7 h-7" />
                  </div>
                  <span className="font-semibold text-sm">WhatsApp</span>
                </a>
                <a href="mailto:support@nhms.gov.in" className="flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-muted/80 transition-all hover:scale-105 hover:text-red-500">
                  <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center text-red-500 shadow-sm">
                    <Mail className="w-7 h-7" />
                  </div>
                  <span className="font-semibold text-sm">Email</span>
                </a>
              </div>
            </div>

          </div>
        </div>
      </section>

    </Layout>
  );
}
