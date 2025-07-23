import React from 'react'; 
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import FeatureCard from '@/components/FeatureCard';
import { Monitor, Bell, Zap, Shield } from 'lucide-react';

interface LandingProps {
  onSignInClick: () => void;
}

const Landing: React.FC<LandingProps> = ({ onSignInClick }) => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header onSignInClick={onSignInClick} />

      {/* Hero Section */}
      <section className="relative flex-grow flex items-center py-16 px-4 sm:py-20 sm:px-6 lg:px-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 -z-10" />
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-foreground mb-6 leading-tight">
            Stay Informed with Real-Time{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
              Alerts
            </span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
            MCM Alerts is your reliable notification system for monitoring website uptime, service status, and critical system events. Get instant alerts when it matters most.
          </p>
          <Button
            size="lg"
            onClick={onSignInClick}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 text-lg font-semibold transition-transform active:scale-95"
          >
            Get Started
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 sm:py-20 sm:px-6 lg:px-12 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={Monitor}
              title="Site Monitoring"
              description="Monitor your websites and get instant notifications when they go up or down."
            />
            <FeatureCard
              icon={Bell}
              title="Real-time Alerts"
              description="Receive push notifications with sound alerts for immediate awareness."
            />
            <FeatureCard
              icon={Zap}
              title="API Integration"
              description="Easy integration with external tools like Postman for custom triggers."
            />
            <FeatureCard
              icon={Shield}
              title="Secure & Reliable"
              description="Built with security in mind using modern authentication and encryption."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:py-20 sm:px-6 lg:px-12">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground mb-8">
            Join MCM Alerts today and never miss an important notification again.
          </p>
          <Button
            size="lg"
            onClick={onSignInClick}
            className="bg-accent hover:bg-accent/90 text-accent-foreground px-8 py-4 text-lg font-semibold transition-transform active:scale-95"
          >
            Sign In Now
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Landing;
