import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';
import { authenticatedFetchJson } from '../lib/api';

type AnalysisRow = Database['public']['Tables']['analyses']['Row'];
type ImageRow = Database['public']['Tables']['user_images']['Row'];
type DetectionRow = Database['public']['Tables']['analysis_detections']['Row'];

interface AnalysisProgress extends AnalysisRow {
  image_url?: string;
  user_images?: ImageRow | null;
  analysis_detections?: DetectionRow[] | null;
}

// Helper function to safely parse processing_progress
const parseProcessingProgress = (progress: any): any => {
  if (!progress || typeof progress !== 'object') return null;
  return progress as any;
};

export const useAnalysisProgress = (analysisId: string) => {
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!analysisId) return;

    // Initial fetch
    const fetchProgress = async () => {
      try {
        const { data, error } = await supabase
          .from('analyses')
          .select(`
            *,
            user_images(*),
            analysis_detections(*)
          `)
          .eq('id', analysisId)
          .single();

        if (error) {
          setError(error.message);
          return;
        }

        if (data) {
          // Get image URL if image exists
          let imageUrl: string | undefined = undefined;
          if (data.image_id) {
            try {
              const imageData = await authenticatedFetchJson<{ presigned_url: string }>(`/image/${data.image_id}`);
              imageUrl = imageData.presigned_url;
            } catch (err) {
              console.warn('Could not fetch image URL:', err);
            }
          }

          setProgress({
            ...data,
            image_url: imageUrl
          } as AnalysisProgress);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();

    // Real-time subscription
    const subscription = supabase
      .channel(`analysis_${analysisId}`)
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'analyses',
          filter: `id=eq.${analysisId}`
        }, 
        (payload) => {
          console.log('Analysis progress updated:', payload.new);
          setProgress(prev => prev ? {
            ...prev,
            ...payload.new as AnalysisRow
          } : payload.new as AnalysisProgress);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [analysisId]);

  // Calculate overall progress percentage
  const getProgressPercentage = (): number => {
    if (!progress) return 0;
    
    const progressData = parseProcessingProgress(progress.processing_progress);
    const stages = progressData?.processing_stages;
    if (!stages) return 0;

    const stageKeys = ['image_upload', 'image_processing', 'window_analysis', 'nms_filtering', 'result_compilation'];
    const completedStages = stageKeys.filter(key => stages[key]).length;
    
    let baseProgress = (completedStages / stageKeys.length) * 100;

    // Add window progress if in window analysis stage
    if (stages.window_analysis && !stages.nms_filtering && progressData) {
      const windowProgress = progressData.total_windows > 0 
        ? (progressData.completed_windows / progressData.total_windows) * 20
        : 0;
      baseProgress = 40 + windowProgress; // 40% base + up to 20% for windows
    }

    return Math.min(Math.round(baseProgress), 100);
  };

  // Get current stage description
  const getCurrentStage = (): string => {
    if (!progress) return 'Initializing...';
    
    const progressData = parseProcessingProgress(progress.processing_progress);
    const stages = progressData?.processing_stages;
    if (!stages) return 'Initializing...';

    if (!stages.image_upload) return 'Uploading image...';
    if (!stages.image_processing) return 'Processing image...';
    if (!stages.window_analysis) return 'Starting AI analysis...';
    if (stages.window_analysis && !stages.nms_filtering) {
      const current = progressData?.current_window || 0;
      const total = progressData?.total_windows || 0;
      return total > 1 ? `Analyzing window ${current + 1} of ${total}...` : 'Running AI detection...';
    }
    if (!stages.nms_filtering) return 'Filtering detections...';
    if (!stages.result_compilation) return 'Compiling results...';
    
    return 'Analysis complete!';
  };

  return { 
    progress, 
    loading, 
    error,
    progressPercentage: getProgressPercentage(),
    currentStage: getCurrentStage(),
    isComplete: progress?.status === 'completed',
    isFailed: progress?.status === 'failed'
  };
}; 