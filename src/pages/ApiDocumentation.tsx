import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, ArrowLeft, Code, Book, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import { Link } from 'react-router-dom';
import { Label } from '@/components/ui/label';

const ApiDocumentation: React.FC = () => {
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Code copied to clipboard",
    });
  };

  const apiEndpoint = `${window.location.origin}/api/notifications`;

  const examplePayloads = {
    siteDown: `{
  "type": "site_down",
  "title": "Site Down Alert",
  "message": "example.com is not responding",
  "site": "example.com",
  "priority": "high",
  "timestamp": "${new Date().toISOString()}"
}`,
    serverAlert: `{
  "type": "server_alert",
  "title": "Server Load High",
  "message": "CPU usage above 90%",
  "server": "web-server-01",
  "priority": "medium",
  "metrics": {
    "cpu": 92,
    "memory": 78
  },
  "timestamp": "${new Date().toISOString()}"
}`,
    custom: `{
  "type": "custom",
  "title": "Custom Alert",
  "message": "Your custom notification message",
  "priority": "low",
  "data": {
    "custom_field": "custom_value"
  },
  "timestamp": "${new Date().toISOString()}"
}`
  };

  const curlExamples = {
    siteDown: `curl -X POST ${apiEndpoint} \\
  -H "Content-Type: application/json" \\
  -d '${examplePayloads.siteDown.replace(/\n/g, '\\n').replace(/"/g, '\\"')}'`,
    postman: `// Postman Collection
{
  "info": {
    "name": "MCM Alerts API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Send Notification",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "${examplePayloads.siteDown.replace(/\n/g, '\\n').replace(/"/g, '\\"')}"
        },
        "url": {
          "raw": "${apiEndpoint}"
        }
      }
    }
  ]
}`
  };

  return (
    <div className="min-h-screen bg-background">
      <Header showSignIn={false} />
      
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center space-x-4 mb-8">
          <Link to="/">
            <Button variant="ghost" size="sm" className="flex items-center space-x-2">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">API Documentation</h1>
            <p className="text-muted-foreground">Integration guide for MCM Alerts API</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Book className="h-5 w-5" />
                  <span>Overview</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  The MCM Alerts API allows you to send real-time notifications to subscribed users. 
                  Use this API to integrate with your monitoring systems, applications, or services.
                </p>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">REST API</Badge>
                  <Badge variant="outline">JSON</Badge>
                  <Badge variant="outline">No Auth Required</Badge>
                </div>
              </CardContent>
            </Card>

            {/* API Endpoint */}
            <Card>
              <CardHeader>
                <CardTitle>API Endpoint</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-4 rounded-lg mb-4">
                  <div className="flex items-center justify-between">
                    <code className="text-sm font-mono">POST {apiEndpoint}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(apiEndpoint)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  <strong>Method:</strong> POST | <strong>Auth:</strong> None Required | <strong>Content-Type:</strong> application/json
                </p>
              </CardContent>
            </Card>

            {/* Request Examples */}
            <Card>
              <CardHeader>
                <CardTitle>Request Examples</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="site-down" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="site-down">Site Down</TabsTrigger>
                    <TabsTrigger value="server-alert">Server Alert</TabsTrigger>
                    <TabsTrigger value="custom">Custom</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="site-down" className="space-y-4">
                    <div className="space-y-2">
                      <Label>JSON Payload</Label>
                      <div className="relative">
                        <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                          <code>{examplePayloads.siteDown}</code>
                        </pre>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(examplePayloads.siteDown)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="server-alert" className="space-y-4">
                    <div className="space-y-2">
                      <Label>JSON Payload</Label>
                      <div className="relative">
                        <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                          <code>{examplePayloads.serverAlert}</code>
                        </pre>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(examplePayloads.serverAlert)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="custom" className="space-y-4">
                    <div className="space-y-2">
                      <Label>JSON Payload</Label>
                      <div className="relative">
                        <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                          <code>{examplePayloads.custom}</code>
                        </pre>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(examplePayloads.custom)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Code Examples */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Code className="h-5 w-5" />
                  <span>Integration Examples</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="curl" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="curl">cURL</TabsTrigger>
                    <TabsTrigger value="postman">Postman</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="curl" className="space-y-4">
                    <div className="relative">
                      <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                        <code>{curlExamples.siteDown}</code>
                      </pre>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(curlExamples.siteDown)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="postman" className="space-y-4">
                    <div className="relative">
                      <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                        <code>{curlExamples.postman}</code>
                      </pre>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(curlExamples.postman)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Reference */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Zap className="h-5 w-5" />
                  <span>Quick Reference</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Priority Levels</h4>
                  <div className="space-y-1">
                    <Badge variant="outline">low</Badge>
                    <Badge variant="secondary">medium</Badge>
                    <Badge variant="destructive">high</Badge>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Required Fields</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• type</li>
                    <li>• title</li>
                    <li>• message</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Response Codes</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• 200: Success</li>
                    <li>• 400: Bad Request</li>
                    <li>• 500: Server Error</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Test API */}
            <Card>
              <CardHeader>
                <CardTitle>Test API</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Use the dashboard to test notifications with different priority levels.
                </p>
                <Link to="/">
                  <Button className="w-full">
                    Go to Dashboard
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiDocumentation;
