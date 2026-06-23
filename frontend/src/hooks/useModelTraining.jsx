import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function useModelTraining() {
  const [taskId, setTaskId] = useState(null);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  
  const pollRef = useRef(null);
  const statusRef = useRef('idle');

  const start = async (params) => {
    setStatus('pending');
    statusRef.current = 'pending';
    setProgress(0);
    setMessage('Инициализация...');
    setError(null);
    setResults(null);
    
    try {
      const res = await axios.post(`${API_URL}/api/classification/train`, params, { timeout: 30000 });
      const returnedTaskId = res.data.task_id;
      if (!returnedTaskId) throw new Error('Нет task_id в ответе');
      setTaskId(returnedTaskId);
    } catch (err) {
      setStatus('failed');
      statusRef.current = 'failed';
      setError(err.response?.data?.error || err.message || 'Не удалось запустить обучение');
    }
  };

  useEffect(() => {
    if (!taskId) return;
    
    const poll = async () => {
      if (!['pending', 'running'].includes(statusRef.current)) {
        if (pollRef.current) clearInterval(pollRef.current);
        return;
      }
      
      try {
        const res = await axios.get(`${API_URL}/api/classification/train/${taskId}/status`, { timeout: 10000 });
        
        const { status: s, progress: p, message: m, results: r, error: e } = res.data;
        
        setStatus(s);
        statusRef.current = s;
        setProgress(p || 0);
        setMessage(m || '');
        
        if (s === 'completed') {
          setResults(r);
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (s === 'failed') {
          setError(e || 'Ошибка обучения');
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch (err) {
        if (err.response?.status === 404) {
          setStatus('failed');
          statusRef.current = 'failed';
          setError(`Задача #${taskId} не найдена`);
          if (pollRef.current) clearInterval(pollRef.current);
        } else {
          console.warn('⚠️ Ошибка опроса:', err.message);
        }
      }
    };

    poll();
    pollRef.current = setInterval(poll, 1500);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [taskId]);

  const stop = async () => {
    if (!taskId) return;
    try {
      await axios.post(`${API_URL}/api/classification/train/${taskId}/cancel`);
      setStatus('cancelled');
      setMessage('Отменено пользователем');
    } catch (err) {
      console.warn('⚠️ Не удалось отменить:', err.message);
    }
  };

  const reset = () => {
    setStatus('idle');
    statusRef.current = 'idle';
    setProgress(0);
    setMessage('');
    setResults(null);
    setError(null);
    setTaskId(null);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const applyModel = async (modelId, cfId, options = {}) => {
    try {
      const res = await axios.post(`${API_URL}/api/classification/predict`, {
        cf_id: cfId,
        model_id: modelId,
        threshold: options.threshold || 80.0,
        limit: options.limit || 50,
        include_features: options.includeFeatures || false
      }, { timeout: 30000 });
      
      return res.data;
    } catch (err) {
      throw new Error(err.response?.data?.error || err.message || 'Не удалось получить прогноз');
    }
  };

  return {
    start,
    stop,
    reset,
    applyModel,
    status,
    progress,
    message,
    results,
    error,
    isTraining: ['pending', 'running'].includes(status),
    taskId
  };
}