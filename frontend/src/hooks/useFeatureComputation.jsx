// src/hooks/useFeatureComputation.jsx
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function useFeatureComputation() {
  const [taskId, setTaskId] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | pending | running | completed | failed
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  const pollRef = useRef(null);

  // Запуск вычисления
  const start = async (params) => {
    setStatus('pending');
    setProgress(0);
    setMessage('Запуск задачи...');
    setError(null);
    setResult(null);
    
    try {
      const res = await axios.post(`${API_URL}/api/features/compute`, params);
      setTaskId(res.data.task_id);
      // Поллинг начнётся автоматически через useEffect
    } catch (err) {
      setStatus('failed');
      setError(err.response?.data?.error || err.message || 'Не удалось запустить вычисление');
    }
  };

  // Поллинг статуса задачи
  useEffect(() => {
    if (!taskId || !['pending', 'running'].includes(status)) return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`${API_URL}/api/features/compute/${taskId}/status`);
        const { status: s, progress: p, message: m, result: r, error: e } = res.data;
        
        setStatus(s);
        setProgress(p || 0);
        setMessage(m || '');
        
        if (s === 'completed') {
          setResult(r);
          clearInterval(pollRef.current);
        } else if (s === 'failed') {
          setError(e || 'Ошибка вычисления');
          clearInterval(pollRef.current);
        }
      } catch (err) {
        clearInterval(pollRef.current);
        setStatus('failed');
        setError('Не удалось получить статус задачи');
      }
    }, 1000); // опрос каждую секунду

    // Очистка при размонтировании или смене taskId
    return () => clearInterval(pollRef.current);
  }, [taskId, status]);

  // Сброс состояния
  const reset = () => {
    setStatus('idle');
    setProgress(0);
    setMessage('');
    setResult(null);
    setError(null);
    setTaskId(null);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  return {
    start,
    reset,
    status,
    progress,      // 0.0 → 1.0
    message,       // "Обработано 1500/4500..."
    result,
    error,
    isComputing: ['pending', 'running'].includes(status)
  };
}