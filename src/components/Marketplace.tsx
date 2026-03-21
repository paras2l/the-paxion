// --- ModalTabs component for advanced modal ---
function ModalTabs({ selectedPlugin, setPlugins, isAdmin, reviews, getAvgRating, reviewUser, setReviewUser, reviewRating, setReviewRating, reviewText, setReviewText, handleReviewSubmit }: any) {
	const [tab, setTab] = React.useState('info');
	return (
		<div>
			{/* Tab Navigation */}
			<div style={{ display: 'flex', gap: 16, marginBottom: 18 }}>
				<button onClick={() => setTab('info')} style={{ background: tab === 'info' ? '#ffd700' : '#23234a', color: tab === 'info' ? '#23234a' : '#fff', border: 'none', borderRadius: 6, padding: '0.4em 1.2em', fontWeight: 600, cursor: 'pointer' }}>Info</button>
				<button onClick={() => setTab('reviews')} style={{ background: tab === 'reviews' ? '#ffd700' : '#23234a', color: tab === 'reviews' ? '#23234a' : '#fff', border: 'none', borderRadius: 6, padding: '0.4em 1.2em', fontWeight: 600, cursor: 'pointer' }}>Reviews</button>
				<button onClick={() => setTab('admin')} style={{ background: tab === 'admin' ? '#ffd700' : '#23234a', color: tab === 'admin' ? '#23234a' : '#fff', border: 'none', borderRadius: 6, padding: '0.4em 1.2em', fontWeight: 600, cursor: 'pointer' }}>Admin</button>
				<button onClick={() => setTab('versioning')} style={{ background: tab === 'versioning' ? '#ffd700' : '#23234a', color: tab === 'versioning' ? '#23234a' : '#fff', border: 'none', borderRadius: 6, padding: '0.4em 1.2em', fontWeight: 600, cursor: 'pointer' }}>Versioning</button>
			</div>

			{/* Info Section */}
			{tab === 'info' && (
				<section>
					<h2 style={{ marginBottom: 8 }}>{selectedPlugin.name}</h2>
					<p style={{ marginBottom: 16 }}>{selectedPlugin.description}</p>
					{selectedPlugin.version || selectedPlugin.manifest?.version ? (
						<div style={{ marginBottom: 12, color: '#aaa' }}>
							<strong>Version:</strong> {selectedPlugin.version || selectedPlugin.manifest?.version}
						</div>
					) : null}
					{loading && (
						<div style={{ textAlign: 'center', margin: '32px 0' }}>
							<span className="spinner" style={{ display: 'inline-block', width: 32, height: 32, border: '4px solid #444', borderTop: '4px solid #ffd700', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
	//
						  onClick={() => {
								if (!window.confirm(`Are you sure you want to uninstall ${selectedPlugin.name}?`)) return;
								setPlugins((prev: any[]) => prev.map(p =>
									p.id === selectedPlugin.id ? { ...p, installed: false } : p
								));
							}}
						>Uninstall</button>
					)}
				</section>
			)}

			{/* Reviews Section */}
			{tab === 'reviews' && (
				<section>
					<h3>Ratings & Reviews</h3>
					<div style={{ margin: '12px 0' }}>
						{Array.from({ length: 5 }).map((_, i) => (
							<span key={i} style={{ color: i < getAvgRating(selectedPlugin.id) ? '#ffd700' : '#555', fontSize: 22 }}>★</span>
						))}
						<span style={{ marginLeft: 8, color: '#aaa', fontSize: 14 }}>{(reviews[selectedPlugin.id]?.length || 0)} review{(reviews[selectedPlugin.id]?.length || 0) !== 1 ? 's' : ''}</span>
					</div>
					<form onSubmit={handleReviewSubmit} style={{ marginBottom: 18, background: '#181828', borderRadius: 8, padding: 12 }}>
						<div style={{ marginBottom: 8 }}>
							<input
								type="text"
								placeholder="Your name"
								value={reviewUser}
								onChange={e => setReviewUser(e.target.value)}
								style={{ width: 180, marginRight: 12, borderRadius: 4, border: '1px solid #444', padding: 6, fontSize: 15 }}
							/>
							{Array.from({ length: 5 }).map((_, i) => (
								<span
									key={i}
									style={{ cursor: 'pointer', color: i < reviewRating ? '#ffd700' : '#555', fontSize: 22 }}
									onClick={() => setReviewRating(i + 1)}
									title={`${i + 1} star${i === 0 ? '' : 's'}`}
								>★</span>
							))}
						</div>
						<textarea
							value={reviewText}
							onChange={e => setReviewText(e.target.value)}
							rows={2}
							style={{ width: '100%', borderRadius: 4, border: '1px solid #444', background: '#23234a', color: '#fff', padding: 8, fontSize: 15 }}
							placeholder="Write your review (optional)"
						/>
						<div style={{ marginTop: 8 }}>
							<button type="submit" style={{ background: '#2a2', color: '#fff', border: 'none', borderRadius: 6, padding: '0.4em 1.2em', fontSize: '1em', cursor: 'pointer' }} disabled={reviewRating < 1 || !reviewUser}>
								Submit Review
							</button>
						</div>
					</form>
					<div>
						{(reviews[selectedPlugin.id] || []).length === 0 ? (
							<div style={{ color: '#888', fontSize: 15 }}>No reviews yet. Be the first to review!</div>
						) : (
							<ul style={{ listStyle: 'none', padding: 0 }}>
								{reviews[selectedPlugin.id].map((r: any, idx: number) => (
									<li key={idx} style={{ marginBottom: 16, background: '#181828', borderRadius: 8, padding: 12 }}>
										<div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
											{Array.from({ length: 5 }).map((_, i) => (
												<span key={i} style={{ color: i < r.rating ? '#ffd700' : '#555', fontSize: 16 }}>★</span>
											))}
											<span style={{ marginLeft: 10, color: '#aaa', fontSize: 13 }}>{r.user}</span>
											<span style={{ marginLeft: 10, color: '#888', fontSize: 12 }}>{new Date(r.date).toLocaleString()}</span>
										</div>
										<div style={{ color: '#eee', fontSize: 15 }}>{r.text}</div>
									</li>
								))}
							</ul>
						)}
					</div>
				</section>
			)}

			{/* Admin Section */}
			{tab === 'admin' && isAdmin && (
				<section>
					<h3>Admin Controls</h3>
					<div style={{ marginBottom: 18, display: 'flex', gap: 8 }}>
						<button style={{ background: '#444', color: '#fff', border: 'none', borderRadius: 4, padding: '0.3em 1em', fontSize: 15, cursor: 'pointer' }} title="Edit plugin">✏️ Edit</button>
						<button style={{ background: '#a22', color: '#fff', border: 'none', borderRadius: 4, padding: '0.3em 1em', fontSize: 15, cursor: 'pointer' }} title="Delete plugin">🗑️ Delete</button>
						<button style={{ background: '#2a2', color: '#fff', border: 'none', borderRadius: 4, padding: '0.3em 1em', fontSize: 15, cursor: 'pointer' }} title="Feature plugin">⭐ Feature</button>
						<button style={{ background: '#888', color: '#fff', border: 'none', borderRadius: 4, padding: '0.3em 1em', fontSize: 15, cursor: 'pointer' }} title="Block plugin">🚫 Block</button>
					</div>
				</section>
			)}

			{/* Versioning Section */}
			{tab === 'versioning' && (
				<section>
					<h3>Changelog</h3>
					{selectedPlugin.versions && selectedPlugin.versions.length > 0 ? (
						<ul style={{ listStyle: 'none', padding: 0, marginTop: 8 }}>
							{selectedPlugin.versions.slice().reverse().map((v: any) => (
								<li key={v.version} style={{ marginBottom: 18, background: '#181828', borderRadius: 6, padding: 14 }}>
									<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
										<span style={{ fontWeight: 500, color: '#ffd700' }}>v{v.version}</span>
										<span style={{ color: '#aaa', fontSize: 13 }}>{new Date(v.date).toLocaleDateString()}</span>
									</div>
									<div style={{ color: '#eee', fontSize: 15, marginTop: 2 }}>{v.changelog}</div>
								</li>
							))}
						</ul>
					) : (
						<div style={{ color: '#888', fontSize: 15 }}>No changelog available.</div>
					)}
					<h3 style={{ marginTop: 24 }}>Version History</h3>
					{selectedPlugin.versions && selectedPlugin.versions.length > 0 ? (
						<ul style={{ listStyle: 'none', padding: 0, marginTop: 8 }}>
							{selectedPlugin.versions.slice().reverse().map((v: any) => {
								const isCurrent = (selectedPlugin.version || selectedPlugin.manifest?.version) === v.version;
								return (
									<li key={v.version} style={{ marginBottom: 10, background: isCurrent ? '#2a2a44' : '#181828', borderRadius: 6, padding: 10, border: isCurrent ? '2px solid #ffd700' : undefined }}>
										<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
											<span style={{ fontWeight: 500, color: '#ffd700' }}>v{v.version}</span>
											<span style={{ color: '#aaa', fontSize: 13 }}>{new Date(v.date).toLocaleDateString()}</span>
											{isCurrent && <span style={{ color: '#2fa', fontWeight: 600, marginLeft: 8 }}>(Current)</span>}
											{!isCurrent && (
												<button
													style={{ marginLeft: 12, background: '#228', color: '#fff', border: 'none', borderRadius: 5, padding: '2px 10px', fontSize: 13, cursor: 'pointer' }}
													onClick={() => {
														if (!window.confirm(`Rollback to version ${v.version}? This will replace the current manifest and version.`)) return;
														setPlugins((prev: any[]) => prev.map(p =>
															p.id === selectedPlugin.id
																? {
																		...p,
																		manifest: v.manifest,
																		version: v.version,
																	}
																: p
														));
														// Optionally update selectedPlugin state
													}}
												>Rollback</button>
											)}
										</div>
										<div style={{ color: '#eee', fontSize: 15, marginTop: 2 }}>{v.changelog}</div>
									</li>
								);
							})}
						</ul>
					) : (
						<div style={{ color: '#888', fontSize: 15 }}>No version history available.</div>
					)}
				</section>
			)}
		</div>
	);
}

import React, { useState } from 'react';

interface MarketplaceProps {
	plugins: any[];
	setPlugins: React.Dispatch<React.SetStateAction<any[]>>;
	handlePluginInstall: (plugin: any) => void;
}


// --- Ratings and Reviews State ---
const initialReviews: Record<string, { user: string; rating: number; text: string; date: string }[]> = {
	'plugin-1': [
		{ user: 'Alice', rating: 5, text: 'Great plugin!', date: new Date().toISOString() },
		{ user: 'Bob', rating: 4, text: 'Works well.', date: new Date().toISOString() }
	]
};

const isAdmin = true; // Demo: set to true to show admin controls

const Marketplace: React.FC<MarketplaceProps> = ({ plugins, setPlugins, handlePluginInstall }) => {
	const [search, setSearch] = useState('');
	const [showDetails, setShowDetails] = useState(false);
	const [selectedPlugin, setSelectedPlugin] = useState<any | null>(null);
	const [reviews, setReviews] = useState<Record<string, { user: string; rating: number; text: string; date: string }[]>>(initialReviews);
	const [reviewText, setReviewText] = useState('');
	const [reviewRating, setReviewRating] = useState(0);
	const [reviewUser, setReviewUser] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	React.useEffect(() => {
		setLoading(true);
		setError(null);
		// Simulate network delay and error
		const timeout = setTimeout(() => {
			// Uncomment to simulate error:
			// setError('Failed to load plugins. Please try again.');
			setLoading(false);
		}, 700);
		return () => clearTimeout(timeout);
	}, []);

	const [nav, setNav] = useState('Explore');
	const navItems = [
	  { key: 'Home', label: 'Home', icon: '🏠' },
	  { key: 'Run', label: 'Run', icon: '▶️' },
	  { key: 'Explore', label: 'Explore', icon: '🧭' },
	  { key: 'Build', label: 'Build', icon: '🛠️' },
	  { key: 'Admin', label: 'Admin', icon: '🛡️' },
	];

	return (
	  <div style={{ display: 'flex', height: '100vh', background: '#181828' }}>
	    {/* Sidebar Navigation */}
	    <nav style={{ width: 90, background: '#23234a', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', boxShadow: '2px 0 8px #0002', zIndex: 2 }}>
	      {navItems.map(item => (
	        <button
	          key={item.key}
	          onClick={() => setNav(item.key)}
	          style={{
	            background: nav === item.key ? '#ffd700' : 'none',
	            color: nav === item.key ? '#23234a' : '#fff',
	            border: 'none',
	            borderRadius: 8,
	            margin: '8px 0',
	            width: 60,
	            height: 60,
	            fontSize: 28,
	            fontWeight: 600,
	            cursor: 'pointer',
	            display: 'flex',
	            alignItems: 'center',
	            justifyContent: 'center',
	            transition: 'background 0.2s',
	          }}
	          title={item.label}
	        >
	          {item.icon}
	        </button>
	      ))}
	    </nav>
	    {/* Main Content Area */}
	    <div style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
	      {nav === 'Explore' && (
	        <>
	          <h1>Plugin Marketplace</h1>
	          {loading && (
	            <div style={{ textAlign: 'center', margin: '32px 0' }}>
	              <span className="spinner" style={{ display: 'inline-block', width: 32, height: 32, border: '4px solid #444', borderTop: '4px solid #ffd700', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
	              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
	            </div>
	          )}
	          {error && (
	            <div style={{ color: '#f44', background: '#2a1a1a', borderRadius: 8, padding: 12, marginBottom: 16, textAlign: 'center' }}>{error}</div>
	          )}
	          {!loading && !error && (
	            <>
	              <input
	                type="text"
	                placeholder="Search plugins..."
	                value={search}
	                onChange={e => setSearch(e.target.value)}
	                style={{ marginBottom: 16, padding: 8, borderRadius: 4, border: '1px solid #444', width: '100%' }}
	              />
	              <div className="marketplace-grid">
	                {plugins
	                  .filter(plugin =>
	                    !search ||
	                    plugin.name.toLowerCase().includes(search.toLowerCase()) ||
	                    plugin.description.toLowerCase().includes(search.toLowerCase()) ||
	                    (plugin.id && plugin.id.toLowerCase().includes(search.toLowerCase()))
	                  )
	                  .map(plugin => {
	                    const avgRating = getAvgRating(plugin.id);
	                    const pluginReviews = reviews[plugin.id] || [];
	                    return (
	                      <div key={plugin.id} className="plugin-card" style={{ cursor: 'pointer', position: 'relative' }} onClick={() => openDetails(plugin)}>
	                        <div className="plugin-icon">{plugin.name[0]}</div>
	                        <div className="plugin-info">
	                          <h3>{plugin.name}</h3>
	                          <p>{plugin.description}</p>
	                          {plugin.version || plugin.manifest?.version ? (
	                            <span style={{ fontSize: '0.9em', color: '#aaa' }}>Version: {plugin.version || plugin.manifest?.version}</span>
	                          ) : null}
	                          {/* Star rating display */}
	                          <div style={{ marginTop: 6 }}>
	                            {Array.from({ length: 5 }).map((_, i) => (
	                              <span key={i} style={{ color: i < avgRating ? '#ffd700' : '#555', fontSize: 18 }}>★</span>
	                            ))}
	                            <span style={{ marginLeft: 8, color: '#aaa', fontSize: 13 }}>{pluginReviews.length} review{pluginReviews.length !== 1 ? 's' : ''}</span>
	                          </div>
	                        </div>
	                        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
	                          {plugin.installed ? (
	                            <>
	                              <button
	                                className="remove-btn"
	                                style={{ background: '#a22', color: '#fff', border: 'none', borderRadius: 6, padding: '0.4em 1em', marginRight: 8, cursor: 'pointer' }}
	                                onClick={e => { e.stopPropagation(); handlePluginUninstall(plugin); }}
	                              >Uninstall</button>
	                            </>
	                          ) : (
	                            <button className="install-btn" onClick={e => { e.stopPropagation(); handlePluginInstall(plugin); }}>
	                              Install
	                            </button>
	                          )}
	                          {/* Admin controls on card */}
	                          {isAdmin && (
	                            <div style={{ marginLeft: 8, display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
	                              <button style={{ background: '#444', color: '#fff', border: 'none', borderRadius: 4, padding: '0.2em 0.7em', fontSize: 13, cursor: 'pointer' }} title="Edit plugin">✏️</button>
	                              <button style={{ background: '#a22', color: '#fff', border: 'none', borderRadius: 4, padding: '0.2em 0.7em', fontSize: 13, cursor: 'pointer' }} title="Delete plugin">🗑️</button>
	                              <button style={{ background: '#2a2', color: '#fff', border: 'none', borderRadius: 4, padding: '0.2em 0.7em', fontSize: 13, cursor: 'pointer' }} title="Feature plugin">⭐</button>
	                              <button style={{ background: '#888', color: '#fff', border: 'none', borderRadius: 4, padding: '0.2em 0.7em', fontSize: 13, cursor: 'pointer' }} title="Block plugin">🚫</button>
	                            </div>
	                          )}
	                        </div>
	                      </div>
	                    );
	                  })}
	              </div>
	            </>
	          )}
	          {/* Details Modal */}
	          {showDetails && selectedPlugin && (
	            <div className="plugin-details-modal" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
	              <div style={{ background: '#23234a', borderRadius: 16, boxShadow: '0 4px 32px #0008', padding: 32, minWidth: 320, maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto', color: '#fff', position: 'relative' }}>
	                <button style={{ position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', color: '#fff', fontSize: 28, cursor: 'pointer', zIndex: 10 }} aria-label="Close details" onClick={() => setShowDetails(false)}>×</button>
	                {/* Modal Tabs */}
	                <ModalTabs selectedPlugin={selectedPlugin} setPlugins={setPlugins} isAdmin={isAdmin} reviews={reviews} getAvgRating={getAvgRating} reviewUser={reviewUser} setReviewUser={setReviewUser} reviewRating={reviewRating} setReviewRating={setReviewRating} reviewText={reviewText} setReviewText={setReviewText} handleReviewSubmit={handleReviewSubmit} />
	              </div>
	            </div>
	          )}
	        </>
	      )}
	      {/* Placeholder for other nav sections */}
	      {nav !== 'Explore' && (
	        <div style={{ color: '#aaa', fontSize: 28, textAlign: 'center', marginTop: 120 }}>
	          <span>{nav} section coming soon...</span>
	        </div>
	      )}
	    </div>
	  </div>
	);


	const openDetails = (plugin: any) => {
		setSelectedPlugin(plugin);
		setShowDetails(true);
		setReviewText('');
		setReviewRating(0);
		setReviewUser('');
	};

	// Calculate average rating for a plugin
	const getAvgRating = (pluginId: string) => {
		const pluginReviews = reviews[pluginId] || [];
		if (pluginReviews.length === 0) return 0;
		return pluginReviews.reduce((sum, r) => sum + r.rating, 0) / pluginReviews.length;
	};

	// Uninstall plugin logic
	const handlePluginUninstall = (plugin: any) => {
		if (!window.confirm(`Are you sure you want to uninstall ${plugin.name}?`)) return;
		setPlugins((prev: any[]) => prev.map(p =>
			p.id === plugin.id ? { ...p, installed: false } : p
		));
		// If details modal is open for this plugin, update its installed state
		setSelectedPlugin((prev: any) => prev && prev.id === plugin.id ? { ...prev, installed: false } : prev);
	};

	// Handle review submit
	const handleReviewSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedPlugin || !reviewUser || reviewRating < 1) return;
		setReviews(prev => ({
			...prev,
			[selectedPlugin.id]: [
				{ user: reviewUser, rating: reviewRating, text: reviewText, date: new Date().toISOString() },
				...(prev[selectedPlugin.id] || [])
			]
		}));
		setReviewText('');
		setReviewRating(0);
		setReviewUser('');
	};

	return (
		<div style={{ padding: 24 }}>
			<h1>Plugin Marketplace</h1>
			{loading && (
				<div style={{ textAlign: 'center', margin: '32px 0' }}>
					<span className="spinner" style={{ display: 'inline-block', width: 32, height: 32, border: '4px solid #444', borderTop: '4px solid #ffd700', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
					<style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
				</div>
			)}
			{error && (
				<div style={{ color: '#f44', background: '#2a1a1a', borderRadius: 8, padding: 12, marginBottom: 16, textAlign: 'center' }}>{error}</div>
			)}
			{!loading && !error && (
				<>
					<input
						type="text"
						placeholder="Search plugins..."
						value={search}
						onChange={e => setSearch(e.target.value)}
						style={{ marginBottom: 16, padding: 8, borderRadius: 4, border: '1px solid #444', width: '100%' }}
					/>
					<div className="marketplace-grid">
						{plugins
							.filter(plugin =>
								!search ||
								plugin.name.toLowerCase().includes(search.toLowerCase()) ||
								plugin.description.toLowerCase().includes(search.toLowerCase()) ||
								(plugin.id && plugin.id.toLowerCase().includes(search.toLowerCase()))
							)
							.map(plugin => {
								const avgRating = getAvgRating(plugin.id);
								const pluginReviews = reviews[plugin.id] || [];
								return (
									<div key={plugin.id} className="plugin-card" style={{ cursor: 'pointer', position: 'relative' }} onClick={() => openDetails(plugin)}>
										<div className="plugin-icon">{plugin.name[0]}</div>
										<div className="plugin-info">
											<h3>{plugin.name}</h3>
											<p>{plugin.description}</p>
											{plugin.version || plugin.manifest?.version ? (
												<span style={{ fontSize: '0.9em', color: '#aaa' }}>Version: {plugin.version || plugin.manifest?.version}</span>
											) : null}
											{/* Star rating display */}
											<div style={{ marginTop: 6 }}>
												{Array.from({ length: 5 }).map((_, i) => (
													<span key={i} style={{ color: i < avgRating ? '#ffd700' : '#555', fontSize: 18 }}>★</span>
												))}
												<span style={{ marginLeft: 8, color: '#aaa', fontSize: 13 }}>{pluginReviews.length} review{pluginReviews.length !== 1 ? 's' : ''}</span>
											</div>
										</div>
										<div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
											{plugin.installed ? (
												<>
													<button
														className="remove-btn"
														style={{ background: '#a22', color: '#fff', border: 'none', borderRadius: 6, padding: '0.4em 1em', marginRight: 8, cursor: 'pointer' }}
														onClick={e => { e.stopPropagation(); handlePluginUninstall(plugin); }}
													>Uninstall</button>
												</>
											) : (
												<button className="install-btn" onClick={e => { e.stopPropagation(); handlePluginInstall(plugin); }}>
													Install
												</button>
											)}
											{/* Admin controls on card */}
											{isAdmin && (
												<div style={{ marginLeft: 8, display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
													<button style={{ background: '#444', color: '#fff', border: 'none', borderRadius: 4, padding: '0.2em 0.7em', fontSize: 13, cursor: 'pointer' }} title="Edit plugin">✏️</button>
													<button style={{ background: '#a22', color: '#fff', border: 'none', borderRadius: 4, padding: '0.2em 0.7em', fontSize: 13, cursor: 'pointer' }} title="Delete plugin">🗑️</button>
													<button style={{ background: '#2a2', color: '#fff', border: 'none', borderRadius: 4, padding: '0.2em 0.7em', fontSize: 13, cursor: 'pointer' }} title="Feature plugin">⭐</button>
													<button style={{ background: '#888', color: '#fff', border: 'none', borderRadius: 4, padding: '0.2em 0.7em', fontSize: 13, cursor: 'pointer' }} title="Block plugin">🚫</button>
												</div>
											)}
										</div>
									</div>
								);
							})}
					</div>
				</>
			)}

			{/* Details Modal */}

			{showDetails && selectedPlugin && (
				<div className="plugin-details-modal" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
					<div style={{ background: '#23234a', borderRadius: 16, boxShadow: '0 4px 32px #0008', padding: 32, minWidth: 320, maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto', color: '#fff', position: 'relative' }}>
						<button style={{ position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', color: '#fff', fontSize: 28, cursor: 'pointer', zIndex: 10 }} aria-label="Close details" onClick={() => setShowDetails(false)}>×</button>
						{/* Modal Tabs */}
						<ModalTabs selectedPlugin={selectedPlugin} setPlugins={setPlugins} isAdmin={isAdmin} reviews={reviews} getAvgRating={getAvgRating} reviewUser={reviewUser} setReviewUser={setReviewUser} reviewRating={reviewRating} setReviewRating={setReviewRating} reviewText={reviewText} setReviewText={setReviewText} handleReviewSubmit={handleReviewSubmit} />
					</div>
				</div>
			)}

// --- ModalTabs component for advanced modal ---
		</div>
	);
};


export default Marketplace;
