import React, { useState } from 'react'
import './RoboticsControl.css'

interface Actuator {
    id: string
    kind: string
    workspace: string
    updatedAt: string
}

interface ActuationPlan {
    target: string
    command: string
    safetyChecks: string[]
}

export const RoboticsControl: React.FC = () => {
    const [actuatorId, setActuatorId] = useState('')
    const [actuatorKind, setActuatorKind] = useState('servo')
    const [actuatorWorkspace, setActuatorWorkspace] = useState('lab-1')
    const [registeredActuators, setRegisteredActuators] = useState<Actuator[]>([])

    const [planTarget, setPlanTarget] = useState('')
    const [planCommand, setPlanCommand] = useState('')
    const [plan, setPlan] = useState<ActuationPlan | null>(null)

    const [status, setStatus] = useState('')

    const registerActuator = async () => {
        if (!actuatorKind.trim()) {
            setStatus('Provide an actuator kind.')
            return
        }
        // @ts-ignore
        const res = await window.paxion?.robotics?.register?.({
            id: actuatorId.trim() || undefined,
            kind: actuatorKind.trim(),
            workspace: actuatorWorkspace.trim(),
        })
        if (res?.ok && res.actuator) {
            setRegisteredActuators(prev => [res.actuator, ...prev].slice(0, 20))
            setStatus(`Actuator "${res.actuator.id}" registered.`)
            setActuatorId('')
        } else {
            setStatus(res?.reason || 'Registration failed.')
        }
    }

    const buildPlan = async () => {
        if (!planTarget.trim() || !planCommand.trim()) {
            setStatus('Provide both target and command for the actuation plan.')
            return
        }
        // @ts-ignore
        const res = await window.paxion?.robotics?.plan?.({
            target: planTarget.trim(),
            command: planCommand.trim(),
        })
        if (res?.ok && res.actuationPlan) {
            setPlan(res.actuationPlan)
            setStatus('')
        } else {
            setStatus('Plan generation failed.')
        }
    }

    return (
        <div className="robotics-container">
            <header className="robotics-header">
                <h1>IoT / Robotics Control Plane</h1>
                <p>Register actuators and build AI-driven actuation plans with safety checks.</p>
            </header>

            <div className="robotics-grid">
                <section className="robotics-card">
                    <h3>Register Actuator</h3>
                    <div className="robotics-form">
                        <label>Actuator ID (auto-generated if empty)</label>
                        <input className="robotics-input" placeholder="act-001 (optional)" value={actuatorId} onChange={e => setActuatorId(e.target.value)} />
                        <label>Kind</label>
                        <select className="robotics-select" value={actuatorKind} onChange={e => setActuatorKind(e.target.value)}>
                            <option value="servo">Servo</option>
                            <option value="stepper">Stepper Motor</option>
                            <option value="relay">Relay</option>
                            <option value="linear-actuator">Linear Actuator</option>
                            <option value="pump">Pump</option>
                            <option value="generic">Generic</option>
                        </select>
                        <label>Workspace</label>
                        <input className="robotics-input" placeholder="lab-1" value={actuatorWorkspace} onChange={e => setActuatorWorkspace(e.target.value)} />
                        <button className="robotics-btn" onClick={() => void registerActuator()}>Register</button>
                    </div>

                    <div className="actuator-list">
                        {registeredActuators.length === 0 && <p className="robotics-muted">No actuators registered yet.</p>}
                        {registeredActuators.map(a => (
                            <div key={a.id} className="actuator-row">
                                <span className="actuator-kind">{a.kind}</span>
                                <span className="actuator-id">{a.id}</span>
                                <span className="actuator-ws">{a.workspace}</span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="robotics-card">
                    <h3>Actuation Plan Builder</h3>
                    <div className="robotics-form">
                        <label>Target</label>
                        <input className="robotics-input" placeholder="e.g. servo-arm-1" value={planTarget} onChange={e => setPlanTarget(e.target.value)} />
                        <label>Command</label>
                        <input className="robotics-input" placeholder="e.g. rotate 90deg CW" value={planCommand} onChange={e => setPlanCommand(e.target.value)} />
                        <button className="robotics-btn" onClick={() => void buildPlan()}>Generate Plan</button>
                    </div>

                    {plan && (
                        <div className="actuation-plan">
                            <div className="plan-row"><span>Target</span><strong>{plan.target}</strong></div>
                            <div className="plan-row"><span>Command</span><strong>{plan.command}</strong></div>
                            <div className="safety-checks">
                                <p>Safety Checks:</p>
                                <ul>
                                    {plan.safetyChecks.map((check, i) => (
                                        <li key={i}>✓ {check}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                </section>
            </div>

            {status && <p className="robotics-status">{status}</p>}
        </div>
    )
}
