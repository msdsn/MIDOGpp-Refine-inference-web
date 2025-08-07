import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Header,
  SpaceBetween,
  Table,
  Box,
  Button,
  StatusIndicator,
  Badge,
  TextFilter,
  Pagination,
  CollectionPreferences,

  ButtonDropdown,
  Modal,
  Alert
} from '@cloudscape-design/components';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { AnalysisWithDetails, AnalysisHistory } from '../types/analysis';
import { convertAnalysisToHistory } from '../types/analysis';
import { authenticatedFetchJson } from '../lib/api';

const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<AnalysisHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<AnalysisHistory[]>([]);
  const [filterText, setFilterText] = useState('');
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortingColumn, setSortingColumn] = useState<{ sortingField: string; sortingDescending: boolean }>({
    sortingField: 'analysisDate',
    sortingDescending: true
  });
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<AnalysisHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalyses();
  }, [user]);

  const loadAnalyses = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Get analyses from Supabase
      const { data: analysesData, error: analysesError } = await supabase
        .from('analyses')
        .select(`
          *,
          user_images(*),
          analysis_detections(*)
        `)
        .eq('profile_id', user.id)
        .order('analysis_date', { ascending: false })
        .limit(100);

      if (analysesError) {
        throw analysesError;
      }

      // Convert to AnalysisHistory format
      const convertedAnalyses: AnalysisHistory[] = [];
      
      for (const analysis of analysesData || []) {
        try {
          // Get image URL if image exists
          let imageUrl: string | undefined = undefined;
          if (analysis.image_id) {
            try {
              const imageData = await authenticatedFetchJson<{ presigned_url: string }>(`/image/${analysis.image_id}`);
              imageUrl = imageData.presigned_url;
            } catch (err) {
              console.warn('Could not fetch image URL:', err);
            }
          }

          const analysisWithDetails: AnalysisWithDetails = {
            ...analysis,
            image_url: imageUrl
          };

          const historyItem = convertAnalysisToHistory(analysisWithDetails);
          convertedAnalyses.push(historyItem);
        } catch (conversionError) {
          console.error('Error converting analysis:', conversionError);
        }
      }

      setAnalyses(convertedAnalyses);
    } catch (err) {
      console.error('Error loading analyses:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analyses');
      
      // Fallback to localStorage if Supabase fails
      try {
        const saved = localStorage.getItem('analysisHistory');
        if (saved) {
          const parsed = JSON.parse(saved).map((analysis: any) => ({
            ...analysis,
            analysisDate: new Date(analysis.analysisDate)
          }));
          setAnalyses(parsed);
        }
      } catch (localError) {
        console.error('Error loading from localStorage:', localError);
      }
    } finally {
      setLoading(false);
    }
  };

  const deleteAnalysis = async (id: string) => {
    if (!user) return;
    
    try {
      // Delete from Supabase
      const { error } = await supabase
        .from('analyses')
        .delete()
        .eq('id', id)
        .eq('profile_id', user.id);

      if (error) {
        throw error;
      }

      // Update local state
      const updatedAnalyses = analyses.filter(analysis => analysis.id !== id);
      setAnalyses(updatedAnalyses);
      
      // Also update localStorage for backward compatibility
      localStorage.setItem('analysisHistory', JSON.stringify(updatedAnalyses));
      
      setDeleteModalVisible(false);
      setItemToDelete(null);
    } catch (err) {
      console.error('Error deleting analysis:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete analysis');
    }
  };

  const deleteSelectedAnalyses = async () => {
    if (!user || selectedItems.length === 0) return;
    
    try {
      const selectedIds = selectedItems.map(item => item.id);
      
      // Delete from Supabase
      const { error } = await supabase
        .from('analyses')
        .delete()
        .in('id', selectedIds)
        .eq('profile_id', user.id);

      if (error) {
        throw error;
      }

      // Update local state
      const updatedAnalyses = analyses.filter(analysis => !selectedIds.includes(analysis.id));
      setAnalyses(updatedAnalyses);
      
      // Also update localStorage for backward compatibility
      localStorage.setItem('analysisHistory', JSON.stringify(updatedAnalyses));
      
      setSelectedItems([]);
    } catch (err) {
      console.error('Error deleting selected analyses:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete analyses');
    }
  };

  // Filter and sort analyses
  const filteredAnalyses = analyses.filter(analysis => {
    if (!filterText) return true;
    const searchText = filterText.toLowerCase();
    return (
      analysis.imageName.toLowerCase().includes(searchText) ||
      analysis.status.toLowerCase().includes(searchText) ||
      analysis.result?.total_detections?.toString().includes(searchText)
    );
  });

  const sortedAnalyses = [...filteredAnalyses].sort((a, b) => {
    const { sortingField, sortingDescending } = sortingColumn;
    let aValue: any, bValue: any;

    switch (sortingField) {
      case 'imageName':
        aValue = a.imageName;
        bValue = b.imageName;
        break;
      case 'analysisDate':
        aValue = new Date(a.analysisDate).getTime();
        bValue = new Date(b.analysisDate).getTime();
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
        break;
      case 'total_detections':
        aValue = a.result?.total_detections || 0;
        bValue = b.result?.total_detections || 0;
        break;
      case 'processingTime':
        aValue = a.processingTime;
        bValue = b.processingTime;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortingDescending ? 1 : -1;
    if (aValue > bValue) return sortingDescending ? -1 : 1;
    return 0;
  });

  // Pagination
  const startIndex = (currentPageIndex - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentPageAnalyses = sortedAnalyses.slice(startIndex, endIndex);

  const columnDefinitions = [
    {
      id: 'imageName',
      header: 'Image Name',
      cell: (item: AnalysisHistory) => (
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <div className="font-medium text-gray-900">{item.imageName}</div>
            <div className="text-sm text-gray-500">
              {(item.imageSize / 1024 / 1024).toFixed(2)} MB
            </div>
          </div>
        </div>
      ),
      sortingField: 'imageName'
    },
    {
      id: 'analysisDate',
      header: 'Date',
      cell: (item: AnalysisHistory) => (
        <div>
          <div className="font-medium text-gray-900">
            {new Date(item.analysisDate).toLocaleDateString()}
          </div>
          <div className="text-sm text-gray-500">
            {new Date(item.analysisDate).toLocaleTimeString()}
          </div>
        </div>
      ),
      sortingField: 'analysisDate'
    },
    {
      id: 'status',
      header: 'Status',
      cell: (item: AnalysisHistory) => (
        <StatusIndicator
          type={item.status === 'completed' ? 'success' : 
                item.status === 'failed' ? 'error' : 'in-progress'}
        >
          {item.status}
        </StatusIndicator>
      ),
      sortingField: 'status'
    },
    {
      id: 'detections',
      header: 'Detections',
      cell: (item: AnalysisHistory) => (
        <div className="text-center">
          <div className="text-lg font-bold text-blue-600">
            {item.result?.total_detections || 0}
          </div>
          <div className="text-xs text-gray-500">mitotic figures</div>
        </div>
      ),
      sortingField: 'total_detections'
    },
    {
      id: 'processingTime',
      header: 'Processing Time',
      cell: (item: AnalysisHistory) => (
        <div className="text-center">
          <div className="font-medium text-gray-900">
            {item.processingTime.toFixed(1)}s
          </div>
        </div>
      ),
      sortingField: 'processingTime'
    },
    {
      id: 'type',
      header: 'Type',
      cell: (item: AnalysisHistory) => (
        <Badge color={item.isTestImage ? 'blue' : 'green'}>
          {item.isTestImage ? 'Test Image' : 'User Upload'}
        </Badge>
      )
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (item: AnalysisHistory) => (
        <div className="flex items-center space-x-2">
          <Button
            variant="link"
            onClick={() => navigate(`/analysis/${item.id}`)}
          >
            View
          </Button>
          <ButtonDropdown
            items={[
              {
                id: 'download',
                text: 'Download Report',
                iconName: 'download'
              },
              {
                id: 'delete',
                text: 'Delete',
                iconName: 'remove'
              }
            ]}
            onItemClick={(event) => {
              if (event.detail.id === 'delete') {
                setItemToDelete(item);
                setDeleteModalVisible(true);
              }
            }}
          />
        </div>
      )
    }
  ];

  const emptyState = (
    <Box textAlign="center" color="inherit">
      <div className="py-8">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <Box variant="h2" margin={{ bottom: 's' }}>
          No analyses found
        </Box>
        <Box variant="p" margin={{ bottom: 's' }}>
          {filterText ? 'No analyses match your search criteria.' : 'You haven\'t performed any analyses yet.'}
        </Box>
        <Button
          variant="primary"
          onClick={() => navigate('/analyze')}
        >
          Start New Analysis
        </Button>
      </div>
    </Box>
  );

  return (
    <Container>
      <SpaceBetween direction="vertical" size="l">
        <Header
          variant="h1"
          description="View and manage your analysis history"
          actions={
            <SpaceBetween direction="horizontal" size="s">
              <Button
                variant="normal"
                onClick={() => navigate('/analyze')}
                iconName="add-plus"
              >
                New Analysis
              </Button>
              {selectedItems.length > 0 && (
                <Button
                  variant="normal"
                  onClick={deleteSelectedAnalyses}
                  iconName="remove"
                >
                  Delete Selected ({selectedItems.length})
                </Button>
              )}
            </SpaceBetween>
          }
        >
          Analysis History
        </Header>

        {/* Error Alert */}
        {error && (
          <Alert 
            type="error" 
            dismissible 
            onDismiss={() => setError(null)}
            header="Error loading analyses"
          >
            {error}
          </Alert>
        )}

        <Table
          columnDefinitions={columnDefinitions}
          items={currentPageAnalyses}
          loading={loading}
          loadingText="Loading analyses..."
          selectedItems={selectedItems}
          onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
          selectionType="multi"
          ariaLabels={{
            selectionGroupLabel: 'Items selection',
            allItemsSelectionLabel: ({ selectedItems }) =>
              `${selectedItems.length} ${selectedItems.length === 1 ? 'item' : 'items'} selected`,
            itemSelectionLabel: ({ selectedItems }, item) =>
              `${item.imageName} is ${selectedItems.indexOf(item) < 0 ? 'not ' : ''}selected`
          }}
                     sortingColumn={sortingColumn}
           onSortingChange={({ detail }) => setSortingColumn({
             sortingField: detail.sortingColumn?.sortingField || 'analysisDate',
             sortingDescending: detail.isDescending || false
           })}
          header={
            <Header
              counter={`(${sortedAnalyses.length})`}
              actions={
                <SpaceBetween direction="horizontal" size="s">
                  <Button
                    variant="normal"
                    onClick={loadAnalyses}
                    iconName="refresh"
                  >
                    Refresh
                  </Button>
                </SpaceBetween>
              }
            >
              Analyses
            </Header>
          }
                     filter={
             <TextFilter
               filteringText={filterText}
               onChange={({ detail }) => setFilterText(detail.filteringText)}
               filteringPlaceholder="Search analyses..."
             />
           }
           pagination={
             <Pagination
               currentPageIndex={currentPageIndex}
               pagesCount={Math.ceil(sortedAnalyses.length / pageSize)}
               onChange={({ detail }) => setCurrentPageIndex(detail.currentPageIndex)}
             />
           }
          preferences={
            <CollectionPreferences
              title="Preferences"
              confirmLabel="Confirm"
              cancelLabel="Cancel"
              onConfirm={({ detail }) => {
                setPageSize(detail.pageSize || 10);
                setCurrentPageIndex(1);
              }}
              preferences={{
                pageSize: pageSize,
                visibleContent: ['imageName', 'analysisDate', 'status', 'detections', 'processingTime', 'type', 'actions']
              }}
              pageSizePreference={{
                title: 'Select page size',
                options: [
                  { value: 10, label: '10 items' },
                  { value: 25, label: '25 items' },
                  { value: 50, label: '50 items' }
                ]
              }}
            />
          }
          empty={emptyState}
        />

        {/* Delete Confirmation Modal */}
        <Modal
          visible={deleteModalVisible}
          onDismiss={() => setDeleteModalVisible(false)}
          header="Delete Analysis"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="s">
                <Button
                  variant="link"
                  onClick={() => setDeleteModalVisible(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => itemToDelete && deleteAnalysis(itemToDelete.id)}
                >
                  Delete
                </Button>
              </SpaceBetween>
            </Box>
          }
        >
          <Alert type="warning" header="This action cannot be undone">
            Are you sure you want to delete the analysis for "{itemToDelete?.imageName}"? 
            This will permanently remove the analysis results and cannot be recovered.
          </Alert>
        </Modal>
      </SpaceBetween>
    </Container>
  );
};

export default HistoryPage; 