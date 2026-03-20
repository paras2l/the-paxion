// --- Phase 4: Distributed Cognition & Multi-Agent Collaboration ---
// --- Phase 5: Real-Time Learning & Adaptation ---
// --- Phase 6: Self-Optimization & Meta-Reasoning ---
type SelfOptimizationSectionProps = {
	agents: { id: string; name: string; role: string }[];
};

type OptimizationEvent = {
	id: string;
	agentId: string;
	agentName: string;
	strategy: string;
	improvement: string;
	timestamp: string;
	metaReasoning?: string;
};

const SelfOptimizationSection: React.FC<SelfOptimizationSectionProps> = ({ agents }) => {
	const [optimizationEvents, setOptimizationEvents] = React.useState<OptimizationEvent[]>([]);
	const [selectedAgent, setSelectedAgent] = React.useState('');
	const [strategy, setStrategy] = React.useState('');
	const [improvement, setImprovement] = React.useState('');
	const [metaReasoning, setMetaReasoning] = React.useState('');

	const handleAddOptimization = () => {
		if (!selectedAgent || !strategy.trim() || !improvement.trim()) return;
		const agent = agents.find(a => a.id === selectedAgent);
		const newEvent: OptimizationEvent = {
			id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			agentId: selectedAgent,
			agentName: agent ? agent.name : selectedAgent,
			strategy: strategy.trim(),
			improvement: improvement.trim(),
			timestamp: new Date().toLocaleString(),
			metaReasoning: metaReasoning.trim() ? metaReasoning.trim() : undefined
		};
		setOptimizationEvents(prev => [newEvent, ...prev]);
		setSelectedAgent('');
		setStrategy('');
		setImprovement('');
		setMetaReasoning('');
	};

	return (
		<section style={{ marginBottom: 48, background: '#e6f7ff', border: '1px solid #90caf9', borderRadius: 8, padding: 28 }}>
			<h3 style={{ marginBottom: 20 }}>Phase 6: Self-Optimization & Meta-Reasoning</h3>
			<div style={{ marginBottom: 24, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
				<strong>New Optimization:</strong>
				<select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)} style={{ minWidth: 140, marginRight: 8 }}>
					<option value="">Select Agent</option>
					{agents.map(agent => (
						<option key={agent.id} value={agent.id}>{agent.name}</option>
					))}
				</select>
				<input
					type="text"
					value={strategy}
					onChange={e => setStrategy(e.target.value)}
					placeholder="Optimization strategy"
					style={{ minWidth: 180, marginRight: 8, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' }}
				/>
				<input
					type="text"
					value={improvement}
					onChange={e => setImprovement(e.target.value)}
					placeholder="Resulting improvement"
					style={{ minWidth: 180, marginRight: 8, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' }}
				/>
				<input
					type="text"
					value={metaReasoning}
					onChange={e => setMetaReasoning(e.target.value)}
					placeholder="Meta-reasoning (optional)"
					style={{ minWidth: 220, marginRight: 8, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' }}
				/>
				<button onClick={handleAddOptimization} disabled={!selectedAgent || !strategy.trim() || !improvement.trim()} style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 18px', cursor: 'pointer' }}>
					Add Optimization
				</button>
			</div>
			<div style={{ marginBottom: 20 }}>
				<strong>Optimization & Meta-Reasoning History:</strong>
				<ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
					{optimizationEvents.length === 0 ? (
						<li style={{ color: '#888', padding: 8 }}>No optimizations yet.</li>
					) : (
						optimizationEvents.map(event => (
							<li key={event.id} style={{
								background: '#f0f7ff',
								border: '1px solid #b3e5fc',
								borderRadius: 6,
								marginBottom: 10,
								padding: 12,
								display: 'flex',
								flexDirection: 'column',
								gap: 4
							}}>
								<span style={{ fontWeight: 600, color: '#333' }}>{event.agentName}</span>
								<span style={{ fontSize: 13, color: '#1976d2' }}><strong>Strategy:</strong> {event.strategy}</span>
								<span style={{ fontSize: 13, color: '#388e3c' }}><strong>Improvement:</strong> {event.improvement}</span>
								{event.metaReasoning && <span style={{ fontSize: 13, color: '#ff9800' }}><strong>Meta-Reasoning:</strong> {event.metaReasoning}</span>}
								<span style={{ fontSize: 11, color: '#888' }}>{event.timestamp}</span>
							</li>
						))
					)}
				</ul>
			</div>
			<div style={{ fontSize: 13, color: '#888', marginTop: 16 }}>
				<strong>Instructions:</strong> Select an agent, describe the optimization strategy, resulting improvement, and optionally add meta-reasoning. All self-optimizations are tracked for transparency and growth.
			</div>
		</section>
	);
};

// Props for Phase 5 section
type RealTimeLearningSectionProps = {
		agents: { id: string; name: string; role: string }[];
};

// Types for learning/adaptation events
type LearningEvent = {
		id: string;
		agentId: string;
		agentName: string;
		type: 'learning' | 'adaptation' | 'feedback';
		description: string;
		timestamp: string;
		feedback?: string;
};

// Phase 5: Real-Time Learning & Adaptation Section
const RealTimeLearningSection: React.FC<RealTimeLearningSectionProps> = ({ agents }) => {
		// State for learning/adaptation events
		const [learningEvents, setLearningEvents] = React.useState<LearningEvent[]>([]);
		const [input, setInput] = React.useState('');
		const [selectedAgent, setSelectedAgent] = React.useState('');
		const [eventType, setEventType] = React.useState<'learning' | 'adaptation' | 'feedback'>('learning');
		const [feedback, setFeedback] = React.useState('');

		// Add a new learning/adaptation/feedback event
		const handleAddEvent = () => {
				if (!selectedAgent || !input.trim()) return;
				const agent = agents.find(a => a.id === selectedAgent);
				const newEvent: LearningEvent = {
						id: `le-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
						agentId: selectedAgent,
						agentName: agent ? agent.name : selectedAgent,
						type: eventType,
						description: input.trim(),
						timestamp: new Date().toLocaleString(),
						feedback: eventType === 'feedback' && feedback.trim() ? feedback.trim() : undefined
				};
				setLearningEvents(prev => [newEvent, ...prev]);
				setInput('');
				setSelectedAgent('');
				setFeedback('');
				setEventType('learning');
		};

		// Helper to get color for event type
		const eventColor = (type: string) => {
				if (type === 'learning') return '#ffe082';
				if (type === 'adaptation') return '#b2ffb2';
				if (type === 'feedback') return '#b3e5fc';
				return '#eee';
		};

		// Helper to get label for event type
		const eventLabel = (type: string) => {
				if (type === 'learning') return 'Learning';
				if (type === 'adaptation') return 'Adaptation';
				if (type === 'feedback') return 'Feedback';
				return '';
		};

		return (
				<section style={{ marginBottom: 48, background: '#fffbe6', border: '1px solid #ffe082', borderRadius: 8, padding: 28 }}>
						<h3 style={{ marginBottom: 20 }}>Phase 5: Real-Time Learning & Adaptation</h3>

						{/* Event input form */}
						<div style={{ marginBottom: 24, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
								<strong>New Event:</strong>
								<select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)} style={{ minWidth: 140, marginRight: 8 }}>
										<option value="">Select Agent</option>
										{agents.map(agent => (
												<option key={agent.id} value={agent.id}>{agent.name}</option>
										))}
								</select>
								<select value={eventType} onChange={e => setEventType(e.target.value as any)} style={{ minWidth: 120, marginRight: 8 }}>
										<option value="learning">Learning</option>
										<option value="adaptation">Adaptation</option>
										<option value="feedback">Feedback</option>
								</select>
								<input
										type="text"
										value={input}
										onChange={e => setInput(e.target.value)}
										placeholder={eventType === 'learning' ? 'What did the agent learn?' : eventType === 'adaptation' ? 'How did the agent adapt?' : 'Feedback details'}
										style={{ minWidth: 260, marginRight: 8, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' }}
								/>
								{eventType === 'feedback' && (
										<input
												type="text"
												value={feedback}
												onChange={e => setFeedback(e.target.value)}
												placeholder="Feedback for agent"
												style={{ minWidth: 180, marginRight: 8, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' }}
										/>
								)}
								<button onClick={handleAddEvent} disabled={!selectedAgent || !input.trim()} style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 18px', cursor: 'pointer' }}>
										Add Event
								</button>
						</div>

						{/* Event history */}
						<div style={{ marginBottom: 20 }}>
								<strong>Learning & Adaptation History:</strong>
								<ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
										{learningEvents.length === 0 ? (
												<li style={{ color: '#888', padding: 8 }}>No events yet.</li>
										) : (
												learningEvents.map(event => (
														<li key={event.id} style={{
																background: eventColor(event.type),
																border: '1px solid #eee',
																borderRadius: 6,
																marginBottom: 10,
																padding: 12,
																display: 'flex',
																flexDirection: 'column',
																gap: 4
														}}>
																<span style={{ fontWeight: 600, color: '#333' }}>{event.agentName}</span>
																<span style={{ fontSize: 13, color: '#555' }}><strong>{eventLabel(event.type)}:</strong> {event.description}</span>
																{event.feedback && <span style={{ fontSize: 13, color: '#1976d2' }}><strong>Feedback:</strong> {event.feedback}</span>}
																<span style={{ fontSize: 11, color: '#888' }}>{event.timestamp}</span>
														</li>
												))
										)}
								</ul>
						</div>

						{/* Instructions */}
						<div style={{ fontSize: 13, color: '#888', marginTop: 16 }}>
								<strong>Instructions:</strong> Select an agent, choose event type, and describe what it learned, how it adapted, or provide feedback. All events are tracked in real time for transparency and improvement.
						</div>
				</section>
		);
};
type DistributedCognitionSectionProps = {
	agents: { id: string; name: string; role: string }[];
};

type CollaborationSession = {
	id: string;
	agentIds: string[];
	topic: string;
	sharedNotes: string[];
};

const DistributedCognitionSection: React.FC<DistributedCognitionSectionProps> = ({ agents }) => {
	const [sessions, setSessions] = React.useState<CollaborationSession[]>([]);
	const [selectedAgents, setSelectedAgents] = React.useState<string[]>([]);
	const [topic, setTopic] = React.useState('');
	const [note, setNote] = React.useState('');
	const [activeSessionId, setActiveSessionId] = React.useState<string | null>(null);

	// Start a new collaboration session
	const handleStartSession = () => {
		if (selectedAgents.length < 2 || !topic.trim()) return;
		const session: CollaborationSession = {
			id: `sess-${Date.now()}`,
			agentIds: [...selectedAgents],
			topic: topic.trim(),
			sharedNotes: []
		};
		setSessions(prev => [...prev, session]);
		setActiveSessionId(session.id);
		setTopic('');
		setSelectedAgents([]);
	};

	// Add a shared note to the active session
	const handleAddNote = () => {
		if (!activeSessionId || !note.trim()) return;
		setSessions(prev => prev.map(sess =>
			sess.id === activeSessionId
				? { ...sess, sharedNotes: [...sess.sharedNotes, note.trim()] }
				: sess
		));
		setNote('');
	};

	// Select a session to view
	const handleSelectSession = (id: string) => setActiveSessionId(id);

	const activeSession = sessions.find(sess => sess.id === activeSessionId);

	return (
		<section style={{ marginBottom: 32, background: '#eaf6ff', border: '1px solid #90caf9', borderRadius: 6, padding: 16 }}>
			<h3>Phase 4: Distributed Cognition & Multi-Agent Collaboration</h3>
			<div style={{ marginBottom: 12 }}>
				<strong>Start Collaboration Session:</strong>
				<select
					multiple
					value={selectedAgents}
					onChange={e => {
						const options = Array.from(e.target.selectedOptions).map(opt => opt.value);
						setSelectedAgents(options);
					}}
					style={{ marginRight: 8, minWidth: 160, height: 60 }}
				>
					{agents.map(agent => (
						<option key={agent.id} value={agent.id}>{agent.name}</option>
					))}
				</select>
				<input
					type="text"
					value={topic}
					onChange={e => setTopic(e.target.value)}
					placeholder="Collaboration topic..."
					style={{ marginRight: 8, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc', width: 200 }}
				/>
				<button onClick={handleStartSession} disabled={selectedAgents.length < 2 || !topic.trim()}>
					Start Session
				</button>
			</div>
			<div style={{ marginBottom: 12 }}>
				<strong>Active Sessions:</strong>
				<ul style={{ margin: 0, paddingLeft: 16 }}>
					{sessions.map(sess => (
						<li key={sess.id}>
							<button onClick={() => handleSelectSession(sess.id)} style={{ marginRight: 8, background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>
								View
							</button>
							<span style={{ fontWeight: activeSessionId === sess.id ? 700 : 400 }}>
								{sess.topic} ({sess.agentIds.map(id => agents.find(a => a.id === id)?.name).filter(Boolean).join(', ')})
							</span>
						</li>
					))}
				</ul>
			</div>
			{activeSession && (
				<div style={{ marginBottom: 12, background: '#f5faff', border: '1px solid #b3e5fc', borderRadius: 4, padding: 12 }}>
					<strong>Session Topic:</strong> {activeSession.topic}<br />
					<strong>Agents:</strong> {activeSession.agentIds.map(id => agents.find(a => a.id === id)?.name).filter(Boolean).join(', ')}
					<div style={{ marginTop: 8 }}>
						<input
							type="text"
							value={note}
							onChange={e => setNote(e.target.value)}
							placeholder="Add shared note..."
							style={{ marginRight: 8, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc', width: 240 }}
						/>
						<button onClick={handleAddNote} disabled={!note.trim()}>
							Add Note
						</button>
					</div>
					<div style={{ marginTop: 8 }}>
						<strong>Shared Notes:</strong>
						<ul style={{ margin: 0, paddingLeft: 16 }}>
							{activeSession.sharedNotes.length === 0 ? (
								<li style={{ color: '#888' }}>No notes yet.</li>
							) : (
								activeSession.sharedNotes.map((n, idx) => <li key={idx}>{n}</li>)
							)}
						</ul>
					</div>
				</div>
			)}
			<div style={{ fontSize: 12, color: '#888' }}>
				<strong>Instructions:</strong> Select 2+ agents and a topic to start a session. Add shared notes to simulate distributed cognition and collaboration.
			</div>
		</section>
	);
};

								// ...other hooks and state...

								// Place Evaluator/Feedback Loop section after 'goals' declaration

								// ...after goals, setGoals, etc. are declared...

								// Phase 1: Evaluator/Feedback Loop for Autonomy
								const [evaluationInput, setEvaluationInput] = useState('');
								const [evaluationGoalId, setEvaluationGoalId] = useState('');
								const [evaluationTaskId, setEvaluationTaskId] = useState('');

								// Evaluate result, retry or adapt, update memory (simulated)
								const handleEvaluateTask = () => {
									if (!evaluationGoalId || !evaluationTaskId || !evaluationInput.trim()) return;
									setGoals(prevGoals => prevGoals.map(goal => {
										if (goal.id !== evaluationGoalId) return goal;
										const updatedTasks = goal.tasks.map(task => {
											if (task.id === evaluationTaskId) {
												let newStatus = task.status;
												let newResult = task.result;
												if (evaluationInput.toLowerCase().includes('retry')) {
													newStatus = 'in-progress';
													newResult = `Retried: ${task.label}`;
													setAutonomyLog(prev => [`Task retried: ${task.label}`, ...prev]);
												} else if (evaluationInput.toLowerCase().includes('adapt')) {
													newStatus = 'completed';
													newResult = `Adapted: ${task.label}`;
													setAutonomyLog(prev => [`Task adapted: ${task.label}`, ...prev]);
												} else if (evaluationInput.toLowerCase().includes('fail')) {
													newStatus = 'failed';
													newResult = `Failed: ${task.label}`;
													setAutonomyLog(prev => [`Task failed: ${task.label}`, ...prev]);
												} else if (evaluationInput.toLowerCase().includes('success')) {
													newStatus = 'completed';
													newResult = `Success: ${task.label}`;
													setAutonomyLog(prev => [`Task marked successful: ${task.label}`, ...prev]);
												}
												return { ...task, status: newStatus, result: newResult };
											}
											return task;
										});
										return { ...goal, tasks: updatedTasks };
									}));
									setEvaluationInput('');
									setEvaluationGoalId('');
									setEvaluationTaskId('');
								};


								// ...in the render/return section, after goals is available and after the Autonomy Mode Engine section...

								/* Place this after the Autonomy Mode Engine section in your render/return: */


								// Helper function to render Evaluator/Feedback Loop section after goals is declared
								function EvaluatorFeedbackSection() {
									return (
										<section style={{ marginBottom: 32 }}>
											<h3>Phase 1: Evaluator / Feedback Loop</h3>
											<div style={{ marginBottom: 8 }}>
												<select
													value={evaluationGoalId}
													onChange={e => setEvaluationGoalId(e.target.value)}
													style={{ marginRight: 8 }}
												>
													<option value="">Select Goal</option>
													{goals.map(goal => (
														<option key={goal.id} value={goal.id}>{goal.description}</option>
													))}
												</select>
												<select
													value={evaluationTaskId}
													onChange={e => setEvaluationTaskId(e.target.value)}
													style={{ marginRight: 8 }}
													disabled={!evaluationGoalId}
												>
													<option value="">Select Task</option>
													{goals.find(g => g.id === evaluationGoalId)?.tasks.map(task => (
														<option key={task.id} value={task.id}>{task.label}</option>
													))}
												</select>
												<input
													type="text"
													value={evaluationInput}
													onChange={e => setEvaluationInput(e.target.value)}
													placeholder="e.g. retry, adapt, fail, success"
													style={{ marginRight: 8, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc', width: 200 }}
													disabled={!evaluationTaskId}
												/>
												<button onClick={handleEvaluateTask} disabled={!evaluationTaskId}>Evaluate</button>
											</div>
											<div style={{ fontSize: 12, color: '#888' }}>
												<strong>Instructions:</strong> Select a goal and task, then enter an evaluation ("retry", "adapt", "fail", "success").
											</div>
										</section>
									);
								}

								// ...in your render/return, after the Autonomy Mode Engine section and after goals is declared and used:
								// {EvaluatorFeedbackSection()}
							const [nlpInput, setNlpInput] = useState('');
							const [nlpOutput, setNlpOutput] = useState('');

							// Simulate NLP: parse simple agent creation requests
							const handleNlpSubmit = () => {
								if (!nlpInput.trim()) return;
								// Very basic pattern: "Create an agent that [does X]"
								const match = nlpInput.match(/create an agent that (.+)/i);
								if (match) {
									const agentDesc = match[1];
									setNlpOutput(`Agent config generated: { "name": "Custom Agent", "goal": "${agentDesc}" }`);
								} else {
									setNlpOutput('Could not parse request. Try: "Create an agent that posts daily medical facts"');
								}
								setNlpInput('');
							};
									<section style={{ marginBottom: 32 }}>
										<h3>Phase 1: Natural Language Programming</h3>
										<div style={{ marginBottom: 8 }}>
											<input
												type="text"
												value={nlpInput}
												onChange={e => setNlpInput(e.target.value)}
												placeholder="e.g. Create an agent that posts daily medical facts"
												style={{ marginRight: 8, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc', width: 400 }}
											/>
											<button onClick={handleNlpSubmit}>Submit</button>
										</div>
										{nlpOutput && (
											<div style={{ marginTop: 8, background: '#f7f7f7', border: '1px solid #ddd', borderRadius: 4, padding: 8 }}>
												<strong>Output:</strong> {nlpOutput}
											</div>
										)}
									</section>
						// Phase 1: Identity Layer (user memory, behavior, preferences)
						type UserProfile = {
							userId: string;
							preferences: string[];
							patterns: { [key: string]: string };
							behaviorLog: string[];
						};
						const [userProfile, setUserProfile] = useState<UserProfile>({
							userId: 'u1',
							preferences: ['short answers'],
							patterns: { active_time: 'night', goal_type: 'business' },
							behaviorLog: []
						});
						const [newPreference, setNewPreference] = useState('');
						const [patternKey, setPatternKey] = useState('');
						const [patternValue, setPatternValue] = useState('');
						const [behaviorNote, setBehaviorNote] = useState('');

						// Add preference
						const handleAddPreference = () => {
							if (!newPreference.trim()) return;
							setUserProfile(prev => ({
								...prev,
								preferences: [...prev.preferences, newPreference.trim()]
							}));
							setNewPreference('');
						};

						// Add pattern
						const handleAddPattern = () => {
							if (!patternKey.trim() || !patternValue.trim()) return;
							setUserProfile(prev => ({
								...prev,
								patterns: { ...prev.patterns, [patternKey.trim()]: patternValue.trim() }
							}));
							setPatternKey('');
							setPatternValue('');
						};

						// Add behavior log
						const handleAddBehavior = () => {
							if (!behaviorNote.trim()) return;
							setUserProfile(prev => ({
								...prev,
								behaviorLog: [behaviorNote.trim(), ...prev.behaviorLog]
							}));
							setBehaviorNote('');
						};
								<section style={{ marginBottom: 32 }}>
									<h3>Phase 1: Identity Layer</h3>
									<div style={{ marginBottom: 8 }}>
										<strong>User ID:</strong> {userProfile.userId}
									</div>
									<div style={{ marginBottom: 8 }}>
										<strong>Preferences:</strong>
										<ul style={{ margin: 0, paddingLeft: 16 }}>
											{userProfile.preferences.map((pref, idx) => (
												<li key={idx}>{pref}</li>
											))}
										</ul>
										<input
											type="text"
											value={newPreference}
											onChange={e => setNewPreference(e.target.value)}
											placeholder="Add preference..."
											style={{ marginRight: 8, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' }}
										/>
										<button onClick={handleAddPreference}>Add</button>
									</div>
									<div style={{ marginBottom: 8 }}>
										<strong>Patterns:</strong>
										<ul style={{ margin: 0, paddingLeft: 16 }}>
											{Object.entries(userProfile.patterns).map(([key, value], idx) => (
												<li key={idx}>{key}: {value}</li>
											))}
										</ul>
										<input
											type="text"
											value={patternKey}
											onChange={e => setPatternKey(e.target.value)}
											placeholder="Pattern key..."
											style={{ marginRight: 8, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' }}
										/>
										<input
											type="text"
											value={patternValue}
											onChange={e => setPatternValue(e.target.value)}
											placeholder="Pattern value..."
											style={{ marginRight: 8, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' }}
										/>
										<button onClick={handleAddPattern}>Add</button>
									</div>
									<div style={{ marginBottom: 8 }}>
										<strong>Behavior Log:</strong>
										<ul style={{ margin: 0, paddingLeft: 16 }}>
											{userProfile.behaviorLog.map((note, idx) => (
												<li key={idx}>{note}</li>
											))}
										</ul>
										<input
											type="text"
											value={behaviorNote}
											onChange={e => setBehaviorNote(e.target.value)}
											placeholder="Add behavior note..."
											style={{ marginRight: 8, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' }}
										/>
										<button onClick={handleAddBehavior}>Add</button>
									</div>
								</section>
					// Phase 1: Autonomy Mode Engine foundation
					type TaskNode = {
						id: string;
						label: string;
						dependsOn: string[];
						agent: string;
						status: 'pending' | 'in-progress' | 'completed' | 'failed';
						result?: string;
					};
					type Goal = {
						id: string;
						description: string;
						tasks: TaskNode[];
					};
					const [goals, setGoals] = useState<Goal[]>([]);
					const [newGoalDesc, setNewGoalDesc] = useState('');
					const [autonomyLog, setAutonomyLog] = useState<string[]>([]);

					// Goal interpreter: create a new goal with a simple task graph
					const handleAddGoal = () => {
						if (!newGoalDesc.trim()) return;
						const goalId = `g${Date.now()}`;
						const tasks: TaskNode[] = [
							{ id: `t1`, label: 'Research', dependsOn: [], agent: 'research', status: 'pending' },
							{ id: `t2`, label: 'Execute', dependsOn: ['t1'], agent: 'execute', status: 'pending' }
						];
						setGoals(prev => [...prev, { id: goalId, description: newGoalDesc.trim(), tasks }]);
						setAutonomyLog(prev => [`Goal added: ${newGoalDesc.trim()}`, ...prev]);
						setNewGoalDesc('');
					};

					// Execution engine: run tasks in order, update status, log results
					const handleRunGoal = (goalId: string) => {
						setGoals(prevGoals => prevGoals.map(goal => {
							if (goal.id !== goalId) return goal;
							let updatedTasks = goal.tasks.map(task => ({ ...task }));
							for (let i = 0; i < updatedTasks.length; i++) {
								const task = updatedTasks[i];
								if (task.status === 'pending' && task.dependsOn.every(dep => updatedTasks.find(t => t.id === dep)?.status === 'completed')) {
									task.status = 'in-progress';
									// Simulate agent execution
									task.result = `Result of ${task.label}`;
									task.status = 'completed';
									setAutonomyLog(prev => [`Task completed: ${task.label}`, ...prev]);
								}
							}
							return { ...goal, tasks: updatedTasks };
						}));
					};
							<section style={{ marginBottom: 32 }}>
								<h3>Phase 1: Autonomy Mode Engine</h3>
								<div style={{ marginBottom: 8 }}>
									<input
										type="text"
										value={newGoalDesc}
										onChange={e => setNewGoalDesc(e.target.value)}
										placeholder="Describe a goal..."
										style={{ marginRight: 8, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' }}
									/>
									<button onClick={handleAddGoal} style={{ marginRight: 8 }}>Add Goal</button>
								</div>
								<div>
									{goals.map(goal => (
										<div key={goal.id} style={{ marginBottom: 16, border: '1px solid #ddd', borderRadius: 4, padding: 8 }}>
											<strong>Goal:</strong> {goal.description}
											<ul style={{ margin: 0, paddingLeft: 16 }}>
												{goal.tasks.map(task => (
													<li key={task.id}>
														{task.label} [{task.agent}] - <span style={{ color: task.status === 'completed' ? '#2a7' : task.status === 'failed' ? '#c22' : '#888' }}>{task.status}</span>
														{task.result && <span style={{ marginLeft: 8 }}>({task.result})</span>}
													</li>
												))}
											</ul>
											<button onClick={() => handleRunGoal(goal.id)} style={{ marginTop: 8 }}>Run Goal</button>
										</div>
									))}
								</div>
								<div style={{ maxHeight: 120, overflowY: 'auto', background: '#f7f7f7', border: '1px solid #ddd', borderRadius: 4, padding: 8 }}>
									<strong>Autonomy Log:</strong>
									<ul style={{ margin: 0, paddingLeft: 16 }}>
										{autonomyLog.map((log, idx) => (
											<li key={idx}>{log}</li>
										))}
									</ul>
								</div>
							</section>
				// Milestone 7: Agent Marketplace & Monetization
				type MarketAgent = {
					id: string;
					name: string;
					price: number;
					creator: string;
					rating?: number;
					review?: string;
					version?: string;
					dependencies?: string[];
					permissions?: string[];
					badge?: string;
				};
				const [marketAgents, setMarketAgents] = useState<MarketAgent[]>([
					{
						id: 'a1',
						name: 'Task Strategist',
						price: 15,
						creator: 'Alice',
						rating: 4,
						review: 'Great for workflow automation!',
						version: '1.2.0',
						dependencies: ['core-utils@^1.0.0'],
						permissions: ['network', 'analytics'],
						badge: '✅ Verified'
					},
					{
						id: 'a2',
						name: 'Medical Mode Agent',
						price: 20,
						creator: 'Bob',
						rating: 5,
						review: 'Excellent for medical facts!',
						version: '2.0.1',
						dependencies: ['health-core@^2.0.0'],
						permissions: ['network', 'posting'],
						badge: '🔒 Secure'
					}
				]);


				// --- Phase 3: Swarm Intelligence & Collective Reasoning ---
				// SwarmIntelligenceSection component for Phase 3
				type SwarmAgent = {
					id: string;
					name: string;
					expertise: string;
					confidence: number; // 0-1
					votes: number;
					opinion: string;
				};

				type SwarmIntelligenceSectionProps = {
					marketAgents: MarketAgent[];
				};

				const initialSwarm: SwarmAgent[] = [
					{ id: 's1', name: 'Task Strategist', expertise: 'Workflow', confidence: 0.8, votes: 3, opinion: 'Prioritize urgent tasks.' },
					{ id: 's2', name: 'Medical Mode Agent', expertise: 'Medical', confidence: 0.9, votes: 4, opinion: 'Verify medical sources.' }
				];

				const SwarmIntelligenceSection: React.FC<SwarmIntelligenceSectionProps> = ({ marketAgents }) => {
					const [swarm, setSwarm] = React.useState<SwarmAgent[]>(initialSwarm);
					const [collectiveDecision, setCollectiveDecision] = React.useState('');
					const [newOpinion, setNewOpinion] = React.useState('');
					const [selectedAgent, setSelectedAgent] = React.useState('');

					// Simulate collective reasoning: aggregate opinions, weighted by confidence and votes
					const handleCollectiveReasoning = () => {
						if (swarm.length === 0) return;
						// Weighted vote: confidence * votes
						const tally: { [opinion: string]: number } = {};
						swarm.forEach(agent => {
							const weight = agent.confidence * agent.votes;
							tally[agent.opinion] = (tally[agent.opinion] || 0) + weight;
						});
						// Find opinion with highest score
						let best = '';
						let bestScore = -1;
						Object.entries(tally).forEach(([op, score]) => {
							if (score > bestScore) {
								best = op;
								bestScore = score;
							}
						});
						setCollectiveDecision(best ? `Consensus: ${best}` : 'No consensus');
					};

					// Add a new opinion from a market agent
					const handleAddOpinion = () => {
						if (!selectedAgent || !newOpinion.trim()) return;
						const agent = marketAgents.find(a => a.id === selectedAgent);
						if (!agent) return;
						setSwarm(prev => [
							...prev,
							{
								id: `s${prev.length + 1}`,
								name: agent.name,
								expertise: agent.name,
								confidence: Math.max(0.5, Math.min(1, (agent.rating || 3) / 5)),
								votes: 1,
								opinion: newOpinion.trim()
							}
						]);
						setNewOpinion('');
						setSelectedAgent('');
					};

					return (
						<section style={{ marginBottom: 32, background: '#f6fff6', border: '1px solid #b3e6b3', borderRadius: 6, padding: 16 }}>
							<h3>Phase 3: Swarm Intelligence & Collective Reasoning</h3>
							<div style={{ marginBottom: 12 }}>
								<strong>Swarm Agents:</strong>
								<ul style={{ margin: 0, paddingLeft: 16 }}>
									{swarm.map(agent => (
										<li key={agent.id}>
											<strong>{agent.name}</strong> ({agent.expertise}) — <span style={{ color: '#1976d2' }}>Confidence: {(agent.confidence * 100).toFixed(0)}%</span>, Votes: {agent.votes}<br />
											<em>Opinion:</em> {agent.opinion}
										</li>
									))}
								</ul>
							</div>
							<div style={{ marginBottom: 12 }}>
								<strong>Add Agent Opinion:</strong>
								<select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)} style={{ marginRight: 8 }}>
									<option value="">Select Agent</option>
									{marketAgents.map(agent => (
										<option key={agent.id} value={agent.id}>{agent.name}</option>
									))}
								</select>
								<input
									type="text"
									value={newOpinion}
									onChange={e => setNewOpinion(e.target.value)}
									placeholder="Agent's opinion..."
									style={{ marginRight: 8, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc', width: 240 }}
								/>
								<button onClick={handleAddOpinion} disabled={!selectedAgent || !newOpinion.trim()}>
									Add Opinion
								</button>
							</div>
							<div style={{ marginBottom: 12 }}>
								<button onClick={handleCollectiveReasoning} style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 16px', cursor: 'pointer' }}>
									Run Collective Reasoning
								</button>
								{collectiveDecision && (
									<div style={{ marginTop: 8, background: '#e6ffe6', border: '1px solid #b3e6b3', borderRadius: 4, padding: 8 }}>
										<strong>{collectiveDecision}</strong>
									</div>
								)}
							</div>
							<div style={{ fontSize: 12, color: '#888' }}>
								<strong>Instructions:</strong> Add agent opinions, then run collective reasoning to see the consensus.
							</div>
						</section>
					);
				};

						   <SwarmIntelligenceSection marketAgents={marketAgents} />

						   {/* Phase 4: Distributed Cognition & Multi-Agent Collaboration */}
						<DistributedCognitionSection agents={marketAgents.map(a => ({ id: a.id, name: a.name, role: 'Market Agent' }))} />

						   {/* Phase 5: Real-Time Learning & Adaptation */}
							   <RealTimeLearningSection agents={marketAgents.map(a => ({ id: a.id, name: a.name, role: a.creator }))} />

							   {/* Phase 6: Self-Optimization & Meta-Reasoning */}
							   <SelfOptimizationSection agents={marketAgents.map(a => ({ id: a.id, name: a.name, role: a.creator }))} />


				const [ownedAgents, setOwnedAgents] = useState<string[]>([]);
				const [sellAgentName, setSellAgentName] = useState('');
				const [sellAgentPrice, setSellAgentPrice] = useState(0);
				const [paymentStatus, setPaymentStatus] = useState('');

				// Buy agent
				const handleBuyAgent = (id: string) => {
					setOwnedAgents(prev => [...prev, id]);
					setPaymentStatus('Payment successful (simulated)');
					logAction(`Agent bought: ${id}`);
				};

				// Sell agent
				const handleSellAgent = () => {
					if (sellAgentName && sellAgentPrice > 0) {
						setMarketAgents(prev => [
							...prev,
							{ id: `a${prev.length + 1}`, name: sellAgentName, price: sellAgentPrice, creator: 'You' }
						]);
						logAction(`Agent listed for sale: ${sellAgentName} ($${sellAgentPrice})`);
						setSellAgentName('');
						setSellAgentPrice(0);
					}
				};
						<section style={{ marginBottom: 32 }}>
							<h3>Milestone 7: Agent Marketplace & Monetization</h3>
							<div style={{ marginBottom: 8 }}>
								<strong>Buy Agents:</strong>
								<ul style={{ margin: 0, paddingLeft: 16 }}>
									{marketAgents.map(agent => (
										<li key={agent.id} style={{ marginBottom: 8 }}>
											{agent.name} by {agent.creator} - ${agent.price}
											{ownedAgents.includes(agent.id) ? (
												<span style={{ color: '#2a7', marginLeft: 8 }}>Owned</span>
											) : (
												<button
													onClick={() => handleBuyAgent(agent.id)}
													style={{ marginLeft: 8, background: '#2a7', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer' }}
												>
													Buy
												</button>
											)}
										</li>
									))}
								</ul>
								{paymentStatus && <div style={{ marginTop: 8, color: '#2a7' }}>{paymentStatus}</div>}
							</div>
							<div style={{ marginBottom: 8 }}>
								<strong>Sell Agent:</strong>
								<input
									type="text"
									value={sellAgentName}
									onChange={e => setSellAgentName(e.target.value)}
									placeholder="Agent name"
									style={{ marginLeft: 8, marginRight: 8, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' }}
								/>
								<input
									type="number"
									value={sellAgentPrice}
									onChange={e => setSellAgentPrice(Number(e.target.value))}
									placeholder="Price"
									style={{ marginRight: 8, width: 80 }}
								/>
								<button
									onClick={handleSellAgent}
									style={{ background: '#c22', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer' }}
								>
									Sell
								</button>
							</div>
							<div style={{ marginBottom: 8 }}>
								<strong>Owned Agents:</strong>
								<ul style={{ margin: 0, paddingLeft: 16 }}>
									{ownedAgents.map(id => {
										const agent = marketAgents.find(a => a.id === id);
										return agent ? <li key={id}>{agent.name} by {agent.creator}</li> : null;
									})}
								</ul>
							</div>
						</section>

						{/* Phase 2: Marketplace & Ecosystem Maturity */}
						<section style={{ marginBottom: 32, background: '#f8fafd', border: '1px solid #b3d1e6', borderRadius: 6, padding: 16 }}>
							<h3>Phase 2: Marketplace & Ecosystem Maturity</h3>
							<div style={{ marginBottom: 12 }}>
								<strong>Discover Ecosystem Agents:</strong>
								<ul style={{ margin: 0, paddingLeft: 16 }}>
									{marketAgents.map(agent => (
										<li key={agent.id} style={{ marginBottom: 8 }}>
											<span style={{ fontWeight: 500 }}>{agent.name}</span> by {agent.creator} - ${agent.price}
											<button
												onClick={() => handleBuyAgent(agent.id)}
												style={{ marginLeft: 8, background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 10px', cursor: 'pointer' }}
												disabled={ownedAgents.includes(agent.id)}
											>
												{ownedAgents.includes(agent.id) ? 'Owned' : 'Acquire'}
											</button>
										</li>
									))}
								</ul>
							</div>
							<div style={{ marginBottom: 12 }}>
								<strong>Rate & Review Agents:</strong>
								<ul style={{ margin: 0, paddingLeft: 16 }}>
									{marketAgents.map(agent => (
										<li key={agent.id} style={{ marginBottom: 8 }}>
											<span>{agent.name}</span>
											<input
												type="number"
												min={1}
												max={5}
												placeholder="Rate 1-5"
												style={{ marginLeft: 8, width: 50 }}
												onChange={e => {
													const rating = Number(e.target.value);
													setMarketAgents(prev => prev.map(a => a.id === agent.id ? { ...a, rating } : a));
												}}
											/>
											{agent.rating && <span style={{ marginLeft: 8, color: '#1976d2' }}>Rated: {agent.rating}/5</span>}
										</li>
									))}
								</ul>
							</div>
							<div style={{ marginBottom: 12 }}>
								<strong>Collaborate with Agents:</strong>
								<button
									style={{ marginLeft: 8, background: '#43a047', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 16px', cursor: 'pointer' }}
									onClick={() => alert('Collaboration feature coming soon!')}
								>
									Start Collaboration
								</button>
							</div>
							<div style={{ fontSize: 12, color: '#888' }}>
								<strong>Instructions:</strong> Discover, rate, and collaborate with agents in the ecosystem. Ecosystem maturity features will expand in future phases.
							</div>
						</section>
			// Milestone 6: Memory Upgrade
			const [semanticMemory, setSemanticMemory] = useState<{ concept: string; fact: string }[]>([]);
			const [episodicMemory, setEpisodicMemory] = useState<{ event: string; session: string; timestamp: string }[]>([]);
			const [memoryQuery, setMemoryQuery] = useState('');
			const [memoryResults, setMemoryResults] = useState<{ concept: string; fact: string }[]>([]);
			const [rollbackIndex, setRollbackIndex] = useState<number | null>(null);

			// Add to semantic memory
			const addSemanticMemory = (concept: string, fact: string) => {
				setSemanticMemory(prev => [...prev, { concept, fact }]);
				logAction(`Semantic memory added: ${concept} = ${fact}`);
			};

			// Add to episodic memory
			const addEpisodicMemory = (event: string, session: string) => {
				setEpisodicMemory(prev => [
					{ event, session, timestamp: new Date().toLocaleString() },
					...prev
				]);
				logAction(`Episodic memory added: ${event} in ${session}`);
			};

			// Context compression (simple simulation)
			const compressMemory = () => {
				setSemanticMemory(prev => prev.slice(-10));
				setEpisodicMemory(prev => prev.slice(-10));
				logAction('Memory compressed to last 10 entries');
			};

			// Advanced retrieval ranking (simple simulation)
			const queryMemory = () => {
				setMemoryResults(semanticMemory.filter(m => m.concept.includes(memoryQuery) || m.fact.includes(memoryQuery)));
				logAction(`Memory queried: ${memoryQuery}`);
			};

			// Memory rollback
			const rollbackMemory = () => {
				if (rollbackIndex !== null && rollbackIndex >= 0 && rollbackIndex < semanticMemory.length) {
					setSemanticMemory(semanticMemory.slice(0, rollbackIndex + 1));
					logAction(`Semantic memory rolled back to index ${rollbackIndex}`);
				}
			};
					<section style={{ marginBottom: 32 }}>
						<h3>Milestone 6: Memory Upgrade</h3>
						<div style={{ marginBottom: 8 }}>
							<button onClick={() => addSemanticMemory('Agent Collaboration', 'Agents share knowledge in swarms')} style={{ marginRight: 8 }}>Add Semantic Memory</button>
							<button onClick={() => addEpisodicMemory('Swarm Launched', 'Session 1')} style={{ marginRight: 8 }}>Add Episodic Memory</button>
							<button onClick={compressMemory} style={{ marginRight: 8 }}>Compress Memory</button>
						</div>
						<div style={{ marginBottom: 8 }}>
							<input
								type="text"
								value={memoryQuery}
								onChange={e => setMemoryQuery(e.target.value)}
								placeholder="Query memory..."
								style={{ marginRight: 8, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' }}
							/>
							<button onClick={queryMemory}>Query</button>
						</div>
						<div style={{ marginBottom: 8 }}>
							<label>
								Rollback Index:
								<input
									type="number"
									value={rollbackIndex ?? ''}
									onChange={e => setRollbackIndex(e.target.value ? parseInt(e.target.value) : null)}
									style={{ marginLeft: 8, width: 60 }}
								/>
							</label>
							<button onClick={rollbackMemory} style={{ marginLeft: 8 }}>Rollback</button>
						</div>
						<div style={{ marginBottom: 8 }}>
							<strong>Semantic Memory:</strong>
							<ul style={{ margin: 0, paddingLeft: 16 }}>
								{semanticMemory.map((m, idx) => (
									<li key={idx}>{m.concept}: {m.fact}</li>
								))}
							</ul>
						</div>
						<div style={{ marginBottom: 8 }}>
							<strong>Episodic Memory:</strong>
							<ul style={{ margin: 0, paddingLeft: 16 }}>
								{episodicMemory.map((m, idx) => (
									<li key={idx}>{m.event} ({m.session}) at {m.timestamp}</li>
								))}
							</ul>
						</div>
						<div style={{ marginBottom: 8 }}>
							<strong>Memory Query Results:</strong>
							<ul style={{ margin: 0, paddingLeft: 16 }}>
								{memoryResults.map((m, idx) => (
									<li key={idx}>{m.concept}: {m.fact}</li>
								))}
							</ul>
						</div>
					</section>
		// Milestone 5: Real-Time Learning & Adaptation
		const [suggestions, setSuggestions] = useState<string[]>([]);
		const [showLearned, setShowLearned] = useState(false);
		const [feedback, setFeedback] = useState<string>('');

		// ...existing code...

		const [auditLog, setAuditLog] = useState<string[]>([]);

		// Audit log helpers (ensure logAction is in scope)
		const logAction = (entry: string) => setAuditLog((prev: string[]) => [...prev, `${new Date().toLocaleTimeString()}: ${entry}`]);

		// Observe user actions and adapt suggestions
		const observeAction = (action: string) => {
			// Simulate learning: add suggestion based on action
			setSuggestions(prev => {
				const newSuggestion = `Try optimizing: ${action}`;
				if (!prev.includes(newSuggestion)) {
					return [...prev, newSuggestion];
				}
				return prev;
			});
			setShowLearned(true);
			logAction(`Paxion learned from action: ${action}`);
		};

		// User feedback handler
		const handleFeedbackSubmit = () => {
			logAction(`User feedback: ${feedback}`);
			setFeedback('');
			setShowLearned(false);
		};
	// Feature 10: Workflow Adaptation & Real-Time Learning Hooks
	// (Move state below auditLog state for correct order)


import React, { useState } from 'react';

// Swarms.tsx: Central hub for agent swarms and advanced features

// Feature placeholders:
// 1. Permissions management
// 2. Agent management
// 3. Task/plan management
// 4. Analytics
// 5. Cloud sync
// 6. Export
// 7. Real-time messaging
// 8. Audit log
// 9. Robust state & admin controls
// 10. Workflow adaptation & real-time learning hooks


// Permissions feature: basic permission toggling
type Permission = {
	id: string;
	label: string;
	granted: boolean;
};

const initialPermissions: Permission[] = [
	{ id: 'read', label: 'Read Access', granted: true },
	{ id: 'write', label: 'Write Access', granted: false },
	{ id: 'admin', label: 'Admin Access', granted: false },
];

const Swarms: React.FC = () => {
	const [permissions, setPermissions] = useState<Permission[]>(initialPermissions);

	// Feature 2: Agent Management
	// Feature 3: Task/Plan Management
	// Feature 4: Analytics
	// Feature 5: Cloud Sync
	// Feature 6: Export
	// Feature 7: Real-Time Messaging
	// Feature 8: Audit Log
	// Feature 9: Robust State & Admin Controls
	const [isAdmin, setIsAdmin] = useState(false);

	// State reset helpers
	const handleResetAll = () => {
		setPermissions(initialPermissions);
		setAgents([]);
		setTasks([]);
		setAnalyticsEvents([]);
		setMessages([]);
		setAuditLog([]);
		logAction('All state reset by admin');
	};

	const [auditLog, setAuditLog] = useState<string[]>([]);

	// Feature 10: Workflow Adaptation & Real-Time Learning Hooks
	const [workflowMode, setWorkflowMode] = useState<'standard' | 'adaptive'>('standard');
	const [learningHooks, setLearningHooks] = useState<string[]>([]);

	// Audit log helpers
	const logAction = (entry: string) => setAuditLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${entry}`]);

	// Simulate workflow adaptation
	const handleWorkflowModeChange = (mode: 'standard' | 'adaptive') => {
		setWorkflowMode(mode);
		logAction(`Workflow mode changed to ${mode}`);
		if (mode === 'adaptive') {
			triggerLearningHook('Adaptive mode activated');
		}
	};

	// Simulate real-time learning hook
	const triggerLearningHook = (event: string) => {
		setLearningHooks(prev => [...prev, event]);
		logAction(`Learning hook triggered: ${event}`);
	};

	// Wrap major actions to log them
	const handleAddAgentLogged = () => {
		handleAddAgent();
		logAction(`Agent added: ${newAgentName} (${newAgentRole})`);
	};
	const handleRemoveAgentLogged = (id: string) => {
		const agent = agents.find(a => a.id === id);
		handleRemoveAgent(id);
		logAction(`Agent removed: ${agent?.name || id}`);
	};
	const handleAddTaskLogged = () => {
		handleAddTask();
		logAction(`Task added: ${newTaskDesc}`);
	};
	const handleRemoveTaskLogged = (id: string) => {
		const task = tasks.find(t => t.id === id);
		handleRemoveTask(id);
		logAction(`Task removed: ${task?.description || id}`);
	};
	const handleSendMessageLogged = () => {
		handleSendMessage();
		const sender = agents.find(a => a.id === msgSenderId);
		const recipient = agents.find(a => a.id === msgRecipientId);
		logAction(`Message sent from ${sender?.name || msgSenderId} to ${recipient?.name || msgRecipientId}`);
	};
	const handleTrackEventLogged = () => {
		handleTrackEvent();
		logAction(`Analytics event tracked: ${eventType}`);
	};
	const handleCloudSyncLogged = () => {
		handleCloudSync();
		logAction('Cloud sync started');
	};
	const handleCloudSyncResetLogged = () => {
		handleCloudSyncReset();
		logAction('Cloud sync reset');
	};
	const handleExportLogged = () => {
		handleExport();
		logAction('Data exported');
	};

	type Message = {
		id: string;
		senderId: string;
		recipientId: string;
		content: string;
		timestamp: number;
	};
	const [messages, setMessages] = useState<Message[]>([]);
	const [msgSenderId, setMsgSenderId] = useState('');
	const [msgRecipientId, setMsgRecipientId] = useState('');
	const [msgContent, setMsgContent] = useState('');

	const handleSendMessage = () => {
		if (!msgSenderId || !msgRecipientId || !msgContent.trim()) return;
		setMessages(prev => [
			...prev,
			{
				id: `msg-${Date.now()}`,
				senderId: msgSenderId,
				recipientId: msgRecipientId,
				content: msgContent.trim(),
				timestamp: Date.now(),
			}
		]);
		setMsgContent('');
	};

	const handleExport = () => {
		const data = {
			agents,
			tasks,
			analyticsEvents,
		};
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'swarm-export.json';
		document.body.appendChild(a);
		a.click();
		setTimeout(() => {
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		}, 100);
	};

	const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');

	const handleCloudSync = () => {
		setCloudSyncStatus('syncing');
		setTimeout(() => {
			// Simulate success or error randomly
			if (Math.random() > 0.2) {
				setCloudSyncStatus('idle');
			} else {
				setCloudSyncStatus('error');
			}
		}, 1200);
	};

	const handleCloudSyncReset = () => {
		setCloudSyncStatus('idle');
	};

	type AnalyticsEvent = {
		id: string;
		type: string;
		timestamp: number;
	};
	const [analyticsEvents, setAnalyticsEvents] = useState<AnalyticsEvent[]>([]);
	const [eventType, setEventType] = useState('');

	const handleTrackEvent = () => {
		if (!eventType.trim()) return;
		setAnalyticsEvents(prev => [
			...prev,
			{ id: `event-${Date.now()}`, type: eventType.trim(), timestamp: Date.now() }
		]);
		setEventType('');
	};

	type Task = {
		id: string;
		description: string;
		status: 'pending' | 'in-progress' | 'completed';
	};
	const [tasks, setTasks] = useState<Task[]>([]);
	const [newTaskDesc, setNewTaskDesc] = useState('');
	const [newTaskStatus, setNewTaskStatus] = useState<'pending' | 'in-progress' | 'completed'>('pending');

	const handleAddTask = () => {
		if (!newTaskDesc.trim()) return;
		setTasks(prev => [
			...prev,
			{ id: `task-${Date.now()}`, description: newTaskDesc.trim(), status: newTaskStatus }
		]);
		setNewTaskDesc('');
		setNewTaskStatus('pending');
	};

	const handleRemoveTask = (id: string) => {
		setTasks(prev => prev.filter(task => task.id !== id));
	};

	type Agent = {
		id: string;
		name: string;
		role: string;
	};
	const [agents, setAgents] = useState<Agent[]>([]);
	const [newAgentName, setNewAgentName] = useState('');
	const [newAgentRole, setNewAgentRole] = useState('');

	const handleTogglePermission = (id: string) => {
		setPermissions(perms => perms.map(p => p.id === id ? { ...p, granted: !p.granted } : p));
	};

	const handleAddAgent = () => {
		if (!newAgentName.trim() || !newAgentRole.trim()) return;
		setAgents(prev => [
			...prev,
			{ id: `agent-${Date.now()}`, name: newAgentName.trim(), role: newAgentRole.trim() }
		]);
		setNewAgentName('');
		setNewAgentRole('');
	};

	const handleRemoveAgent = (id: string) => {
		setAgents(prev => prev.filter(agent => agent.id !== id));
	};

	return (
		<div style={{ padding: 24 }}>
			<h2>Agent Swarms Control Center</h2>
			<section style={{ marginBottom: 32 }}>
				<h3>Feature 1: Permissions Management</h3>
				<ul style={{ listStyle: 'none', padding: 0 }}>
					{permissions.map(perm => (
						<li key={perm.id} style={{ marginBottom: 8 }}>
							<label>
								<input
									type="checkbox"
									checked={perm.granted}
									onChange={() => handleTogglePermission(perm.id)}
									style={{ marginRight: 8 }}
								/>
								{perm.label}
							</label>
						</li>
					))}
				</ul>
			</section>
			<section style={{ marginBottom: 32 }}>
				<h3>Feature 2: Agent Management</h3>
				<div style={{ marginBottom: 16 }}>
					<input
						type="text"
						value={newAgentName}
						onChange={e => setNewAgentName(e.target.value)}
						placeholder="Agent Name"
						style={{ marginRight: 8 }}
					/>
					<input
						type="text"
						value={newAgentRole}
						onChange={e => setNewAgentRole(e.target.value)}
						placeholder="Agent Role"
						style={{ marginRight: 8 }}
					/>
					<button onClick={handleAddAgentLogged} disabled={!newAgentName.trim() || !newAgentRole.trim()}>
						Add Agent
					</button>
				</div>
				<ul style={{ listStyle: 'none', padding: 0 }}>
					{agents.length === 0 ? (
						<li style={{ color: '#888' }}>No agents added yet.</li>
					) : (
						agents.map(agent => (
							<li key={agent.id} style={{ marginBottom: 8 }}>
								<span style={{ marginRight: 12 }}><strong>{agent.name}</strong> ({agent.role})</span>
								<button onClick={() => handleRemoveAgentLogged(agent.id)} style={{ color: '#fff', background: '#c22', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>Remove</button>
							</li>
						))
					)}
				</ul>
			</section>
			<section style={{ marginBottom: 32 }}>
				<h3>Feature 3: Task/Plan Management</h3>
				<div style={{ marginBottom: 16 }}>
					<input
						type="text"
						value={newTaskDesc}
						onChange={e => setNewTaskDesc(e.target.value)}
						placeholder="Task Description"
						style={{ marginRight: 8 }}
					/>
					<select
						value={newTaskStatus}
						onChange={e => setNewTaskStatus(e.target.value as Task['status'])}
						style={{ marginRight: 8 }}
					>
						<option value="pending">Pending</option>
						<option value="in-progress">In Progress</option>
						<option value="completed">Completed</option>
					</select>
					<button onClick={handleAddTaskLogged} disabled={!newTaskDesc.trim()}>
						Add Task
					</button>
				</div>
				<ul style={{ listStyle: 'none', padding: 0 }}>
					{tasks.length === 0 ? (
						<li style={{ color: '#888' }}>No tasks added yet.</li>
					) : (
						tasks.map(task => (
							<li key={task.id} style={{ marginBottom: 8 }}>
								<span style={{ marginRight: 12 }}>
									<strong>{task.description}</strong> [{task.status}]
								</span>
								<button onClick={() => handleRemoveTaskLogged(task.id)} style={{ color: '#fff', background: '#c22', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>Remove</button>
							</li>
						))
					)}
				</ul>
			</section>
			<section style={{ marginBottom: 32 }}>
				<h3>Feature 4: Analytics</h3>
				<div style={{ marginBottom: 16 }}>
					<input
						type="text"
						value={eventType}
						onChange={e => setEventType(e.target.value)}
						placeholder="Event Type (e.g. login, task_add)"
						style={{ marginRight: 8 }}
					/>
					<button onClick={handleTrackEventLogged} disabled={!eventType.trim()}>
						Track Event
					</button>
				</div>
				<div style={{ marginBottom: 8 }}>
					<strong>Total Events:</strong> {analyticsEvents.length}
				</div>
				<ul style={{ listStyle: 'none', padding: 0 }}>
					{analyticsEvents.length === 0 ? (
						<li style={{ color: '#888' }}>No events tracked yet.</li>
					) : (
						analyticsEvents.map(ev => (
							<li key={ev.id} style={{ marginBottom: 8 }}>
								<span style={{ marginRight: 12 }}>
									<strong>{ev.type}</strong> <span style={{ color: '#888', fontSize: 12 }}>({new Date(ev.timestamp).toLocaleTimeString()})</span>
								</span>
							</li>
						))
					)}
				</ul>
			</section>
			<section style={{ marginBottom: 32 }}>
				<h3>Feature 5: Cloud Sync</h3>
				<div style={{ marginBottom: 8 }}>
					<strong>Status:</strong> {cloudSyncStatus === 'idle' ? 'Idle' : cloudSyncStatus === 'syncing' ? 'Syncing...' : 'Error'}
				</div>
				<button onClick={handleCloudSyncLogged} disabled={cloudSyncStatus === 'syncing'} style={{ marginRight: 8 }}>
					Start Sync
				</button>
				{cloudSyncStatus === 'error' && (
					<button onClick={handleCloudSyncResetLogged} style={{ background: '#c22', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>
						Reset
					</button>
				)}
			</section>
			<section style={{ marginBottom: 32 }}>
				<h3>Feature 6: Export</h3>
				<button onClick={handleExportLogged} style={{ background: '#228', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 16px', cursor: 'pointer' }}>
					Export All Data (JSON)
				</button>
			</section>
			<section style={{ marginBottom: 32 }}>
				<h3>Feature 7: Real-Time Messaging</h3>
				<div style={{ marginBottom: 16 }}>
					<select value={msgSenderId} onChange={e => setMsgSenderId(e.target.value)} style={{ marginRight: 8 }}>
						<option value="">Sender</option>
						{agents.map(agent => (
							<option key={agent.id} value={agent.id}>{agent.name}</option>
						))}
					</select>
					<select value={msgRecipientId} onChange={e => setMsgRecipientId(e.target.value)} style={{ marginRight: 8 }}>
						<option value="">Recipient</option>
						{agents.map(agent => (
							<option key={agent.id} value={agent.id}>{agent.name}</option>
						))}
					</select>
					<input
						type="text"
						value={msgContent}
						onChange={e => setMsgContent(e.target.value)}
						placeholder="Message"
						style={{ marginRight: 8 }}
					/>
					<button onClick={handleSendMessageLogged} disabled={!msgSenderId || !msgRecipientId || !msgContent.trim()}>
						Send
					</button>
				</div>
				<ul style={{ listStyle: 'none', padding: 0 }}>
					{messages.length === 0 ? (
						<li style={{ color: '#888' }}>No messages sent yet.</li>
					) : (
						messages.map(msg => {
							const sender = agents.find(a => a.id === msg.senderId);
							const recipient = agents.find(a => a.id === msg.recipientId);
							return (
								<li key={msg.id} style={{ marginBottom: 8 }}>
									<strong>{sender?.name || 'Unknown'}</strong> → <strong>{recipient?.name || 'Unknown'}</strong>: {msg.content} <span style={{ color: '#888', fontSize: 12 }}>({new Date(msg.timestamp).toLocaleTimeString()})</span>
								</li>
							);
						})
					)}
				</ul>
			</section>
			<section style={{ marginBottom: 32 }}>
				<h3>Feature 8: Audit Log</h3>
				<div style={{ minHeight: 40, maxHeight: 120, overflowY: 'auto', background: '#f9f9f9', padding: 8, fontSize: 13 }}>
					<ul style={{ padding: 0 }}>
						{auditLog.length === 0 ? (
							<li style={{ color: '#888' }}>No audit log entries yet.</li>
						) : (
							auditLog.map((entry, idx) => (
								<li key={idx} style={{ marginBottom: 2 }}>{entry}</li>
							))
						)}
					</ul>
				</div>
			</section>
			<section style={{ marginBottom: 32 }}>
				<h3>Feature 9: Robust State & Admin Controls</h3>
				<div style={{ marginBottom: 8 }}>
					<label>
						<input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} style={{ marginRight: 8 }} />
						Admin Mode
					</label>
				</div>
				{isAdmin && (
					<button onClick={handleResetAll} style={{ background: '#c22', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 16px', cursor: 'pointer' }}>
						Reset All State
					</button>
				)}
			</section>
			<section style={{ marginBottom: 32 }}>
				<h3>Feature 10: Workflow Adaptation & Real-Time Learning Hooks</h3>
				<div style={{ marginBottom: 8 }}>
					<label style={{ marginRight: 16 }}>
						<input
							type="radio"
							name="workflowMode"
							value="standard"
							checked={workflowMode === 'standard'}
							onChange={() => handleWorkflowModeChange('standard')}
							style={{ marginRight: 8 }}
						/>
						Standard Workflow
					</label>
					<label>
						<input
							type="radio"
							name="workflowMode"
							value="adaptive"
							checked={workflowMode === 'adaptive'}
							onChange={() => handleWorkflowModeChange('adaptive')}
							style={{ marginRight: 8 }}
						/>
						Adaptive Workflow
					</label>
				</div>
				{workflowMode === 'adaptive' && (
					<button
						onClick={() => {
							triggerLearningHook('User triggered learning event');
							observeAction('User triggered learning event');
						}}
						style={{ background: '#2a7', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 16px', cursor: 'pointer', marginBottom: 8 }}
					>
						Trigger Learning Hook
					</button>
				)}
				<div style={{ maxHeight: 120, overflowY: 'auto', background: '#f7f7f7', border: '1px solid #ddd', borderRadius: 4, padding: 8 }}>
					<strong>Learning Hooks Log:</strong>
					<ul style={{ margin: 0, paddingLeft: 16 }}>
						{learningHooks.map((hook, idx) => (
							<li key={idx}>{hook}</li>
						))}
					</ul>
				</div>
				{/* Milestone 5: Real-Time Learning & Adaptation UI */}
				<div style={{ marginTop: 16 }}>
					<strong>Suggestions:</strong>
					<ul style={{ margin: 0, paddingLeft: 16 }}>
						{suggestions.map((s, idx) => (
							<li key={idx}>{s}</li>
						))}
					</ul>
				</div>
				{showLearned && (
					<div style={{ marginTop: 16, background: '#e0ffe0', border: '1px solid #2a7', borderRadius: 4, padding: 8 }}>
						<strong>Paxion learned this:</strong>
						<ul style={{ margin: 0, paddingLeft: 16 }}>
							{suggestions.slice(-1).map((s, idx) => (
								<li key={idx}>{s}</li>
							))}
						</ul>
						<div style={{ marginTop: 8 }}>
							<label>
								Feedback:
								<input
									type="text"
									value={feedback}
									onChange={e => setFeedback(e.target.value)}
									style={{ marginLeft: 8, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' }}
								/>
							</label>
							<button
								onClick={handleFeedbackSubmit}
								style={{ marginLeft: 8, background: '#2a7', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer' }}
							>
								Submit Feedback
							</button>
						</div>
					</div>
				)}
			</section>
			{/* All features implemented. */}
		</div>
	);
};

export default Swarms;
