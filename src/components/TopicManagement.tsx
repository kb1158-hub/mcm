import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Monitor } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Topic {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  lastChecked: string;
}

const TopicManagement: React.FC = () => {
  const { toast } = useToast();
  const [topics, setTopics] = useState<Topic[]>([
    {
      id: '1',
      name: 'Site Up/Down Monitoring',
      description: 'Receive instant notifications when your monitored sites go up or down',
      enabled: true,
      lastChecked: '2 minutes ago'
    }
  ]);

  const [newTopic, setNewTopic] = useState({ name: '', description: '' });
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleCreateTopic = () => {
    if (!newTopic.name.trim()) {
      toast({
        title: "Error",
        description: "Topic name is required",
        variant: "destructive",
      });
      return;
    }

    const topic: Topic = {
      id: Date.now().toString(),
      name: newTopic.name,
      description: newTopic.description,
      enabled: true,
      lastChecked: 'Just now'
    };

    setTopics([...topics, topic]);
    setNewTopic({ name: '', description: '' });
    setIsDialogOpen(false);
    
    toast({
      title: "Topic Created",
      description: `"${topic.name}" has been created successfully`,
    });
  };

  const toggleTopic = (id: string) => {
    setTopics(topics.map(topic => 
      topic.id === id ? { ...topic, enabled: !topic.enabled } : topic
    ));
  };

  const deleteTopic = (id: string) => {
    const topic = topics.find(t => t.id === id);
    setTopics(topics.filter(topic => topic.id !== id));
    
    toast({
      title: "Topic Deleted",
      description: `"${topic?.name}" has been deleted`,
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>Notification Subscriptions</CardTitle>
          <Badge variant="outline" className="mt-2">Active</Badge>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Create Topic</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Topic</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="topic-name">Topic Name</Label>
                <Input
                  id="topic-name"
                  placeholder="Enter topic name"
                  value={newTopic.name}
                  onChange={(e) => setNewTopic({ ...newTopic, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="topic-description">Description</Label>
                <Textarea
                  id="topic-description"
                  placeholder="Enter topic description"
                  value={newTopic.description}
                  onChange={(e) => setNewTopic({ ...newTopic, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTopic}>
                  Create Topic
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        {topics.map((topic) => (
          <div key={topic.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div className="flex items-center space-x-4">
              <Monitor className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">{topic.name}</p>
                <p className="text-sm text-muted-foreground">{topic.description}</p>
                <p className="text-xs text-muted-foreground mt-1">Last checked: {topic.lastChecked}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={topic.enabled}
                onCheckedChange={() => toggleTopic(topic.id)}
              />
              {topic.id !== '1' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteTopic(topic.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default TopicManagement;