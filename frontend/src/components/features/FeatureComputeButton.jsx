import { useState } from 'react'
import ComputeForm from './ComputeForm'
import ComputationResult from './ComputationResult'

export default function FeatureComputeButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleCompute = async (params) => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/features/compute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка сервера')
      }

      setResult(data)
    } catch (err) {
      setError(err.message)
      console.error('Compute error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <ComputeForm onCompute={handleCompute} loading={loading} />
      <ComputationResult result={result} error={error} />
    </>
  )
}