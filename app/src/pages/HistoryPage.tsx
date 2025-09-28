import React, { useState, useMemo } from 'react';
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
  CollectionPreferences
} from '@cloudscape-design/components';
import { useAuth } from '../contexts/AuthContext';
import { useAnalyses } from '../contexts/AnalysesContext';
import { useDetections } from '../contexts/DetectionsContext';
import { useImages } from '../contexts/ImagesContext';

const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { } = useAuth();
  const { analyses, loading } = useAnalyses();
  const { detectionsByAnalysis } = useDetections();
  const { images } = useImages();
  
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [filterText, setFilterText] = useState('');
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortingColumn, setSortingColumn] = useState<{ sortingField: string; sortingDescending: boolean }>({
    sortingField: 'created_at',
    sortingDescending: true
  });

  // Process analyses data from context
  const processedAnalyses = useMemo(() => {
    return analyses.map(analysis => {
      const analysisDetections = detectionsByAnalysis[analysis.id] || [];
      const analysisImage = images.find(img => img.id === analysis.image_id);
      
      return {
        ...analysis,
        total_detections: analysisDetections.length,
        image: analysisImage,
        analysisDate: new Date(analysis.created_at),
        imageName: `Analysis_${analysis.id}`,
        imageSize: analysisImage?.file_size || 0,
        isTestImage: analysisImage?.is_test_image || false
      };
    });
  }, [analyses, detectionsByAnalysis, images]);

  // Filter and sort data
  const filteredAnalyses = useMemo(() => {
    let filtered = processedAnalyses;
    
    if (filterText) {
      filtered = filtered.filter(analysis => 
        analysis.imageName.toLowerCase().includes(filterText.toLowerCase()) ||
        analysis.status.toLowerCase().includes(filterText.toLowerCase())
      );
    }
    
    // Sort
    filtered.sort((a, b) => {
      const aValue = a[sortingColumn.sortingField as keyof typeof a];
      const bValue = b[sortingColumn.sortingField as keyof typeof b];
      
      if (!aValue && !bValue) return 0;
      if (!aValue) return sortingColumn.sortingDescending ? 1 : -1;
      if (!bValue) return sortingColumn.sortingDescending ? -1 : 1;
      
      if (aValue < bValue) return sortingColumn.sortingDescending ? 1 : -1;
      if (aValue > bValue) return sortingColumn.sortingDescending ? -1 : 1;
      return 0;
    });
    
    return filtered;
  }, [processedAnalyses, filterText, sortingColumn]);

  // Pagination
  const paginatedAnalyses = useMemo(() => {
    const startIndex = (currentPageIndex - 1) * pageSize;
    return filteredAnalyses.slice(startIndex, startIndex + pageSize);
  }, [filteredAnalyses, currentPageIndex, pageSize]);

  const columnDefinitions = [
    {
      id: 'imageName',
      header: 'Image Name',
      cell: (item: any) => item.imageName,
      sortingField: 'imageName'
    },
    {
      id: 'status',
      header: 'Status',
      cell: (item: any) => (
        <StatusIndicator type={
          item.status === 'completed' ? 'success' : 
          item.status === 'failed' ? 'error' : 
          'in-progress'
        }>
          {item.status}
        </StatusIndicator>
      ),
      sortingField: 'status'
    },
    {
      id: 'total_detections',
      header: 'Detections',
      cell: (item: any) => (
        <Badge color="blue">{item.total_detections}</Badge>
      ),
      sortingField: 'total_detections'
    },
    {
      id: 'created_at',
      header: 'Analysis Date',
      cell: (item: any) => item.analysisDate.toLocaleDateString(),
      sortingField: 'created_at'
    },
    {
      id: 'imageSize',
      header: 'Image Size',
      cell: (item: any) => `${Math.round(item.imageSize / 1024)} KB`,
      sortingField: 'imageSize'
    },
    {
      id: 'isTestImage',
      header: 'Type',
      cell: (item: any) => (
        <Badge color={item.isTestImage ? 'green' : 'blue'}>
          {item.isTestImage ? 'Test Image' : 'Uploaded'}
        </Badge>
      ),
      sortingField: 'isTestImage'
    }
  ];

  return (
    <Container>
      <SpaceBetween direction="vertical" size="l">
        <Header
          variant="h1"
          description="View your previous image analysis results"
          actions={
            <Button
              variant="primary"
              onClick={() => navigate('/analyze')}
              iconName="add-plus"
            >
              New Analysis
            </Button>
          }
        >
          Analysis History
        </Header>

        <Table
          columnDefinitions={columnDefinitions}
          items={paginatedAnalyses}
          loading={loading}
          loadingText="Loading analyses..."
          selectedItems={selectedItems}
          onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
          selectionType="multi"
          ariaLabels={{
            selectionGroupLabel: "Items selection",
            allItemsSelectionLabel: ({ selectedItems }) =>
              `${selectedItems.length} ${selectedItems.length === 1 ? "item" : "items"} selected`,
            itemSelectionLabel: ({ selectedItems }, item) => {
              const isItemSelected = selectedItems.filter(i => i.id === item.id).length;
              return `${item.imageName} is ${isItemSelected ? "" : "not"} selected`;
            }
          }}
          sortingColumn={sortingColumn}
          onSortingChange={({ detail }) => setSortingColumn({
            sortingField: detail.sortingColumn?.sortingField || 'created_at',
            sortingDescending: detail.isDescending || false
          })}
          header={
            <Header
              counter={`(${filteredAnalyses.length})`}
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    disabled={selectedItems.length === 0}
                    onClick={() => {
                      // Handle bulk actions
                      console.log('Bulk action for:', selectedItems);
                    }}
                  >
                    Actions
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
              pagesCount={Math.ceil(filteredAnalyses.length / pageSize)}
              onChange={({ detail }) => setCurrentPageIndex(detail.currentPageIndex)}
            />
          }
          preferences={
            <CollectionPreferences
              title="Preferences"
              confirmLabel="Confirm"
              cancelLabel="Cancel"
              preferences={{
                pageSize: pageSize,
                visibleContent: ['imageName', 'status', 'total_detections', 'created_at', 'imageSize', 'isTestImage']
              }}
              pageSizePreference={{
                title: "Page size",
                options: [
                  { value: 10, label: "10 analyses" },
                  { value: 20, label: "20 analyses" },
                  { value: 50, label: "50 analyses" }
                ]
              }}
              onConfirm={({ detail }) => {
                setPageSize(detail.pageSize!);
              }}
            />
          }
          empty={
            <Box textAlign="center" color="inherit">
              <Box variant="strong" textAlign="center" color="inherit">
                No analyses found
              </Box>
              <Box variant="p" padding={{ bottom: "s" }} color="inherit">
                You haven't performed any image analyses yet.
              </Box>
              <Button
                variant="primary"
                onClick={() => navigate('/analyze')}
              >
                Start your first analysis
              </Button>
            </Box>
          }
        />
      </SpaceBetween>
    </Container>
  );
};

export default HistoryPage;