import type { Database } from './database.types';

// Database tiplerine alias'lar
export type AnalysisRow = Database['public']['Tables']['analyses']['Row'];
export type AnalysisInsert = Database['public']['Tables']['analyses']['Insert'];
export type AnalysisUpdate = Database['public']['Tables']['analyses']['Update'];
export type ImageRow = Database['public']['Tables']['user_images']['Row'];
export type DetectionRow = Database['public']['Tables']['analysis_detections']['Row'];
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type UserDetailRow = Database['public']['Tables']['user_details']['Row'];

// Frontend-specific interfaces
export interface Prediction {
  bbox: [number, number, number, number];
  confidence: number;
  class_id: number;
  class_name: string;
  window_index?: number;
}

export interface ProcessingInfo {
  original_size: string;
  original_format?: string;
  method: string;
  window_size: string;
  source?: string;
  test_image_name?: string;
  total_windows?: number;
}

export interface AnalysisResult {
  predictions: Prediction[];
  image?: string;
  image_width: number;
  image_height: number;
  total_detections: number;
  processing_info?: ProcessingInfo;
  analysis_id?: string;
  image_id?: string;
}

// Enhanced analysis interface with image and detection relations
export interface AnalysisWithDetails extends AnalysisRow {
  image_url?: string;
  user_images?: ImageRow | null | undefined;
  analysis_detections?: DetectionRow[] | null | undefined;
}

// Progress tracking interfaces
export interface ProcessingProgress {
  total_windows: number;
  completed_windows: number;
  current_window: number | null;
  window_results?: any[];
  processing_stages: {
    image_upload: boolean;
    image_processing: boolean;
    window_analysis: boolean;
    nms_filtering: boolean;
    result_compilation: boolean;
  };
}

// Legacy interface for backward compatibility
export interface AnalysisHistory {
  id: string;
  userId: string;
  imageName: string;
  imageSize: number;
  analysisDate: Date;
  result: AnalysisResult;
  processingTime: number;
  status: 'completed' | 'failed' | 'processing';
  notes?: string;
  isTestImage: boolean;
  testImageName?: string;
}

export interface TestImage {
  name: string;
  url: string;
}

// Helper functions for type conversion
export function convertAnalysisToResult(analysis: AnalysisWithDetails): AnalysisResult {
  const predictions: Prediction[] = analysis.analysis_detections?.map(detection => ({
    bbox: [detection.bbox_x1, detection.bbox_y1, detection.bbox_x2, detection.bbox_y2] as [number, number, number, number],
    confidence: detection.confidence,
    class_id: detection.class_id,
    class_name: detection.class_name,
    window_index: detection.window_index || undefined
  })) || [];

  // Safely parse processing_progress
  let totalWindows: number | undefined;
  if (analysis.processing_progress && typeof analysis.processing_progress === 'object') {
    try {
      const progress = analysis.processing_progress as unknown as ProcessingProgress;
      totalWindows = progress.total_windows;
    } catch (error) {
      console.warn('Failed to parse processing_progress:', error);
    }
  }

  return {
    predictions,
    image_width: analysis.user_images?.image_width || 0,
    image_height: analysis.user_images?.image_height || 0,
    total_detections: analysis.total_detections,
    analysis_id: analysis.id,
    image_id: analysis.image_id || undefined,
    processing_info: {
      original_size: `${analysis.user_images?.image_width || 0}x${analysis.user_images?.image_height || 0}`,
      original_format: analysis.user_images?.file_format || '',
      method: analysis.processing_method,
      window_size: analysis.window_size || 'direct',
      source: analysis.source_type === 'uploaded' ? 's3' : 'test_image',
      total_windows: totalWindows
    }
  };
}

export function convertAnalysisToHistory(analysis: AnalysisWithDetails): AnalysisHistory {
  return {
    id: analysis.id,
    userId: analysis.profile_id,
    imageName: analysis.image_name,
    imageSize: analysis.user_images?.file_size || 0,
    analysisDate: new Date(analysis.analysis_date),
    result: convertAnalysisToResult(analysis),
    processingTime: analysis.processing_time || 0,
    status: analysis.status as 'completed' | 'failed' | 'processing',
    notes: analysis.notes || undefined,
    isTestImage: analysis.source_type === 'test_image',
    testImageName: analysis.source_type === 'test_image' ? analysis.image_name : undefined
  };
} 