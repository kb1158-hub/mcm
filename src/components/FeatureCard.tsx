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
    <Card
      className="
        h-full border border-border bg-card
        transition-shadow duration-300
        hover:shadow-lg hover:-translate-y-1 hover:scale-[1.03]
        focus:outline-none focus:ring-2 focus:ring-accent
        flex flex-col
      "
      role="region"
      aria-labelledby={`feature-title-${title}`}
      tabIndex={0}
    >
      <CardHeader className="text-center pb-6 pt-6">
        <div
          className="
            mx-auto mb-5 p-5 rounded-full
            bg-accent/15 hover:bg-accent/30
            w-20 h-20 flex items-center justify-center
            transition-colors duration-300
          "
          aria-hidden="true"
        >
          <Icon className="h-10 w-10 text-accent" />
        </div>
        <CardTitle
          id={`feature-title-${title}`}
          className="text-2xl font-semibold text-card-foreground leading-snug"
        >
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-muted-foreground text-center leading-relaxed text-base sm:text-lg px-2 sm:px-6">
          {description}
        </p>
      </CardContent>
    </Card>
  );
};

export default FeatureCard;
