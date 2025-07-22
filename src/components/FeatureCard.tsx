import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon: Icon, title, description }) => {
  return (
    <Card className="h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border border-border bg-card">
      <CardHeader className="text-center pb-4">
        <div className="mx-auto mb-4 p-4 rounded-full bg-accent/10 w-16 h-16 flex items-center justify-center">
          <Icon className="h-8 w-8 text-accent" />
        </div>
        <CardTitle className="text-xl font-semibold text-card-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-center leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
};

export default FeatureCard;