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
    <div className="min-h-screen bg-background">
      <Header onSignInClick={onSignInClick} />
      
      {/* Hero Section */}
      <section className="relative py-20 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5"></div>
        <div className="container mx-auto text-center relative z-10">
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
            Stay Informed with Real-Time
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent"> Alerts</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
            MCM Alerts is your reliable notification system for monitoring website uptime, service status, and critical system events. Get instant alerts when it matters most.
          </p>
          <div className="space-y-4 sm:space-y-0 sm:space-x-4 sm:flex sm:justify-center">
            <Button 
              size="lg" 
              onClick={onSignInClick}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 text-lg font-semibold"
            >
              Get Started
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
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
      <section className="py-20 px-6">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join MCM Alerts today and never miss an important notification again.
          </p>
          <Button 
            size="lg" 
            onClick={onSignInClick}
            className="bg-accent hover:bg-accent/90 text-accent-foreground px-8 py-4 text-lg font-semibold"
          >
            Sign In Now
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Landing;