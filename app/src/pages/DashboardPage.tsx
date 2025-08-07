import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Container,
  Header,
  SpaceBetween,
  Box,

  Button,

  ColumnLayout,
  StatusIndicator,
  Link
} from '@cloudscape-design/components';
import type { AnalysisHistory } from '../types/analysis';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisHistory[]>([]);
  const [, setLoading] = useState(true);

  useEffect(() => {
    // Load analysis history from localStorage
    const loadAnalysisHistory = () => {
      try {
        const saved = localStorage.getItem('analysisHistory');
        if (saved) {
          const parsed = JSON.parse(saved);
          setAnalysisHistory(parsed);
        }
      } catch (error) {
        console.error('Error loading analysis history:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAnalysisHistory();
  }, []);

  const totalAnalyses = analysisHistory.length;
  const completedAnalyses = analysisHistory.filter(a => a.status === 'completed').length;
  const totalDetections = analysisHistory.reduce((sum, a) => sum + (a.result?.total_detections || 0), 0);
  const avgProcessingTime = analysisHistory.length > 0 
    ? analysisHistory.reduce((sum, a) => sum + a.processingTime, 0) / analysisHistory.length 
    : 0;

  const recentAnalyses = analysisHistory
    .sort((a, b) => new Date(b.analysisDate).getTime() - new Date(a.analysisDate).getTime())
    .slice(0, 3);

  const statCards = [
    {
      title: 'Total Analyses',
      value: totalAnalyses.toString(),
      description: 'Images processed',
      icon: 'file',
      color: 'blue'
    },
    {
      title: 'Mitotic Figures',
      value: totalDetections.toString(),
      description: 'Total detections',
      icon: 'search',
      color: 'green'
    },
    {
      title: 'Avg Processing Time',
      value: `${avgProcessingTime.toFixed(1)}s`,
      description: 'Per analysis',
      icon: 'clock',
      color: 'purple'
    },
    {
      title: 'Success Rate',
      value: `${totalAnalyses > 0 ? Math.round((completedAnalyses / totalAnalyses) * 100) : 0}%`,
      description: 'Completed analyses',
      icon: 'check',
      color: 'green'
    }
  ];

  const quickActions = [
    {
      title: 'New Analysis',
      description: 'Upload and analyze a new H&E slide image',
      action: () => navigate('/analyze'),
      icon: 'add-plus',
      variant: 'primary' as const
    },
    {
      title: 'View History',
      description: 'Browse your previous analyses',
      action: () => navigate('/history'),
      icon: 'file',
      variant: 'normal' as const
    },
    {
      title: 'Sample Images',
      description: 'Try with demo images',
      action: () => navigate('/analyze'),
      icon: 'folder',
      variant: 'normal' as const
    }
  ];

  return (
    <Container>
      <SpaceBetween direction="vertical" size="l">
        {/* Welcome Header */}
        <Header
          variant="h1"
          description={`Welcome back, ${user?.name || 'User'}! Here's your analysis overview.`}
          actions={
            <Button
              variant="primary"
              iconName="add-plus"
              onClick={() => navigate('/analyze')}
            >
              New Analysis
            </Button>
          }
        >
          Dashboard
        </Header>

        {/* Statistics Cards */}
        <Box variant="h2" margin={{ bottom: 'm' }}>
          Overview
        </Box>
        <ColumnLayout columns={4} variant="text-grid">
          {statCards.map((card, index) => (
            <div key={index} className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div className={`w-10 h-10 rounded-lg bg-${card.color}-100 flex items-center justify-center`}>
                  <svg className={`w-5 h-5 text-${card.color}-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {card.icon === 'file' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />}
                    {card.icon === 'search' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />}
                    {card.icon === 'clock' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />}
                    {card.icon === 'check' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />}
                  </svg>
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">{card.value}</div>
              <div className="text-sm text-gray-600">{card.title}</div>
              <div className="text-xs text-gray-500 mt-1">{card.description}</div>
            </div>
          ))}
        </ColumnLayout>

        {/* Quick Actions */}
        <Box variant="h2" margin={{ bottom: 'm', top: 'l' }}>
          Quick Actions
        </Box>
        <ColumnLayout columns={3}>
          {quickActions.map((action, index) => (
            <div key={index} className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {action.icon === 'add-plus' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />}
                    {action.icon === 'file' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />}
                    {action.icon === 'folder' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />}
                  </svg>
                </div>
                <div className="font-semibold text-gray-900">{action.title}</div>
              </div>
              <div className="text-sm text-gray-600 mb-4">{action.description}</div>
              <Button
                variant={action.variant}
                onClick={action.action}
                fullWidth
              >
                {action.title}
              </Button>
            </div>
          ))}
        </ColumnLayout>

        {/* Recent Activity */}
        <Box variant="h2" margin={{ bottom: 'm', top: 'l' }}>
          Recent Activity
        </Box>
        {recentAnalyses.length > 0 ? (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="font-medium text-gray-900">Recent Analyses</div>
                <Link href="/history" external={false}>
                  View all
                </Link>
              </div>
            </div>
            <div className="divide-y divide-gray-200">
              {recentAnalyses.map((analysis) => (
                <div key={analysis.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {analysis.imageName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(analysis.analysisDate).toLocaleDateString()} • 
                          {analysis.result?.total_detections || 0} detections
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <StatusIndicator
                        type={analysis.status === 'completed' ? 'success' : 
                              analysis.status === 'failed' ? 'error' : 'in-progress'}
                      >
                        {analysis.status}
                      </StatusIndicator>
                      <Button
                        variant="link"
                        onClick={() => navigate(`/history/${analysis.id}`)}
                      >
                        View
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="text-lg font-medium text-gray-900 mb-2">
              No analyses yet
            </div>
            <div className="text-gray-600 mb-4">
              Start by uploading your first H&E slide image for analysis
            </div>
            <Button
              variant="primary"
              onClick={() => navigate('/analyze')}
            >
              Upload Image
            </Button>
          </div>
        )}
      </SpaceBetween>
    </Container>
  );
};

export default DashboardPage; 