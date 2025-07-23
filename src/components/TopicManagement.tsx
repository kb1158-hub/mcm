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
import { supabase } from '@/services/notificationService';

interface Topic {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  lastChecked: Date;
  createdAt: Date;
}

const TopicManagement: React.FC = () => {
  const { toast } = useToast();
  const [topics, setTopics] = useState<Topic[]>([
    {
      id: '1',
      name: 'Site Up/Down Monitoring',
      description: 'Receive instant notifications when your monitored sites go up or down',
      enabled: true,
      lastChecked: new Date(),
      createdAt: new Date()
    }
  ]);

  const [newTopic, setNewTopic] = useState({ name: '', description: '' });
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Load topics from database on component mount
  React.useEffect(() => {
    loadTopics();
  }, []);

  const loadTopics = async () => {
    try {
      // First check if topics table exists, if not use default topics
      const { data, error } = await supabase
        .from('topics')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Failed to load topics:', error);
        // Keep default topics if database table doesn't exist
        return;
      }
      
      if (data && data.length > 0) {
        const formattedTopics = data.map(topic => ({
          id: topic.id,
          name: topic.name,
          description: topic.description,
          enabled: topic.enabled,
          lastChecked: new Date(topic.last_checked),
          createdAt: new Date(topic.created_at)
        }));
        setTopics(formattedTopics);
      }
    } catch (error) {
      console.error('Failed to load topics:', error);
      // Keep default topics on error
    }
  };
  const handleCreateTopic = async () => {
    if (!newTopic.name.trim()) {
      toast({
        title: "Error",
        description: "Topic name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('topics')
        .insert([{
          name: newTopic.name,
          description: newTopic.description,
          enabled: true,
          last_checked: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      const topic: Topic = {
        id: data.id,
        name: data.name,
        description: data.description,
        enabled: data.enabled,
        lastChecked: new Date(data.last_checked),
        createdAt: new Date(data.created_at)
      };

      setTopics([topic, ...topics]);
      
      toast({
        title: "Topic Created",
        description: `"${topic.name}" has been created successfully`,
      });
    } catch (error) {
      console.error('Failed to create topic:', error);
      toast({
        title: "Error",
        description: "Failed to create topic. Please try again.",
        variant: "destructive",
      });
    }
    setNewTopic({ name: '', description: '' });
    setIsDialogOpen(false);
  };

  const toggleTopic = async (id: string) => {
    const topic = topics.find(t => t.id === id);
    if (!topic) return;

    try {
      const { error } = await supabase
        .from('topics')
        .update({ 
          enabled: !topic.enabled,
          last_checked: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      setTopics(topics.map(t => 
        t.id === id ? { ...t, enabled: !t.enabled, lastChecked: new Date() } : t
      ));
    } catch (error) {
      console.error('Failed to toggle topic:', error);
      toast({
        title: "Error",
        description: "Failed to update topic. Please try again.",
        variant: "destructive",
      });
    }
  };

  const deleteTopic = async (id: string) => {
    const topic = topics.find(t => t.id === id);
    if (!topic) return;

    try {
      const { error } = await supabase
        .from('topics')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTopics(topics.filter(t => t.id !== id));
      
      toast({
        title: "Topic Deleted",
        description: `"${topic.name}" has been deleted`,
      });
    } catch (error) {
      console.error('Failed to delete topic:', error);
      toast({
        title: "Error",
        description: "Failed to delete topic. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatLastChecked = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>Notification Subscriptions</CardTitle>
          <Badge variant="outline" className="mt-2">{topics.filter(t => t.enabled).length} Active</Badge>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Add Topic</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Topic</DialogTitle>
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
                  Add Topic
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
                <p className="text-xs text-muted-foreground mt-1">Last checked: {formatLastChecked(topic.lastChecked)}</p>
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