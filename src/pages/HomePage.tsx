import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Sparkles, Upload, Zap, Shield, Globe, Cpu,
  FileText, Image, Table,
  Archive, CheckCircle2, Star, ChevronRight,
  Play, Layers, RefreshCw, Lock,
} from 'lucide-react';
import { CATEGORY_META, getPopularTools, getNewTools, TOOLS } from '@/registry/tools';
import { useAppStore } from '@/store/app.store';

// ────────────────────────────────────────────────
// Hero Section
// ────────────────────────────────────────────────
const HeroSection: React.FC = () => {
  const { setSearchOpen, setSearchQuery } = useAppStore();
  const [aiInput, setAiInput] = useState('');

  const examplePrompts = [
    'Merge multiple PDF documents',
    'Convert JPG images to PDF',
    'Compress images for web',
    'Convert CSV to Excel spreadsheet',
  ];

  const handleAiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (aiInput.trim()) {
      setSearchQuery(aiInput);
      setSearchOpen(true);
    }
  };

  return (
    <section className="relative overflow-hidden pt-28 pb-20">
      {/* Background grid */}
      <div
        className="absolute inset-0 bg-grid-dark opacity-100 dark:opacity-100"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }}
      />
      <div className="dark:hidden absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.05) 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Ambient glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-20 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(90,106,248,0.4) 0%, transparent 70%)',
        }}
        aria-hidden
      />

      <div className="container-narrow relative z-10">
        {/* Top badge */}
        <div className="flex justify-center mb-8">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-sm font-medium"
            style={{
              backgroundColor: 'var(--accent-subtle)',
              borderColor: 'var(--accent)',
              color: 'var(--accent)',
            }}
          >
            <Sparkles size={14} />
            <span>{TOOLS.length} Essential Tools · 100% Client-Side Privacy</span>
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: 'var(--accent)' }}
            />
          </div>
        </div>

        {/* Headline */}
        <h1
          className="text-center font-bold tracking-tight leading-none mb-6"
          style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)' }}
        >
          Everything you need to{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, #5b6af8 0%, #a78bfa 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            work with files
          </span>
        </h1>

        <p
          className="text-center text-xl mb-10 mx-auto max-w-2xl"
          style={{ color: 'var(--text-secondary)' }}
        >
          Convert. Create. Analyze. Simplify.
          <br />
          <span className="text-base" style={{ color: 'var(--text-muted)' }}>
            Online or offline — your files, your control.
          </span>
        </p>

        {/* CTA Buttons */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <Link to="/tools" className="btn-primary btn-lg gap-2">
            <span>Explore All Tools</span>
            <ArrowRight size={16} />
          </Link>
          <button
            onClick={() => setSearchOpen(true)}
            className="btn-secondary btn-lg gap-2"
          >
            <Upload size={16} />
            <span>Upload a File</span>
          </button>
        </div>

        {/* AI Command Box */}
        <div
          className="max-w-2xl mx-auto rounded-xl border p-1"
          style={{
            backgroundColor: 'var(--card)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <form onSubmit={handleAiSubmit} className="flex items-center gap-2">
            <div
              className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 ml-1"
              style={{ backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)' }}
            >
              <Sparkles size={14} />
            </div>
            <input
              type="text"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="What do you want to do? e.g. 'Convert these images to a compressed PDF'"
              className="flex-1 bg-transparent text-sm outline-none py-2"
              style={{ color: 'var(--text-primary)' }}
            />
            <button
              type="submit"
              className="btn-primary btn-sm flex-shrink-0"
              disabled={!aiInput.trim()}
            >
              <ArrowRight size={14} />
            </button>
          </form>
          {/* Example prompts */}
          <div className="flex flex-wrap gap-1.5 px-2 pb-2 mt-1">
            {examplePrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => setAiInput(prompt)}
                className="text-xs px-2.5 py-1 rounded-full border transition-all duration-150"
                style={{
                  borderColor: 'var(--border)',
                  backgroundColor: 'var(--muted)',
                  color: 'var(--text-muted)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.color = 'var(--accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Trust metrics */}
        <div className="flex items-center justify-center gap-8 mt-10 flex-wrap">
          {[
            { label: 'Tools Available', value: `${TOOLS.length}+` },
            { label: 'Offline Support', value: 'Yes' },
            { label: 'Files Processed', value: '10M+' },
            { label: 'Privacy First', value: '100%' },
          ].map((m) => (
            <div key={m.label} className="flex flex-col items-center gap-1">
              <span className="text-2xl font-bold font-num" style={{ color: 'var(--accent)' }}>
                {m.value}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {m.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ────────────────────────────────────────────────
// Categories Section
// ────────────────────────────────────────────────
const CategoriesSection: React.FC = () => {
  const categories = Object.values(CATEGORY_META);

  return (
    <section className="py-16" id="categories">
      <div className="container-app">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-label mb-2">Browse by Category</p>
            <h2 className="text-2xl font-bold">All Tool Categories</h2>
          </div>
          <Link to="/tools" className="btn-ghost btn-sm gap-1" style={{ color: 'var(--accent)' }}>
            View all tools
            <ChevronRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/tools/${cat.id}`}
              className="group flex flex-col items-center gap-2.5 p-4 rounded-xl border text-center transition-all duration-200 cursor-pointer"
              style={{
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = cat.color + '60';
                e.currentTarget.style.backgroundColor = cat.color + '08';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = `0 8px 24px ${cat.color}20`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.backgroundColor = 'var(--card)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div
                className="w-10 h-10 flex items-center justify-center rounded-xl"
                style={{ backgroundColor: cat.color + '15', color: cat.color }}
              >
                {getCategoryIcon(cat.id, 20)}
              </div>
              <span className="text-xs font-medium text-primary leading-tight">
                {cat.name.replace(' Tools', '').replace('& ', '')}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

const getCategoryIcon = (id: string, size = 16): React.ReactNode => {
  const props = { size };
  const map: Record<string, React.ReactNode> = {
    pdf: <FileText {...props} />,
    image: <Image {...props} />,
    data: <Table {...props} />,
    archive: <Archive {...props} />,
    utilities: <RefreshCw {...props} />,
  };
  return map[id] ?? <Zap {...props} />;
};

// ────────────────────────────────────────────────
// Popular Tools Section
// ────────────────────────────────────────────────
const PopularToolsSection: React.FC = () => {
  const popular = getPopularTools(12);
  const { isFavoriteTool, toggleFavoriteTool } = useAppStore();

  return (
    <section className="py-16" style={{ backgroundColor: 'var(--muted)' }}>
      <div className="container-app">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-label mb-2">Most Used</p>
            <h2 className="text-2xl font-bold">Popular Tools</h2>
          </div>
          <Link to="/tools" className="btn-ghost btn-sm gap-1" style={{ color: 'var(--accent)' }}>
            Browse all
            <ChevronRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {popular.map((tool) => {
            const meta = CATEGORY_META[tool.category];
            const isFav = isFavoriteTool(tool.slug);
            return (
              <div
                key={tool.id}
                className="group relative flex flex-col gap-3 p-4 rounded-xl border transition-all duration-200 cursor-pointer"
                style={{
                  backgroundColor: 'var(--card)',
                  borderColor: 'var(--border)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = meta.color + '50';
                  e.currentTarget.style.boxShadow = `0 4px 16px ${meta.color}15`;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div
                    className="w-9 h-9 flex items-center justify-center rounded-lg"
                    style={{ backgroundColor: meta.color + '15', color: meta.color }}
                  >
                    {getCategoryIcon(tool.category, 16)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {tool.new && (
                      <span
                        className="badge text-2xs"
                        style={{
                          backgroundColor: meta.color + '15',
                          color: meta.color,
                          fontSize: '10px',
                        }}
                      >
                        New
                      </span>
                    )}
                    {tool.premium && (
                      <span
                        className="badge text-2xs"
                        style={{
                          backgroundColor: '#f59e0b15',
                          color: '#f59e0b',
                          fontSize: '10px',
                        }}
                      >
                        Pro
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavoriteTool(tool.slug);
                      }}
                      className="w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Star
                        size={14}
                        className={isFav ? 'fill-current text-warning-500' : 'text-muted-cv'}
                      />
                    </button>
                  </div>
                </div>

                {/* Info */}
                <div>
                  <h3 className="text-sm font-semibold text-primary mb-1">
                    {tool.name}
                  </h3>
                  <p className="text-xs text-muted-cv leading-relaxed line-clamp-2">
                    {tool.description}
                  </p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-auto pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center gap-2">
                    {tool.offlineSupported && (
                      <span className="flex items-center gap-1 text-2xs text-muted-cv">
                        <span className="w-1.5 h-1.5 rounded-full bg-success-500 inline-block" />
                        Offline
                      </span>
                    )}
                    {tool.batchSupported && (
                      <span className="flex items-center gap-1 text-2xs text-muted-cv">
                        <Layers size={10} />
                        Batch
                      </span>
                    )}
                  </div>
                  <Link
                    to={`/tool/${tool.slug}`}
                    className="flex items-center gap-1 text-xs font-medium transition-colors"
                    style={{ color: meta.color }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Use tool
                    <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// ────────────────────────────────────────────────
// How It Works
// ────────────────────────────────────────────────
const HowItWorksSection: React.FC = () => {
  const steps = [
    {
      step: '01',
      title: 'Upload or Drop',
      description: 'Drag and drop files, paste from clipboard, or upload from your device or cloud storage.',
      icon: <Upload size={24} />,
      color: '#5b6af8',
    },
    {
      step: '02',
      title: 'Configure Options',
      description: 'Choose your output format, quality, and any tool-specific settings before processing.',
      icon: <Cpu size={24} />,
      color: '#10b981',
    },
    {
      step: '03',
      title: 'Process Instantly',
      description: 'Files process locally when possible, or securely in the cloud for advanced operations.',
      icon: <RefreshCw size={24} />,
      color: '#f59e0b',
    },
    {
      step: '04',
      title: 'Download Results',
      description: 'Download individually, as a ZIP, share a link, or save to your history.',
      icon: <CheckCircle2 size={24} />,
      color: '#22c55e',
    },
  ];

  return (
    <section className="py-16">
      <div className="container-narrow">
        <div className="text-center mb-12">
          <p className="text-label mb-2">Simple Workflow</p>
          <h2 className="text-3xl font-bold mb-3">How CONVETER Works</h2>
          <p className="text-secondary max-w-xl mx-auto">
            Every tool follows the same intuitive workflow — no learning curve required.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, idx) => (
            <div key={step.step} className="relative flex flex-col gap-4">
              {/* Connector line */}
              {idx < steps.length - 1 && (
                <div
                  className="hidden lg:block absolute top-8 left-full w-full h-px -translate-y-1/2 z-0"
                  style={{
                    background: `linear-gradient(to right, ${step.color}40, transparent)`,
                    width: 'calc(100% - 4rem)',
                    left: '3.5rem',
                  }}
                />
              )}

              <div
                className="relative z-10 w-16 h-16 flex items-center justify-center rounded-2xl border-2"
                style={{
                  backgroundColor: step.color + '10',
                  borderColor: step.color + '30',
                  color: step.color,
                }}
              >
                {step.icon}
                <span
                  className="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: step.color }}
                >
                  {idx + 1}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-primary mb-1">{step.title}</h3>
                <p className="text-xs text-muted-cv leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ────────────────────────────────────────────────
// Privacy & Offline Section
// ────────────────────────────────────────────────
const PrivacySection: React.FC = () => {
  const features = [
    {
      icon: <Shield size={20} />,
      title: 'Local Processing',
      description: 'The majority of tools process entirely on your device via WebAssembly. Your files never leave your browser.',
      color: '#22c55e',
    },
    {
      icon: <Zap size={20} />,
      title: 'Offline Support',
      description: 'Core tools work without internet. Install as a PWA and use anywhere.',
      color: '#5b6af8',
    },
    {
      icon: <Lock size={20} />,
      title: 'Auto-Delete',
      description: 'Cloud-processed files are automatically deleted after processing per our retention policy.',
      color: '#f59e0b',
    },
    {
      icon: <Globe size={20} />,
      title: 'No Tracking',
      description: 'We don\'t track your file contents or sell your data. Privacy is built into the architecture.',
      color: '#ec4899',
    },
  ];

  return (
    <section className="py-16" style={{ backgroundColor: 'var(--muted)' }}>
      <div className="container-narrow">
        <div className="text-center mb-12">
          <p className="text-label mb-2">Privacy First</p>
          <h2 className="text-3xl font-bold mb-3">Your Files, Your Control</h2>
          <p className="text-secondary max-w-xl mx-auto">
            CONVETER uses a smart processing engine that handles files locally whenever possible,
            and shows you exactly what's happening.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="flex flex-col gap-3 p-5 rounded-xl border"
              style={{
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
              }}
            >
              <div
                className="w-10 h-10 flex items-center justify-center rounded-xl"
                style={{ backgroundColor: f.color + '15', color: f.color }}
              >
                {f.icon}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-primary mb-1">{f.title}</h3>
                <p className="text-xs text-muted-cv leading-relaxed">{f.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ────────────────────────────────────────────────
// AI Tools Highlight
// ────────────────────────────────────────────────
const AISection: React.FC = () => {
  return (
    <section className="py-16">
      <div className="container-narrow">
        <div
          className="relative rounded-2xl overflow-hidden border p-8 lg:p-12 flex flex-col lg:flex-row items-start gap-8"
          style={{
            backgroundColor: 'var(--card)',
            borderColor: 'var(--accent)',
            background: 'linear-gradient(135deg, var(--card) 0%, var(--accent-subtle) 100%)',
          }}
        >
          {/* Ambient */}
          <div
            className="absolute top-0 right-0 w-72 h-72 opacity-20 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at center, var(--accent), transparent)',
            }}
          />

          <div className="flex-1 relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-8 h-8 flex items-center justify-center rounded-lg"
                style={{ backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)' }}
              >
                <Sparkles size={16} />
              </div>
              <span className="text-label" style={{ color: 'var(--accent)' }}>Automated Pipelines</span>
            </div>

            <h2 className="text-2xl font-bold mb-3">
              Turn any task into a workflow
            </h2>
            <p className="text-secondary mb-6 max-w-lg">
              Chain your essential file tools into multi-step pipelines.
              Resize, compress, convert, and bundle your files in a single reproducible flow.
            </p>

            <div className="space-y-3 mb-6">
              {[
                { input: 'Convert JPG images to PDF and compress', steps: ['JPG TO PDF', 'COMPRESS PDF'] },
                { input: 'Resize images, convert to WebP, and bundle in ZIP', steps: ['IMAGE RESIZE', 'IMAGE CONVERT', 'ZIP COMPRESS'] },
              ].map((ex) => (
                <div
                  key={ex.input}
                  className="p-3 rounded-lg border text-sm"
                  style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}
                >
                  <p className="text-secondary text-xs mb-2 italic">"{ex.input}"</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {ex.steps.map((step, i) => (
                      <React.Fragment key={step}>
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium font-mono"
                          style={{ backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)' }}
                        >
                          {step}
                        </span>
                        {i < ex.steps.length - 1 && (
                          <ArrowRight size={12} style={{ color: 'var(--text-muted)' }} />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <Link to="/workflows" className="btn-primary btn-md gap-2">
                <Play size={15} />
                Build Workflow
              </Link>
              <Link to="/tools" className="btn-secondary btn-md gap-2">
                <Layers size={15} />
                Explore All Tools
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ────────────────────────────────────────────────
// New Tools Section
// ────────────────────────────────────────────────
const NewToolsSection: React.FC = () => {
  const newTools = getNewTools(6);
  if (!newTools.length) return null;

  return (
    <section className="py-16" style={{ backgroundColor: 'var(--muted)' }}>
      <div className="container-app">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-label mb-2">Recently Added</p>
            <h2 className="text-2xl font-bold">New Tools</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {newTools.map((tool) => {
            const meta = CATEGORY_META[tool.category];
            return (
              <Link
                key={tool.id}
                to={`/tool/${tool.slug}`}
                className="flex items-center gap-4 p-4 rounded-xl border transition-all duration-200"
                style={{
                  backgroundColor: 'var(--card)',
                  borderColor: 'var(--border)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = meta.color + '60';
                  e.currentTarget.style.transform = 'translateX(4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.transform = 'translateX(0)';
                }}
              >
                <div
                  className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0"
                  style={{ backgroundColor: meta.color + '15', color: meta.color }}
                >
                  {getCategoryIcon(tool.category, 18)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-primary">{tool.name}</span>
                    <span
                      className="badge text-2xs"
                      style={{
                        backgroundColor: meta.color + '15',
                        color: meta.color,
                        fontSize: '10px',
                      }}
                    >
                      {tool.status === 'beta' ? 'Beta' : 'New'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-cv truncate">{tool.description}</p>
                </div>
                <ArrowRight size={16} style={{ color: meta.color, flexShrink: 0 }} />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// ────────────────────────────────────────────────
// Premium CTA
// ────────────────────────────────────────────────
const PremiumCTA: React.FC = () => {
  return (
    <section className="py-16">
      <div className="container-narrow">
        <div
          className="flex flex-col lg:flex-row items-center justify-between gap-8 p-8 rounded-2xl border"
          style={{
            backgroundColor: 'var(--card)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={16} style={{ color: '#f59e0b' }} />
              <span className="text-label" style={{ color: '#f59e0b' }}>CONVETER Premium</span>
            </div>
            <h2 className="text-2xl font-bold mb-2">Unlock the full platform</h2>
            <p className="text-secondary max-w-lg">
              Larger files, batch processing, AI tools, advanced OCR, cloud storage,
              saved workflows, and priority processing.
            </p>
            <div className="flex flex-wrap gap-3 mt-4">
              {['Larger file limits', 'Batch processing', 'AI tools', 'OCR', 'Cloud storage', 'Saved workflows'].map((f) => (
                <div key={f} className="flex items-center gap-1.5 text-xs text-secondary">
                  <CheckCircle2 size={12} style={{ color: '#22c55e' }} />
                  {f}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 flex-shrink-0">
            <div className="text-center">
              <div className="flex items-end gap-1 justify-center">
                <span className="text-4xl font-bold text-primary">$9</span>
                <span className="text-secondary mb-1">/month</span>
              </div>
              <p className="text-xs text-muted-cv">or $79/year — save 27%</p>
            </div>
            <Link to="/pricing" className="btn-primary btn-lg w-full justify-center">
              View Pricing
            </Link>
            <Link to="/pricing" className="text-xs text-muted-cv hover:text-accent transition-colors">
              Free plan available — no credit card
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

// ────────────────────────────────────────────────
// Footer
// ────────────────────────────────────────────────
const Footer: React.FC = () => {
  const footerLinks = {
    'PDF Tools': ['Merge PDF', 'Split PDF', 'Compress PDF', 'Rotate PDF', 'JPG to PDF', 'PDF to Text'],
    'Image Tools': ['Image Converter', 'Image Compressor', 'Image Resize', 'Image Crop'],
    'Data & Utilities': ['CSV to Excel', 'Excel to CSV', 'JSON to CSV', 'CSV to JSON', 'QR Code Generator'],
    'Archive': ['ZIP Compressor', 'ZIP Extractor'],
    'Company': ['About', 'Pricing', 'Status'],
    'Legal': ['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'GDPR'],
  };

  return (
    <footer
      className="border-t"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="container-app py-12">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-3 lg:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" fill="var(--accent)" />
                <path d="M9 13L13 9L17 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13 9V21" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <path d="M23 19L19 23L15 19" stroke="rgba(255,255,255,0.65)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M19 23V11" stroke="rgba(255,255,255,0.65)" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="font-bold text-primary">CONVETER</span>
            </div>
            <p className="text-xs text-muted-cv leading-relaxed mb-4">
              Convert. Create. Analyze. Simplify.
              Everything you need to work with files.
            </p>
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full bg-success-500 animate-pulse"
              />
              <span className="text-xs text-muted-cv">All systems operational</span>
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([section, links]) => (
            <div key={section}>
              <p className="text-xs font-semibold text-primary mb-3">{section}</p>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-xs text-muted-cv hover:text-primary transition-colors duration-150"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-10 pt-6 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          <p className="text-xs text-muted-cv">
            © {new Date().getFullYear()} CONVETER. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-cv">
            <a href="#" className="hover:text-primary transition-colors">Privacy</a>
            <a href="#" className="hover:text-primary transition-colors">Terms</a>
            <a href="#" className="hover:text-primary transition-colors">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

// ────────────────────────────────────────────────
// HOME PAGE
// ────────────────────────────────────────────────
export const HomePage: React.FC = () => {
  return (
    <main>
      <HeroSection />
      <CategoriesSection />
      <PopularToolsSection />
      <HowItWorksSection />
      <AISection />
      <NewToolsSection />
      <PrivacySection />
      <PremiumCTA />
      <Footer />
    </main>
  );
};

export default HomePage;
