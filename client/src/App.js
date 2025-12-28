import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Editor from '@monaco-editor/react';

// --- STYLES (VS Code Theme Simulation) ---
const styles = {
  appContainer: "bg-[#1e1e1e] min-h-screen text-[#d4d4d4] font-sans flex",
  sidebar: "w-64 bg-[#252526] border-r border-[#333] flex flex-col",
  main: "flex-1 flex flex-col",
  header: "h-12 bg-[#3c3c3c] flex items-center px-4 justify-between shadow-md",
  searchBar: "bg-[#252526] text-white px-3 py-1 rounded border border-[#3c3c3c] w-96 focus:outline-none focus:border-[#007acc]",
  card: "bg-[#252526] p-4 m-4 rounded border border-[#333] hover:border-[#007acc] transition-colors",
  button: "bg-[#007acc] text-white px-4 py-1 rounded hover:bg-[#005a9e] text-sm",
  input: "bg-[#3c3c3c] text-white p-2 rounded w-full mb-2 border border-[#333]",
  statusBadge: (status) => `text-xs px-2 py-1 rounded ${status === 'approved' ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`
};

const api = axios.create({ baseURL: 'http://localhost:5000/api' });

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); // home, login, create, holding

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    const username = localStorage.getItem('username');
    if (token) setUser({ token, role, username });
  }, []);

  const handleLogin = async (username, password) => {
    try {
      const res = await api.post('/login', { username, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('role', res.data.role);
      localStorage.setItem('username', res.data.username);
      setUser(res.data);
      setView('home');
    } catch (e) { alert('Login failed'); }
  };

  return (
    <div className={styles.appContainer}>
      {/* Sidebar */}
      <div className={styles.sidebar}>
        <div className="p-4 text-xl font-bold text-[#007acc]">CodeVault</div>
        <nav className="flex-1">
          <NavItem label="Explorer (Home)" onClick={() => setView('home')} active={view === 'home'} />
          {user && <NavItem label="New Snippet" onClick={() => setView('create')} active={view === 'create'} />}
          {user && user.role !== 'user' && (
            <NavItem label="Holding Area" onClick={() => setView('holding')} active={view === 'holding'} />
          )}
        </nav>
        <div className="p-4 border-t border-[#333]">
          {user ? (
            <div className="text-sm">
              <p>User: {user.username}</p>
              <button onClick={() => { localStorage.clear(); setUser(null); }} className="text-red-400 mt-2">Log Out</button>
            </div>
          ) : (
            <button onClick={() => setView('login')} className={styles.button}>Log In</button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.main}>
        {view === 'home' && <SnippetList user={user} />}
        {view === 'holding' && <HoldingArea user={user} />}
        {view === 'create' && <CreateSnippet user={user} setView={setView} />}
        {view === 'login' && <AuthForm onLogin={handleLogin} />}
      </div>
    </div>
  );
}

// --- COMPONENTS ---

const NavItem = ({ label, onClick, active }) => (
  <div 
    onClick={onClick} 
    className={`px-4 py-2 cursor-pointer border-l-2 ${active ? 'border-[#007acc] bg-[#37373d]' : 'border-transparent hover:bg-[#2a2d2e]'}`}
  >
    {label}
  </div>
);

const SnippetList = ({ user }) => {
  const [snippets, setSnippets] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchSnippets();
  }, [search]);

  const fetchSnippets = async () => {
    const res = await api.get(`/snippets?status=approved&search=`);
    setSnippets(res.data);
  };

  return (
    <>
      <div className={styles.header}>
        <input 
          type="text" 
          placeholder="Search usage, language, or title..." 
          className={styles.searchBar}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="p-4 overflow-y-auto">
        {snippets.map(snip => (
          <SnippetCard key={snip._id} snippet={snip} readOnly={true} />
        ))}
        {snippets.length === 0 && <p className="text-gray-500 mt-10 text-center">No snippets found matching your usage criteria.</p>}
      </div>
    </>
  );
};

const HoldingArea = ({ user }) => {
  const [snippets, setSnippets] = useState([]);

  useEffect(() => {
    const fetchPending = async () => {
      const res = await api.get('/snippets?status=pending');
      setSnippets(res.data);
    };
    fetchPending();
  }, []);

  const handleStatus = async (id, status) => {
    const token = localStorage.getItem('token');
    await api.put(`/snippets//status`, { status }, { headers: { Authorization: token } });
    setSnippets(snippets.filter(s => s._id !== id));
  };

  const handleComment = async (id, text) => {
    const token = localStorage.getItem('token');
    await api.post(`/snippets//comment`, { text }, { headers: { Authorization: token } });
    // Refresh to show comment
    const res = await api.get('/snippets?status=pending');
    setSnippets(res.data);
  };

  return (
    <div className="p-4 overflow-y-auto h-full">
      <h2 className="text-2xl mb-4">Review Queue</h2>
      {snippets.map(snip => (
        <SnippetCard 
          key={snip._id} 
          snippet={snip} 
          isReview={true} 
          onApprove={() => handleStatus(snip._id, 'approved')}
          onReject={() => handleStatus(snip._id, 'rejected')}
          onComment={(text) => handleComment(snip._id, text)}
        />
      ))}
    </div>
  );
};

const SnippetCard = ({ snippet, isReview, onApprove, onReject, onComment }) => {
  const [comment, setComment] = useState('');

  return (
    <div className={styles.card}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-lg font-bold text-[#4ec9b0]">{snippet.title}</h3>
          <span className="text-xs text-[#569cd6]">{snippet.language}</span>
        </div>
        <span className={styles.statusBadge(snippet.status)}>{snippet.status}</span>
      </div>
      
      <div className="bg-[#1e1e1e] p-2 rounded mb-2 border border-[#333]">
        <p className="text-sm text-gray-400 italic mb-1">// Usage: {snippet.description}</p>
        <Editor 
          height="150px" 
          defaultLanguage={snippet.language} 
          defaultValue={snippet.code} 
          theme="vs-dark"
          options={{ readOnly: true, minimap: { enabled: false } }}
        />
      </div>

      {/* Comments Section */}
      {snippet.comments && snippet.comments.length > 0 && (
        <div className="mb-2 bg-[#1e1e1e] p-2 rounded text-sm">
          <p className="font-bold text-gray-500">Collaborator Notes:</p>
          {snippet.comments.map((c, i) => (
            <div key={i} className="border-l-2 border-[#007acc] pl-2 mt-1">
              <span className="text-[#007acc]">{c.user}:</span> {c.text}
            </div>
          ))}
        </div>
      )}

      {isReview && (
        <div className="mt-4 border-t border-[#333] pt-2">
          <div className="flex gap-2 mb-2">
            <input 
              className={styles.input} 
              placeholder="Add review comment..." 
              value={comment}
              onChange={e => setComment(e.target.value)}
            />
            <button onClick={() => { onComment(comment); setComment(''); }} className="bg-gray-600 px-3 rounded text-sm h-10">Post</button>
          </div>
          <div className="flex gap-2">
            <button onClick={onApprove} className="bg-green-600 text-white px-4 py-1 rounded hover:bg-green-700">Approve</button>
            <button onClick={onReject} className="bg-red-600 text-white px-4 py-1 rounded hover:bg-red-700">Reject</button>
          </div>
        </div>
      )}
    </div>
  );
};

const CreateSnippet = ({ user, setView }) => {
  const [form, setForm] = useState({ title: '', language: 'javascript', description: '', code: '' });

  const handleSubmit = async () => {
    const token = localStorage.getItem('token');
    await api.post('/snippets', form, { headers: { Authorization: token } });
    alert('Snippet submitted to Holding Area for review!');
    setView('home');
  };

  return (
    <div className="p-8 max-w-2xl mx-auto w-full">
      <h2 className="text-2xl mb-4">Submit New Snippet</h2>
      <input className={styles.input} placeholder="Title" onChange={e => setForm({...form, title: e.target.value})} />
      <input className={styles.input} placeholder="Language (e.g. javascript)" onChange={e => setForm({...form, language: e.target.value})} />
      <textarea className={styles.input} placeholder="How to use / Description" rows={3} onChange={e => setForm({...form, description: e.target.value})} />
      
      <div className="h-64 border border-[#333] mb-4">
        <Editor 
          height="100%" 
          defaultLanguage="javascript" 
          theme="vs-dark"
          onChange={(value) => setForm({...form, code: value})}
        />
      </div>
      
      <button onClick={handleSubmit} className={styles.button}>Submit for Review</button>
    </div>
  );
};

const AuthForm = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({ username: '', password: '', role: 'contributor' });

  const handleSubmit = async () => {
    if (isRegister) {
      await api.post('/register', formData);
      alert('Registered! Now log in.');
      setIsRegister(false);
    } else {
      onLogin(formData.username, formData.password);
    }
  };

  return (
    <div className="flex items-center justify-center h-full">
      <div className="bg-[#252526] p-8 rounded border border-[#333] w-96">
        <h2 className="text-xl mb-4 text-center">{isRegister ? 'Sign Up' : 'Log In'}</h2>
        <input className={styles.input} placeholder="Username" onChange={e => setFormData({...formData, username: e.target.value})} />
        <input className={styles.input} type="password" placeholder="Password" onChange={e => setFormData({...formData, password: e.target.value})} />
        
        {isRegister && (
          <select className={styles.input} onChange={e => setFormData({...formData, role: e.target.value})}>
            <option value="contributor">Contributor</option>
            <option value="admin">Admin (Reviewer)</option>
          </select>
        )}

        <button onClick={handleSubmit} className={`${styles.button} w-full mt-2`}>
          {isRegister ? 'Sign Up' : 'Log In'}
        </button>
        
        <p className="text-center mt-4 text-sm text-blue-400 cursor-pointer" onClick={() => setIsRegister(!isRegister)}>
          {isRegister ? 'Already have an account? Log In' : 'Need an account? Sign Up'}
        </p>
      </div>
    </div>
  );
};
