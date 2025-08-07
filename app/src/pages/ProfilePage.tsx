import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Container,
  Header,
  SpaceBetween,

  Button,
  FormField,
  Input,
  ColumnLayout,

  StatusIndicator,
  Badge,
  Alert
} from '@cloudscape-design/components';

const ProfilePage: React.FC = () => {
  const { user, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || ''
  });

  const analysisHistory = JSON.parse(localStorage.getItem('analysisHistory') || '[]');
  const userAnalyses = analysisHistory.filter((analysis: any) => analysis.userId === user?.id);
  const totalDetections = userAnalyses.reduce((sum: number, analysis: any) => sum + (analysis.result?.total_detections || 0), 0);
  const avgProcessingTime = userAnalyses.length > 0 
    ? userAnalyses.reduce((sum: number, analysis: any) => sum + analysis.processingTime, 0) / userAnalyses.length 
    : 0;

  const handleSave = () => {
    // In a real app, this would update the user in the backend
    setIsEditing(false);
    // For demo purposes, we'll just update localStorage
    if (user) {
      const updatedUser = { ...user, ...formData };
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  const handleCancel = () => {
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
      role: user?.role || ''
    });
    setIsEditing(false);
  };

  const statsCards = [
    {
      title: 'Total Analyses',
      value: userAnalyses.length.toString(),
      description: 'Images processed',
      icon: 'file'
    },
    {
      title: 'Total Detections',
      value: totalDetections.toString(),
      description: 'Mitotic figures found',
      icon: 'search'
    },
    {
      title: 'Avg Processing Time',
      value: `${avgProcessingTime.toFixed(1)}s`,
      description: 'Per analysis',
      icon: 'clock'
    },
    {
      title: 'Account Age',
      value: user?.lastLogin ? Math.ceil((Date.now() - new Date(user.lastLogin).getTime()) / (1000 * 60 * 60 * 24)).toString() : '0',
      description: 'Days since registration',
      icon: 'calendar'
    }
  ];

  if (!user) {
    return (
      <Container>
        <Alert type="error">
          User not found. Please log in again.
        </Alert>
      </Container>
    );
  }

  return (
    <Container>
      <SpaceBetween direction="vertical" size="l">
        <Header
          variant="h1"
          description="Manage your account settings and view usage statistics"
          actions={
            <SpaceBetween direction="horizontal" size="s">
              <Button
                variant="normal"
                onClick={logout}
                iconName="external"
              >
                Sign Out
              </Button>
            </SpaceBetween>
          }
        >
          User Profile
        </Header>

        <ColumnLayout columns={2}>
          {/* Profile Information */}
          <Container header={
            <Header
              variant="h2"
              actions={
                isEditing ? (
                  <SpaceBetween direction="horizontal" size="s">
                    <Button
                      variant="link"
                      onClick={handleCancel}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleSave}
                    >
                      Save Changes
                    </Button>
                  </SpaceBetween>
                ) : (
                  <Button
                    variant="normal"
                    onClick={() => setIsEditing(true)}
                    iconName="edit"
                  >
                    Edit Profile
                  </Button>
                )
              }
            >
              Account Information
            </Header>
          }>
            <SpaceBetween direction="vertical" size="m">
              <FormField label="Full Name">
                {isEditing ? (
                  <Input
                    value={formData.name}
                    onChange={({ detail }) => setFormData(prev => ({ ...prev, name: detail.value }))}
                    placeholder="Enter your full name"
                  />
                ) : (
                  <div className="p-2 bg-gray-50 rounded border">
                    {user.name}
                  </div>
                )}
              </FormField>

              <FormField label="Email Address">
                {isEditing ? (
                  <Input
                    value={formData.email}
                    onChange={({ detail }) => setFormData(prev => ({ ...prev, email: detail.value }))}
                    placeholder="Enter your email"
                    type="email"
                  />
                ) : (
                  <div className="p-2 bg-gray-50 rounded border">
                    {user.email}
                  </div>
                )}
              </FormField>

              <FormField label="Role">
                <div className="p-2 bg-gray-50 rounded border">
                  <Badge color="blue">{user.role}</Badge>
                </div>
              </FormField>

              <FormField label="Account Status">
                <StatusIndicator type="success">
                  Active
                </StatusIndicator>
              </FormField>

              <FormField label="Last Login">
                <div className="p-2 bg-gray-50 rounded border">
                  {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Unknown'}
                </div>
              </FormField>
            </SpaceBetween>
          </Container>

          {/* Usage Statistics */}
          <Container header={
            <Header variant="h2">
              Usage Statistics
            </Header>
          }>
            <SpaceBetween direction="vertical" size="m">
              {statsCards.map((card, index) => (
                <div key={index} className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {card.icon === 'file' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />}
                        {card.icon === 'search' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />}
                        {card.icon === 'clock' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />}
                        {card.icon === 'calendar' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />}
                      </svg>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 mb-1">{card.value}</div>
                  <div className="text-sm text-gray-600">{card.title}</div>
                  <div className="text-xs text-gray-500 mt-1">{card.description}</div>
                </div>
              ))}

              {userAnalyses.length === 0 && (
                <Alert type="info">
                  You haven't performed any analyses yet. Start with your first image analysis to see statistics here.
                </Alert>
              )}
            </SpaceBetween>
          </Container>
        </ColumnLayout>

        {/* Account Actions */}
        <Container header={
          <Header variant="h2">
            Account Actions
          </Header>
        }>
          <SpaceBetween direction="horizontal" size="m">
            <Button
              variant="normal"
              iconName="download"
            >
              Export Data
            </Button>
            <Button
              variant="normal"
              iconName="refresh"
              onClick={() => {
                localStorage.removeItem('analysisHistory');
                window.location.reload();
              }}
            >
              Clear Analysis History
            </Button>
            <Button
              variant="normal"
              iconName="external"
              onClick={logout}
            >
              Sign Out
            </Button>
          </SpaceBetween>
        </Container>
      </SpaceBetween>
    </Container>
  );
};

export default ProfilePage; 