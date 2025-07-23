import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { getUserSubscribedTopics, updateUserSubscribedTopics } from '@/services/topicService';

const availableTopics = [
  { id: 'alerts', label: 'Alerts' },
  { id: 'warnings', label: 'Warnings' },
  { id: 'custom', label: 'Custom Events' },
  { id: 'site-monitoring', label: 'Site Up/Down Monitoring' }, // ✅ Added
];

const TopicManagement: React.FC = () => {
  const [subscribedTopics, setSubscribedTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchSubscriptions = async () => {
      const topics = await getUserSubscribedTopics();
      setSubscribedTopics(topics || []);
      setLoading(false);
    };

    fetchSubscriptions();
  }, []);

  const handleToggle = async (topicId: string) => {
    let updatedTopics;
    if (subscribedTopics.includes(topicId)) {
      updatedTopics = subscribedTopics.filter((t) => t !== topicId);
    } else {
      updatedTopics = [...subscribedTopics, topicId];
    }

    setSubscribedTopics(updatedTopics);
    await updateUserSubscribedTopics(updatedTopics); // Persist changes
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>🧩 Notification Subscriptions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-muted-foreground">Loading topics...</p>
        ) : (
          availableTopics.map((topic) => (
            <div key={topic.id} className="flex items-center space-x-2">
              <Checkbox
                id={topic.id}
                checked={subscribedTopics.includes(topic.id)}
                onCheckedChange={() => handleToggle(topic.id)}
              />
              <label htmlFor={topic.id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed">
                {topic.label}
              </label>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default TopicManagement;
