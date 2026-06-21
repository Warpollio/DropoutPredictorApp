import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function useFeatureComputation() {
  const [taskId, setTaskId] = useState(null);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  const pollRef = useRef(null);
  const statusRef = useRef('idle');

  // 🚀 Запуск вычисления
  const start = async (params) => {
    setStatus('pending');
    statusRef.current = 'pending'; 
    setProgress(0);
    setMessage('Запуск задачи...');
    setError(null);
    setResult(null);
    
    try {
      const res = await axios.post(`${API_URL}/api/features/compute-v2`, params);
      const returnedTaskId = res.data.task_id;
      if (!returnedTaskId) throw new Error('Нет task_id в ответе');
      setTaskId(returnedTaskId);
    } catch (err) {
      setStatus('failed');
      statusRef.current = 'failed';
      setError(err.response?.data?.error || err.message || 'Ошибка запуска');
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
        const res = await axios.get(`${API_URL}/api/features/compute/${taskId}/status`);
        const { status: s, progress: p, message: m, result: r, error: e } = res.data;
        

        setStatus(s);
        statusRef.current = s;
        setProgress(p || 0);
        setMessage(m || '');
        
        if (s === 'completed') {
          setResult(r);
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (s === 'failed') {
          setError(e || 'Ошибка вычисления');
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
    

    pollRef.current = setInterval(poll, 1000);


    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [taskId]); 

  // 🔄 Сброс
  const reset = () => {
    setStatus('idle');
    statusRef.current = 'idle';
    setProgress(0);
    setMessage('');
    setResult(null);
    setError(null);
    setTaskId(null);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  return {
    start,
    reset,
    status,
    progress,
    message,
    result,
    error,
    isComputing: ['pending', 'running'].includes(status)
  };
}