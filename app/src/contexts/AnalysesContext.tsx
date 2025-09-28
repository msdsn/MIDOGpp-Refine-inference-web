import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Tables } from '../types/database.types';
import { useAuth } from './AuthContext';

type AnalysisRow = Tables<'analyses'>;

interface AnalysesContextType {
  analyses: AnalysisRow[];
  loading: boolean;
}

const AnalysesContext = createContext<AnalysesContextType | undefined>(undefined);

export const AnalysesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    let isMounted = true;

    const fetchInitial = async () => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('analyses')
        .select('*')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false });
      if (!isMounted) return;
      if (error) {
        console.error('Analyses fetch error:', error.message);
      } else if (data) {
        setAnalyses(data as AnalysisRow[]);
      }
      setLoading(false);
    };

    fetchInitial();

    const channel = user?.id
      ? supabase
          .channel('realtime:analyses')
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'analyses', filter: `profile_id=eq.${user.id}` },
            payload => {
              setAnalyses(prev => [payload.new as AnalysisRow, ...prev]);
            }
          )
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'analyses', filter: `profile_id=eq.${user.id}` },
            payload => {
              setAnalyses(prev => prev.map(a => (a.id === (payload.new as AnalysisRow).id ? (payload.new as AnalysisRow) : a)));
            }
          )
          .on(
            'postgres_changes',
            { event: 'DELETE', schema: 'public', table: 'analyses', filter: `profile_id=eq.${user.id}` },
            payload => {
              setAnalyses(prev => prev.filter(a => a.id !== (payload.old as AnalysisRow).id));
            }
          )
          .subscribe()
      : null;

    return () => {
      isMounted = false;
      channel?.unsubscribe();
    };
  }, [user?.id]);

  const value = useMemo<AnalysesContextType>(() => ({ analyses, loading }), [analyses, loading]);

  return <AnalysesContext.Provider value={value}>{children}</AnalysesContext.Provider>;
};

export const useAnalyses = () => {
  const ctx = useContext(AnalysesContext);
  if (!ctx) throw new Error('useAnalyses must be used within AnalysesProvider');
  return ctx;
};


