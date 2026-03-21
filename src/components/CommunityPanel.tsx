import { useState } from 'react';
import type { FormEvent, ChangeEvent } from 'react';

/**
 * CommunityPanel
 *
 * This panel provides community features for Raizen users:
 * - Community feed (posts, questions, tips)
 * - Post creation (text, questions, tips, links)
 * - Upvoting, commenting, and basic moderation (demo logic)
 * - Trending topics and user leaderboard (demo only)
 * - All logic is in-memory (no backend)
 */

const initialPosts = [
  {
    id: 'post-1',
    author: 'Paro the Chief',
    type: 'tip',
    content: 'Did you know? You can automate your daily reports with a single click using Raizen Swarms!',
    upvotes: 8,
    comments: [
      { id: 'c1', author: 'Alice', text: 'Great tip, thanks!' },
      { id: 'c2', author: 'Bob', text: 'How do I set up a Swarm?' },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: 'post-2',
    author: 'Alice',
    type: 'question',
    content: 'What is the best way to share a custom agent with my team?',
    upvotes: 5,
    comments: [
      { id: 'c3', author: 'Paro the Chief', text: 'Use the Sharing tab to generate a shareable link!' },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
];

const trendingTopics = ['Automation', 'Swarms', 'Agent Sharing', 'Plugin Certification'];
const leaderboard = [
  { user: 'Paro the Chief', points: 120 },
  { user: 'Alice', points: 95 },
  { user: 'Bob', points: 80 },
];

export default function CommunityPanel() {
  const [posts, setPosts] = useState(initialPosts);
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState('tip');
  const [submitMsg, setSubmitMsg] = useState('');

  function handlePost(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newContent.trim()) {
      setSubmitMsg('Enter your post content.');
      return;
    }
    setPosts([
      {
        id: `post-${Date.now()}`,
        author: 'You',
        type: newType,
        content: newContent,
        upvotes: 0,
        comments: [],
        createdAt: new Date().toISOString(),
      },
      ...posts,
    ]);
    setNewContent('');
    setNewType('tip');
    setSubmitMsg('Posted!');
  }

  function handleUpvote(postId: string) {
    setPosts(posts.map(p => p.id === postId ? { ...p, upvotes: p.upvotes + 1 } : p));
  }

  function handleComment(postId: string, text: string) {
    if (!text.trim()) return;
    setPosts(posts.map(p =>
      p.id === postId
        ? { ...p, comments: [...p.comments, { id: `c${Date.now()}`, author: 'You', text }] }
        : p
    ));
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Community</h2>
      <p>Connect with other Raizen users, share tips, ask questions, and help each other grow.</p>
      <form onSubmit={handlePost} style={{ marginBottom: 24 }}>
        <select value={newType} onChange={e => setNewType(e.target.value)} style={{ marginRight: 8 }}>
          <option value="tip">Tip</option>
          <option value="question">Question</option>
          <option value="post">Post</option>
          <option value="link">Link</option>
        </select>
        <input
          type="text"
          value={newContent}
          onChange={e => setNewContent(e.target.value)}
          placeholder="Share a tip, question, or link..."
          style={{ width: 320, marginRight: 8 }}
        />
        <button type="submit">Post</button>
        {submitMsg && <span style={{ marginLeft: 12, color: '#0af' }}>{submitMsg}</span>}
      </form>
      <div style={{ display: 'flex', gap: 32 }}>
        <div style={{ flex: 2 }}>
          <h3>Community Feed</h3>
          {posts.length === 0 ? <p>No posts yet.</p> : posts.map(post => (
            <div key={post.id} style={{ border: '1px solid #333', borderRadius: 8, padding: 16, marginBottom: 16, background: '#181828' }}>
              <div style={{ fontSize: 13, color: '#aaa', marginBottom: 4 }}>
                <strong>{post.author}</strong> • {post.type.charAt(0).toUpperCase() + post.type.slice(1)} • {new Date(post.createdAt).toLocaleString()}
              </div>
              <div style={{ fontSize: 16, marginBottom: 8 }}>{post.content}</div>
              <button onClick={() => handleUpvote(post.id)} style={{ marginRight: 8 }}>▲ {post.upvotes}</button>
              <details style={{ display: 'inline' }}>
                <summary style={{ cursor: 'pointer', color: '#0af' }}>Comments ({post.comments.length})</summary>
                <div style={{ marginTop: 8 }}>
                  {post.comments.map(c => (
                    <div key={c.id} style={{ fontSize: 14, marginBottom: 4 }}><strong>{c.author}:</strong> {c.text}</div>
                  ))}
                  <CommentBox onSubmit={text => handleComment(post.id, text)} />
                </div>
              </details>
            </div>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <h4>Trending Topics</h4>
          <ul>
            {trendingTopics.map(t => <li key={t}>{t}</li>)}
          </ul>
          <h4>User Leaderboard</h4>
          <ol>
            {leaderboard.map(l => <li key={l.user}>{l.user} ({l.points} pts)</li>)}
          </ol>
        </div>
      </div>
    </div>
  );
}

interface CommentBoxProps {
  onSubmit: (text: string) => void;
}
function CommentBox({ onSubmit }: CommentBoxProps) {
  const [text, setText] = useState('');
  return (
    <form
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        onSubmit(text);
        setText('');
      }}
      style={{ marginTop: 8 }}
    >
      <input
        type="text"
        value={text}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setText(e.target.value)}
        placeholder="Add a comment..."
        style={{ width: 180, marginRight: 6 }}
      />
      <button type="submit">Comment</button>
    </form>
  );
}
