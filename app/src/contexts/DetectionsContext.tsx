import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Tables } from '../types/database.types';
import { useAuth } from './AuthContext';

type DetectionRow = Tables<'analysis_detections'>;

interface DetectionsContextType {
  detectionsByAnalysis: Record<string, DetectionRow[]>;
  loading: boolean;
}

const DetectionsContext = createContext<DetectionsContextType | undefined>(undefined);

export const DetectionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [detectionsByAnalysis, setDetectionsByAnalysis] = useState<Record<string, DetectionRow[]>>({});
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    let isMounted = true;

    const fetchInitial = async () => {
      if (!user?.id) return;
      // Join by analyses for filtering by profile_id
      const { data, error } = await supabase
        .from('analysis_detections')
        .select(`*, analyses!inner(profile_id)`) // inner join to filter
        .eq('analyses.profile_id', user.id)
        .order('id', { ascending: false });
      if (!isMounted) return;
      if (error) {
        console.error('Detections fetch error:', error.message);
      } else if (data) {
        const rows = (data as any[]).map(row => {
          const { analyses, ...rest } = row as any;
          return rest as DetectionRow;
        });
        const grouped = rows.reduce<Record<string, DetectionRow[]>>((acc, det) => {
          if (!acc[det.analysis_id]) acc[det.analysis_id] = [];
          acc[det.analysis_id].push(det);
          return acc;
        }, {});
        setDetectionsByAnalysis(grouped);
      }
      setLoading(false);
    };

    fetchInitial();

    const channel = user?.id
      ? supabase
          .channel('realtime:analysis_detections')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'analysis_detections',
            },
            payload => {
              const det = payload.new as DetectionRow;
              // We cannot filter by profile here directly; rely on analyses cache or optimistic accept
              setDetectionsByAnalysis(prev => {
                const next = { ...prev };
                if (!next[det.analysis_id]) next[det.analysis_id] = [];
                next[det.analysis_id] = [det, ...next[det.analysis_id]];
                return next;
              });
            }
          )
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'analysis_detections' },
            payload => {
              const det = payload.new as DetectionRow;
              setDetectionsByAnalysis(prev => {
                const next = { ...prev };
                if (!next[det.analysis_id]) next[det.analysis_id] = [];
                next[det.analysis_id] = next[det.analysis_id].map(d => (d.id === det.id ? det : d));
                return next;
              });
            }
          )
          .on(
            'postgres_changes',
            { event: 'DELETE', schema: 'public', table: 'analysis_detections' },
            payload => {
              const det = payload.old as DetectionRow;
              setDetectionsByAnalysis(prev => {
                const next = { ...prev };
                if (!next[det.analysis_id]) return next;
                next[det.analysis_id] = next[det.analysis_id].filter(d => d.id !== det.id);
                return next;
              });
            }
          )
          .subscribe()
      : null;

    return () => {
      isMounted = false;
      channel?.unsubscribe();
    };
  }, [user?.id]);

  const value = useMemo<DetectionsContextType>(() => ({ detectionsByAnalysis, loading }), [detectionsByAnalysis, loading]);

  return <DetectionsContext.Provider value={value}>{children}</DetectionsContext.Provider>;
};

export const useDetections = () => {
  const ctx = useContext(DetectionsContext);
  if (!ctx) throw new Error('useDetections must be used within DetectionsProvider');
  return ctx;
};


