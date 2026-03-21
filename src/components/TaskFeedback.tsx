import React, { useState } from 'react'

interface TaskFeedbackProps {
  onSubmit: (feedback: { success: boolean; rating: number; comment: string }) => void
  loading?: boolean
}

export const TaskFeedback: React.FC<TaskFeedbackProps> = ({ onSubmit, loading }) => {
  const [success, setSuccess] = useState(true)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ success, rating, comment })
  }

  return (
    <form className="task-feedback-form" onSubmit={handleSubmit} style={{ background: '#23234a', borderRadius: 12, padding: 20, margin: '16px 0', boxShadow: '0 2px 8px #0002' }}>
      <h3 style={{ marginBottom: 8 }}>Task Feedback</h3>
      <div style={{ marginBottom: 12 }}>
        <label style={{ marginRight: 12 }}>
          <input type="radio" checked={success} onChange={() => setSuccess(true)} /> Success
        </label>
        <label>
          <input type="radio" checked={!success} onChange={() => setSuccess(false)} /> Failure
        </label>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label>Rating: </label>
        <input
          type="range"
          min={1}
          max={5}
          value={rating}
          onChange={e => setRating(Number(e.target.value))}
          style={{ verticalAlign: 'middle', margin: '0 8px' }}
        />
        <span>{rating} / 5</span>
      </div>
      <div style={{ marginBottom: 12 }}>
        <textarea
          placeholder="Comments (optional)"
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={2}
          style={{ width: '100%', borderRadius: 6, border: '1px solid #444', padding: 8, background: '#181828', color: '#fff' }}
        />
      </div>
      <button type="submit" disabled={loading} style={{ background: '#38bdf8', color: '#fff', border: 'none', borderRadius: 6, padding: '0.5em 1.2em', fontSize: '1em', cursor: 'pointer' }}>
        Submit Feedback
      </button>
    </form>
  )
}
