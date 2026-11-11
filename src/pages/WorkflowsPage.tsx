import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, Play, Trash2, ArrowRight, ChevronRight,
  Workflow, Sparkles, Clock, Star, CheckCircle2,
} from 'lucide-react';

interface WorkflowStep {
  id: string;
  name: string;
  toolSlug: string;
  color: string;
}

interface SavedWorkflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  lastRun?: string;
  runCount: number;
  favorite: boolean;
  createdAt: string;
}

const WORKFLOWS_KEY = 'conveter_workflows';
function loadWorkflows(): SavedWorkflow[] {
  try { return JSON.parse(localStorage.getItem(WORKFLOWS_KEY) ?? '[]'); } catch { return []; }
}
function saveWorkflows(wfs: SavedWorkflow[]): void {
  try { localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(wfs)); } catch { /* ignore */ }
}

const WORKFLOW_TEMPLATES = [
  {
    name: 'Images → PDF → Compress',
    description: 'Convert JPG images to PDF and compress file size',
    icon: '📄',
    steps: [
      { id: '1', name: 'JPG to PDF', toolSlug: 'jpg-to-pdf', color: '#ef4444' },
      { id: '2', name: 'Compress PDF', toolSlug: 'compress-pdf', color: '#ef4444' },
    ],
  },
  {
    name: 'Image Resize → Compress',
    description: 'Scale down image dimensions then compress for web',
    icon: '🖼️',
    steps: [
      { id: '1', name: 'Image Resize', toolSlug: 'image-resize', color: '#f59e0b' },
      { id: '2', name: 'Image Compress', toolSlug: 'image-compressor', color: '#f59e0b' },
    ],
  },
  {
    name: 'CSV → Excel → Archive',
    description: 'Convert CSV data to Excel and package into a ZIP archive',
    icon: '📊',
    steps: [
      { id: '1', name: 'CSV to Excel', toolSlug: 'csv-to-excel', color: '#10b981' },
      { id: '2', name: 'ZIP Compressor', toolSlug: 'zip-compressor', color: '#8b5cf6' },
    ],
  },
  {
    name: 'Split PDF → Rotate',
    description: 'Extract pages from a PDF document and rotate them',
    icon: '📑',
    steps: [
      { id: '1', name: 'Split PDF', toolSlug: 'split-pdf', color: '#ef4444' },
      { id: '2', name: 'Rotate PDF', toolSlug: 'rotate-pdf', color: '#ef4444' },
    ],
  },
];

export const WorkflowsPage: React.FC = () => {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<SavedWorkflow[]>(() => loadWorkflows());
  const [activeTab, setActiveTab] = useState<'my' | 'templates'>('my');
  const [aiPrompt, setAiPrompt] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const toggleFav = (id: string) => {
    const updated = workflows.map((w) => (w.id === id ? { ...w, favorite: !w.favorite } : w));
    setWorkflows(updated);
    saveWorkflows(updated);
  };

  const deleteWorkflow = (id: string) => {
    const updated = workflows.filter((w) => w.id !== id);
    setWorkflows(updated);
    saveWorkflows(updated);
    showToast('Workflow deleted.');
  };

  const applyTemplate = (tmpl: (typeof WORKFLOW_TEMPLATES)[0]) => {
    const newWorkflow: SavedWorkflow = {
      id: crypto.randomUUID(),
      name: tmpl.name,
      description: tmpl.description,
      steps: tmpl.steps,
      runCount: 0,
      favorite: false,
      createdAt: new Date().toLocaleDateString(),
    };
    const updated = [newWorkflow, ...workflows];
    setWorkflows(updated);
    saveWorkflows(updated);
    setActiveTab('my');
    showToast(`Added "${tmpl.name}" to My Workflows.`);
  };

  const handleAiBuild = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;

    // Create a tailored workflow based on the user's prompt
    const prompt = aiPrompt.toLowerCase();
    const steps: WorkflowStep[] = [];

    if (prompt.includes('image') || prompt.includes('photo') || prompt.includes('jpg')) {
      steps.push({ id: '1', name: 'JPG to PDF', toolSlug: 'jpg-to-pdf', color: '#ef4444' });
    }
    if (prompt.includes('merge') || prompt.includes('combine')) {
      steps.push({ id: '2', name: 'Merge PDF', toolSlug: 'merge-pdf', color: '#ef4444' });
    }
    if (prompt.includes('split') || prompt.includes('extract')) {
      steps.push({ id: '3', name: 'Split PDF', toolSlug: 'split-pdf', color: '#ef4444' });
    }
    if (prompt.includes('compress') || prompt.includes('size')) {
      steps.push({ id: '4', name: 'Compress PDF', toolSlug: 'compress-pdf', color: '#ef4444' });
    }
    if (prompt.includes('csv') || prompt.includes('excel') || prompt.includes('sheet')) {
      steps.push({ id: '5', name: 'CSV to Excel', toolSlug: 'csv-to-excel', color: '#10b981' });
    }
    if (prompt.includes('zip') || prompt.includes('archive')) {
      steps.push({ id: '6', name: 'ZIP Compressor', toolSlug: 'zip-compressor', color: '#8b5cf6' });
    }

    if (steps.length === 0) {
      steps.push(
        { id: '1', name: 'Image Converter', toolSlug: 'image-converter', color: '#f59e0b' },
        { id: '2', name: 'Image Compressor', toolSlug: 'image-compressor', color: '#f59e0b' }
      );
    }

    const newWorkflow: SavedWorkflow = {
      id: crypto.randomUUID(),
      name: aiPrompt.slice(0, 30) + (aiPrompt.length > 30 ? '…' : ''),
      description: `Generated for: "${aiPrompt}"`,
      steps,
      runCount: 0,
      favorite: true,
      createdAt: new Date().toLocaleDateString(),
    };

    const updated = [newWorkflow, ...workflows];
    setWorkflows(updated);
    saveWorkflows(updated);
    setAiPrompt('');
    setActiveTab('my');
    showToast(`Created workflow with ${steps.length} steps!`);
  };

  const runWorkflow = (wf: SavedWorkflow) => {
    // Record run count and redirect to step 1
    const updated = workflows.map((w) =>
      w.id === wf.id
        ? { ...w, runCount: w.runCount + 1, lastRun: new Date().toLocaleDateString() }
        : w
    );
    setWorkflows(updated);
    saveWorkflows(updated);
    const firstSlug = wf.steps[0]?.toolSlug || 'merge-pdf';
    navigate(`/tool/${firstSlug}`);
  };

  return (
    <div className="pt-20 pb-16" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="container-app">
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 p-4 rounded-xl shadow-cv-lg text-white bg-success-600 text-sm animate-slide-up">
            <CheckCircle2 size={16} />
            {toastMessage}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-primary">Workflows</h1>
              <span className="badge badge-success text-2xs">
                Local Storage
              </span>
            </div>
            <p className="text-sm text-muted-cv mt-1">
              Automate multi-step file processing pipelines · Stored locally and privately on your device
            </p>
          </div>
          <button
            onClick={() => setActiveTab('templates')}
            className="btn-primary btn-md gap-2"
          >
            <Plus size={16} />
            New Workflow
          </button>
        </div>

        {/* AI Suggestion box */}
        <div
          className="flex items-start gap-4 p-4 rounded-xl border mb-8"
          style={{
            background: 'linear-gradient(135deg, var(--accent-subtle), var(--card))',
            borderColor: 'var(--accent)',
          }}
        >
          <div
            className="w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)' }}
          >
            <Sparkles size={18} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-primary mb-1">AI Workflow Builder</p>
            <p className="text-xs text-secondary mb-3">
              Describe what you want to do and we will generate the multi-tool pipeline for you.
            </p>
            <form onSubmit={handleAiBuild} className="flex gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder='e.g. "Scan document with camera, run OCR, and compress to PDF"'
                className="input flex-1 h-8 text-xs"
              />
              <button type="submit" disabled={!aiPrompt.trim()} className="btn-primary btn-sm px-4">
                <Sparkles size={13} />
                Build
              </button>
            </form>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b" style={{ borderColor: 'var(--border)' }}>
          {(['my', 'templates'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 -mb-px transition-all duration-150 flex items-center gap-1.5 ${
                activeTab === tab ? 'border-current text-accent' : 'border-transparent text-muted-cv hover:text-primary'
              }`}
              style={activeTab === tab ? { color: 'var(--accent)', borderColor: 'var(--accent)' } : {}}
            >
              {tab === 'my' ? <Workflow size={14} /> : <Star size={14} />}
              {tab === 'my' ? 'My Workflows' : 'Templates'}
              {tab === 'my' && (
                <span
                  className="w-5 h-5 flex items-center justify-center rounded-full text-white text-2xs"
                  style={{ backgroundColor: 'var(--accent)', fontSize: '10px' }}
                >
                  {workflows.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* My Workflows */}
        {activeTab === 'my' && (
          <>
            {workflows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Workflow size={40} style={{ color: 'var(--text-disabled)' }} />
                <div className="text-center">
                  <p className="font-medium text-primary">No workflows yet</p>
                  <p className="text-sm text-muted-cv mt-1">
                    Create your first workflow or start from a template
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('templates')}
                  className="btn-primary btn-md"
                >
                  Browse Templates
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {workflows.map((wf) => (
                  <div
                    key={wf.id}
                    className="group flex flex-col gap-4 p-4 rounded-xl border transition-all duration-200"
                    style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-primary mb-1">{wf.name}</h3>
                        <p className="text-xs text-muted-cv">{wf.description}</p>
                      </div>
                      <button
                        onClick={() => toggleFav(wf.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-md flex-shrink-0 transition-opacity hover:bg-hover-cv"
                      >
                        <Star
                          size={13}
                          className={wf.favorite ? 'fill-current text-warning-500' : 'text-muted-cv'}
                        />
                      </button>
                    </div>

                    {/* Steps pipeline */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {wf.steps.map((step, i) => (
                        <React.Fragment key={step.id}>
                          <Link
                            to={`/tool/${step.toolSlug}`}
                            className="text-2xs px-2 py-1 rounded font-medium hover:opacity-80 transition-opacity"
                            style={{
                              backgroundColor: step.color + '15',
                              color: step.color,
                              fontSize: '11px',
                            }}
                          >
                            {step.name}
                          </Link>
                          {i < wf.steps.length - 1 && (
                            <ChevronRight size={12} style={{ color: 'var(--text-disabled)' }} />
                          )}
                        </React.Fragment>
                      ))}
                    </div>

                    {/* Meta */}
                    <div className="flex items-center justify-between text-xs text-muted-cv pt-2 border-t mt-auto"
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {wf.lastRun ?? 'Never run'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Play size={11} />
                          {wf.runCount} runs
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => deleteWorkflow(wf.id)}
                          className="w-7 h-7 flex items-center justify-center rounded hover:bg-hover-cv transition-colors text-error-600"
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                        <button
                          onClick={() => runWorkflow(wf)}
                          className="btn-primary btn-sm gap-1 ml-1"
                        >
                          <Play size={11} />
                          Run
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add new card */}
                <button
                  onClick={() => setActiveTab('templates')}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-dashed transition-all duration-200 min-h-[160px]"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.backgroundColor = 'var(--accent-subtle)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Plus size={20} style={{ color: 'var(--text-muted)' }} />
                  <span className="text-sm font-medium text-muted-cv">Create from Template</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* Templates */}
        {activeTab === 'templates' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {WORKFLOW_TEMPLATES.map((tmpl) => (
              <div
                key={tmpl.name}
                onClick={() => applyTemplate(tmpl)}
                className="flex flex-col gap-3 p-4 rounded-xl border transition-all duration-200 cursor-pointer"
                style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div className="text-2xl">{tmpl.icon}</div>
                <div>
                  <h3 className="text-sm font-semibold text-primary mb-1">{tmpl.name}</h3>
                  <p className="text-xs text-muted-cv">{tmpl.description}</p>
                </div>
                <div className="flex items-center justify-between mt-auto pt-2 border-t"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <span className="text-xs text-muted-cv">{tmpl.steps.length} steps</span>
                  <span className="flex items-center gap-1 text-xs font-medium text-accent">
                    Use template
                    <ArrowRight size={12} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowsPage;
