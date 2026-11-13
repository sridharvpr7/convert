import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Compass,
  Wrench,
  UserCheck,
  ShieldCheck,
  Activity,
  Crown,
  HelpCircle,
  ChevronRight,
  ExternalLink,
  Search,
  CheckCircle,
  AlertTriangle,
  Lock,
} from 'lucide-react';

interface ManualSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  summary: string;
  content: React.ReactNode;
}

export const HelpPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState('getting-started');
  const [searchQuery, setSearchQuery] = useState('');

  const sections: ManualSection[] = [
    {
      id: 'getting-started',
      title: '1. Getting Started',
      icon: <Compass size={18} className="text-indigo-500" />,
      summary: 'Platform overview, navigation controls, and finding the right tool.',
      content: (
        <div className="space-y-4 text-secondary text-sm leading-relaxed">
          <p>
            <strong>CONVET PULSE</strong> is a modern, privacy-first web utility suite designed to convert, compress,
            edit, and format files entirely inside your browser.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-xl border bg-surface space-y-1" style={{ borderColor: 'var(--border)' }}>
              <span className="font-semibold text-primary text-xs uppercase tracking-wider">Fast Navigation</span>
              <p className="text-xs text-muted-cv">
                Press <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-2xs">Ctrl + K</kbd> (or <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-2xs">Cmd + K</kbd> on macOS) anywhere to open the instant Command Palette.
              </p>
            </div>
            <div className="p-3.5 rounded-xl border bg-surface space-y-1" style={{ borderColor: 'var(--border)' }}>
              <span className="font-semibold text-primary text-xs uppercase tracking-wider">Categorized Catalog</span>
              <p className="text-xs text-muted-cv">
                Tools are organized into 5 primary groups: PDF, Images, Data &amp; Spreadsheets, Utilities, and Archives.
              </p>
            </div>
          </div>
          <p>
            To get started, explore the complete directory at <Link to="/tools" className="text-accent underline font-medium">Browse All Tools</Link> or use the category filters on the home page.
          </p>
        </div>
      ),
    },
    {
      id: 'using-tools',
      title: '2. Using Tools & Conversions',
      icon: <Wrench size={18} className="text-amber-500" />,
      summary: 'Selecting operations, file uploads, parameter options, and downloading results.',
      content: (
        <div className="space-y-4 text-secondary text-sm leading-relaxed">
          <ol className="list-decimal pl-5 space-y-2.5">
            <li>
              <strong>Select a Tool:</strong> Choose an operation matching your workflow (e.g., Merge PDF, Image Converter, CSV to JSON).
            </li>
            <li>
              <strong>Upload Your Files:</strong> Drag and drop your source documents into the upload zone or click to select files from your file manager.
            </li>
            <li>
              <strong>Configure Parameters:</strong> Adjust tool-specific options (such as compression level, output image format, orientation, or sheet options).
            </li>
            <li>
              <strong>Execute Conversion:</strong> Click the primary conversion button. Your browser immediately executes the process in memory.
            </li>
            <li>
              <strong>Download Outputs:</strong> Download your finished file directly, or utilize the <strong>Download Center</strong> to preview and download batch archives.
            </li>
          </ol>
          <div className="p-3 rounded-xl border bg-surface flex items-start gap-2.5 text-xs" style={{ borderColor: 'var(--border)' }}>
            <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-primary">Error Handling &amp; Retries</p>
              <p className="text-muted-cv">If a file fails to process due to corrupt formatting or unsupported encryption, the system will highlight the exact issue and permit an immediate retry without reloading the page.</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'authentication',
      title: '3. Account & Authentication',
      icon: <UserCheck size={18} className="text-emerald-500" />,
      summary: 'Google sign-in, email authentication, session security, and account management.',
      content: (
        <div className="space-y-4 text-secondary text-sm leading-relaxed">
          <p>
            CONVET PULSE supports both anonymous community usage and authenticated cloud accounts via Firebase Authentication.
          </p>
          <div className="space-y-2.5">
            <div className="p-3 rounded-xl border bg-surface" style={{ borderColor: 'var(--border)' }}>
              <p className="font-semibold text-primary text-xs">Google One-Click Sign-In</p>
              <p className="text-xs text-muted-cv mt-0.5">Quickly sign in with your verified Google account using secure OAuth2 popup authorization.</p>
            </div>
            <div className="p-3 rounded-xl border bg-surface" style={{ borderColor: 'var(--border)' }}>
              <p className="font-semibold text-primary text-xs">Email &amp; Password</p>
              <p className="text-xs text-muted-cv mt-0.5">Create a dedicated account with password-based authentication and self-service password reset.</p>
            </div>
          </div>
          <div className="text-xs text-muted-cv space-y-1 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
            <p><strong>Authentication Troubleshooting:</strong></p>
            <p>• If sign-in fails, ensure your browser allows third-party authentication popups and cookies.</p>
            <p>• Verify that your internet connection is active and that your email address is correctly spelled.</p>
          </div>
        </div>
      ),
    },
    {
      id: 'privacy-processing',
      title: '4. Privacy & File Processing Architecture',
      icon: <ShieldCheck size={18} className="text-purple-500" />,
      summary: 'Truthful technical breakdown of client-side execution and zero file-storage guarantees.',
      content: (
        <div className="space-y-4 text-secondary text-sm leading-relaxed">
          <div className="p-4 rounded-xl border bg-surface space-y-2" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 text-primary font-semibold text-xs">
              <Lock size={15} className="text-accent" />
              100% Client-Side In-Memory Execution
            </div>
            <p className="text-xs text-muted-cv leading-relaxed">
              Every one of the 17 core conversion tools in CONVET PULSE operates exclusively within your local browser sandbox utilizing standard Web APIs:
            </p>
            <ul className="text-xs text-muted-cv list-disc pl-5 space-y-1">
              <li><strong>PDF Tools:</strong> Processed locally using <code>pdf-lib</code> WebAssembly and JavaScript buffer engines.</li>
              <li><strong>Image Tools:</strong> Rendered, resized, and converted locally using the browser's hardware-accelerated HTML5 Canvas API.</li>
              <li><strong>Data Tools:</strong> Parsed and assembled locally via <code>xlsx</code> and <code>PapaParse</code>.</li>
              <li><strong>Archives:</strong> Packaged into compressed <code>.zip</code> containers locally via <code>JSZip</code>.</li>
            </ul>
          </div>
          <div className="p-3.5 rounded-xl border bg-surface text-xs space-y-1.5" style={{ borderColor: 'var(--border)' }}>
            <p className="font-semibold text-primary">What the Server Records vs. What It Never Sees</p>
            <p className="text-muted-cv">
              <strong>Never Uploaded:</strong> The actual binary data or text contents of your files are never transmitted to our backend servers.
            </p>
            <p className="text-muted-cv">
              <strong>Metadata Logged:</strong> The backend server only logs operational telemetry (file name, file size in bytes, duration in milliseconds, and status) for platform reliability and real-time usage metrics.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'usage-tracking',
      title: '5. Usage Tracking & Counting Policy',
      icon: <Activity size={18} className="text-blue-500" />,
      summary: 'Accurate usage counting criteria, idempotency, and browser-only telemetry limitations.',
      content: (
        <div className="space-y-4 text-secondary text-sm leading-relaxed">
          <p>
            CONVET PULSE enforces strict real-data integrity. We never fabricate user counts, simulate conversions, or use dummy statistics.
          </p>
          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <CheckCircle size={15} className="text-success-500 flex-shrink-0 mt-0.5" />
              <p><strong>Increment Condition:</strong> A conversion counts toward your usage only when an operation successfully finishes and produces a verified output file.</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle size={15} className="text-success-500 flex-shrink-0 mt-0.5" />
              <p><strong>Idempotency:</strong> Duplicate callbacks, browser page refreshes, and retried identical requests will never increment counts multiple times.</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle size={15} className="text-success-500 flex-shrink-0 mt-0.5" />
              <p><strong>Browser-Only Limitation:</strong> Because processing occurs client-side, the server trusts completion telemetry reported by the client with signed job tokens.</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'premium-membership',
      title: '6. Premium Membership & Payments',
      icon: <Crown size={18} className="text-amber-500" />,
      summary: 'Tier differences, transparent pricing, Razorpay checkout, and verification lifecycle.',
      content: (
        <div className="space-y-4 text-secondary text-sm leading-relaxed">
          <p>
            CONVET PULSE offers a transparent pricing model. All core client-side tools remain free for everyday usage.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 rounded-xl border bg-surface space-y-1.5" style={{ borderColor: 'var(--border)' }}>
              <span className="badge badge-neutral text-2xs font-semibold">Free Starter</span>
              <p className="text-xs font-bold text-primary">₹0 / month</p>
              <p className="text-xs text-muted-cv">Full access to client-side offline conversion tools, PDF and image utilities up to standard file size limits.</p>
            </div>
            <div className="p-3.5 rounded-xl border bg-surface space-y-1.5" style={{ borderColor: 'var(--border)' }}>
              <span className="badge badge-brand text-2xs font-semibold">Premium Pro</span>
              <p className="text-xs font-bold text-primary">Configured Server Rate</p>
              <p className="text-xs text-muted-cv">High-volume multi-file batch operations, expanded file limits, and advanced pipeline workflows.</p>
            </div>
          </div>
          <div className="p-3 rounded-xl border bg-surface text-xs space-y-1" style={{ borderColor: 'var(--border)' }}>
            <p className="font-semibold text-primary">Checkout &amp; Verification Details</p>
            <p className="text-muted-cv">
              Payments are processed using our secure, server-verified <strong>Razorpay</strong> integration. Entitlements are activated immediately following cryptographic signature validation. If checkout is cancelled or fails, no charges occur and your tier remains unchanged.
            </p>
          </div>
          <p className="pt-1">
            View plans and active rates at our <Link to="/pricing" className="text-accent underline font-medium">Pricing Page</Link>.
          </p>
        </div>
      ),
    },
    {
      id: 'troubleshooting',
      title: '7. Troubleshooting & FAQ',
      icon: <HelpCircle size={18} className="text-rose-500" />,
      summary: 'Solutions to common browser issues, file compatibility, and system alerts.',
      content: (
        <div className="space-y-4 text-secondary text-sm leading-relaxed">
          <div className="space-y-3">
            <div className="p-3 rounded-xl border bg-surface space-y-1" style={{ borderColor: 'var(--border)' }}>
              <p className="font-semibold text-primary text-xs">Browser Memory Limits with Large Files</p>
              <p className="text-xs text-muted-cv">
                Because files are processed directly in browser memory, files exceeding 300MB–500MB may exhaust available browser tab heap memory on low-RAM devices. If a tab reloads, try splitting or compressing in smaller batches.
              </p>
            </div>
            <div className="p-3 rounded-xl border bg-surface space-y-1" style={{ borderColor: 'var(--border)' }}>
              <p className="font-semibold text-primary text-xs">Encrypted or Password-Protected Documents</p>
              <p className="text-xs text-muted-cv">
                Password-protected PDF documents require decryption prior to merging or page splitting. Unlock your file before loading it into CONVET PULSE.
              </p>
            </div>
            <div className="p-3 rounded-xl border bg-surface space-y-1" style={{ borderColor: 'var(--border)' }}>
              <p className="font-semibold text-primary text-xs">Offline Availability</p>
              <p className="text-xs text-muted-cv">
                Once loaded, client-side tools continue to process files even if your internet connection is momentarily interrupted.
              </p>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const filteredSections = searchQuery.trim()
    ? sections.filter(
        (s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.summary.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sections;

  return (
    <div className="pt-20 pb-16 min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Header Banner */}
      <div className="border-b" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="container-app py-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border mb-4 text-xs font-semibold text-accent" style={{ borderColor: 'var(--border)' }}>
              <BookOpen size={14} /> Documentation &amp; User Guide
            </div>
            <h1 className="text-3xl font-extrabold text-primary tracking-tight">
              CONVET PULSE User Manual &amp; Knowledge Base
            </h1>
            <p className="text-sm text-secondary mt-2 leading-relaxed">
              Complete guide to browser-based file conversion, privacy guarantees, usage metrics, and account management.
            </p>

            {/* Search Input */}
            <div className="relative mt-6 max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-cv" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search manual topics (e.g. PDF, privacy, checkout)..."
                className="input w-full pl-10 pr-4 h-10 text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="container-app py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Table of contents sidebar */}
          <aside className="lg:col-span-4 sticky top-24 space-y-1.5 p-4 rounded-2xl border bg-surface" style={{ borderColor: 'var(--border)' }}>
            <span className="text-2xs font-bold uppercase tracking-wider text-muted-cv px-3 mb-2 block">
              Manual Contents
            </span>
            {filteredSections.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs font-medium transition-all ${
                  activeSection === s.id
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-secondary hover:bg-hover-cv hover:text-primary'
                }`}
                style={activeSection === s.id ? { backgroundColor: 'var(--accent)', color: '#ffffff' } : {}}
              >
                <div className="flex items-center gap-2.5 truncate">
                  {s.icon}
                  <span className="truncate">{s.title}</span>
                </div>
                <ChevronRight size={14} className="opacity-70 flex-shrink-0" />
              </button>
            ))}

            <div className="pt-4 mt-4 border-t border-dashed space-y-2" style={{ borderColor: 'var(--border)' }}>
              <Link
                to="/tools"
                className="flex items-center justify-between p-2 text-xs text-muted-cv hover:text-accent font-medium transition-colors"
              >
                <span>Browse All 17 Tools</span>
                <ExternalLink size={13} />
              </Link>
              <Link
                to="/pricing"
                className="flex items-center justify-between p-2 text-xs text-muted-cv hover:text-accent font-medium transition-colors"
              >
                <span>Pricing &amp; Plans</span>
                <ExternalLink size={13} />
              </Link>
            </div>
          </aside>

          {/* Section Detail Reader */}
          <section className="lg:col-span-8 space-y-8">
            {filteredSections.map((section) => (
              <article
                key={section.id}
                id={section.id}
                className="p-6 sm:p-8 rounded-2xl border shadow-sm transition-all"
                style={{
                  backgroundColor: 'var(--card)',
                  borderColor: activeSection === section.id ? 'var(--accent)' : 'var(--border)',
                }}
              >
                <div className="flex items-center gap-3 mb-3 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
                  <div className="p-2 rounded-xl bg-surface border" style={{ borderColor: 'var(--border)' }}>
                    {section.icon}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-primary">{section.title}</h2>
                    <p className="text-xs text-muted-cv mt-0.5">{section.summary}</p>
                  </div>
                </div>

                <div className="pt-2">{section.content}</div>
              </article>
            ))}

            {filteredSections.length === 0 && (
              <div className="p-12 text-center rounded-2xl border bg-surface" style={{ borderColor: 'var(--border)' }}>
                <p className="text-sm font-semibold text-primary">No manual sections match your search</p>
                <p className="text-xs text-muted-cv mt-1">Try searching for keywords like "pdf", "privacy", or "login".</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default HelpPage;

