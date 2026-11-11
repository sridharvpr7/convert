import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Zap, Shield, ArrowRight, HelpCircle, X, Info } from 'lucide-react';

interface PricingPlan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  popular?: boolean;
  color: string;
  features: { text: string; included: boolean; note?: string }[];
  cta: string;
  ctaHref: string;
}

const PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'For personal use and trying out the platform',
    monthlyPrice: 0,
    yearlyPrice: 0,
    color: '#64748b',
    cta: 'Get Started Free',
    ctaHref: '/register',
    features: [
      { text: 'Access to all offline tools', included: true },
      { text: 'PDF tools (basic)', included: true },
      { text: 'Image tools', included: true },
      { text: 'Developer tools', included: true },
      { text: 'Calculators', included: true },
      { text: 'Up to 10MB file size', included: true },
      { text: 'Up to 5 jobs/day', included: true },
      { text: 'Batch processing', included: false },
      { text: 'Advanced PDF conversion', included: false },
      { text: 'OCR processing', included: false },
      { text: 'AI tools', included: false },
      { text: 'Cloud storage', included: false },
      { text: 'Saved workflows', included: false },
      { text: 'Priority processing', included: false },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'For professionals and power users',
    monthlyPrice: 9,
    yearlyPrice: 79,
    popular: true,
    color: '#4A4AE8',
    cta: 'Start Free Trial',
    ctaHref: '/register?plan=premium',
    features: [
      { text: 'All Free features', included: true },
      { text: 'Up to 500MB file size', included: true },
      { text: 'Unlimited jobs', included: true },
      { text: 'Batch processing', included: true },
      { text: 'Advanced PDF conversion', included: true },
      { text: 'OCR processing', included: true },
      { text: 'AI tools (limited)', included: true, note: '50 operations/month' },
      { text: '5GB cloud storage', included: true },
      { text: 'Saved workflows (5)', included: true },
      { text: 'Priority processing', included: true },
      { text: 'File history (30 days)', included: true },
      { text: 'API access', included: false },
      { text: 'Team features', included: false },
      { text: 'Custom workflows', included: false },
    ],
  },
  {
    id: 'business',
    name: 'Business',
    description: 'For teams and organizations',
    monthlyPrice: 29,
    yearlyPrice: 249,
    color: '#7c3aed',
    cta: 'Contact Sales',
    ctaHref: '/contact',
    features: [
      { text: 'All Premium features', included: true },
      { text: 'Up to 2GB file size', included: true },
      { text: 'Unlimited everything', included: true },
      { text: 'AI tools (unlimited)', included: true },
      { text: '50GB cloud storage', included: true },
      { text: 'Unlimited saved workflows', included: true },
      { text: 'API access', included: true },
      { text: 'Team members (up to 10)', included: true },
      { text: 'Custom branding', included: true },
      { text: 'Priority support', included: true },
      { text: 'SLA guarantee', included: true },
      { text: 'Admin dashboard', included: true },
      { text: 'SAML SSO', included: false },
      { text: 'Custom contracts', included: false },
    ],
  },
];

const FAQ_ITEMS = [
  {
    q: 'Can I use CONVETER for free?',
    a: 'Yes! The Free plan gives you access to all offline tools, basic PDF and image tools, developer utilities, and calculators — with no credit card required.',
  },
  {
    q: 'What happens to my files after processing?',
    a: 'Files processed locally never leave your device. Cloud-processed files are automatically deleted from our servers after processing according to our retention policy (typically within 1 hour).',
  },
  {
    q: 'Can I cancel my subscription?',
    a: 'Yes, you can cancel anytime. Your access continues until the end of the current billing period.',
  },
  {
    q: 'Is there a free trial for Premium?',
    a: 'Yes, we offer a 7-day free trial for the Premium plan. No credit card required to start the trial.',
  },
  {
    q: 'What file size limits apply?',
    a: 'Free plan: up to 10MB per file. Premium: up to 500MB. Business: up to 2GB. Offline tools are not subject to size limits.',
  },
  {
    q: 'Do you offer refunds?',
    a: 'We offer a 30-day money-back guarantee for all paid plans if you are not satisfied.',
  },
];

export const PricingPage: React.FC = () => {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('yearly');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="pt-20 pb-16" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Header */}
      <div className="text-center py-12 px-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-6 text-sm"
          style={{ backgroundColor: 'var(--accent-subtle)', borderColor: 'var(--accent)', color: 'var(--accent)' }}
        >
          <Zap size={14} />
          Simple, Transparent Pricing
        </div>
        <h1 className="text-4xl font-bold mb-4">
          Choose the right plan for you
        </h1>
        <p className="text-secondary max-w-xl mx-auto">
          Start free. Upgrade when you need more power.
          All plans include access to offline tools.
        </p>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mt-8">
          <span className={`text-sm font-medium ${billing === 'monthly' ? 'text-primary' : 'text-muted-cv'}`}>Monthly</span>
          <button
            onClick={() => setBilling(billing === 'monthly' ? 'yearly' : 'monthly')}
            className="relative w-12 h-6 rounded-full transition-all duration-200"
            style={{ backgroundColor: billing === 'yearly' ? 'var(--accent)' : 'var(--muted)' }}
            aria-label="Toggle billing period"
          >
            <span
              className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200"
              style={{ transform: billing === 'yearly' ? 'translateX(24px)' : 'translateX(0)' }}
            />
          </button>
          <span className={`text-sm font-medium ${billing === 'yearly' ? 'text-primary' : 'text-muted-cv'}`}>
            Yearly
            <span
              className="ml-1.5 badge"
              style={{ backgroundColor: '#22c55e15', color: '#22c55e', fontSize: '10px' }}
            >
              Save 27%
            </span>
          </span>
        </div>
      </div>

      {/* Plans grid */}
      <div className="container-narrow">
        {/* Honest Demonstration Notice */}
        <div
          className="max-w-2xl mx-auto mb-10 p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed"
          style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}
        >
          <Info size={18} className="text-accent flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-primary mb-0.5">Demo Showcase Notice</p>
            <p className="text-secondary">
              All core local conversion tools in CONVETER are <strong>100% free and private</strong> with no account or payment required.
              The premium tiers and checkout flows shown below represent a planned subscription demonstration.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {PLANS.map((plan) => {
            const price = billing === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
            const period = billing === 'yearly' ? '/year' : '/month';

            return (
              <div
                key={plan.id}
                className="relative flex flex-col rounded-2xl border overflow-hidden"
                style={{
                  backgroundColor: 'var(--card)',
                  borderColor: plan.popular ? plan.color : 'var(--border)',
                  boxShadow: plan.popular ? `0 0 0 1px ${plan.color}` : 'none',
                }}
              >
                {plan.popular && (
                  <div
                    className="py-1.5 text-center text-xs font-semibold text-white"
                    style={{ backgroundColor: plan.color }}
                  >
                    MOST POPULAR
                  </div>
                )}

                <div className="p-6 flex-1">
                  {/* Plan header */}
                  <div className="mb-6">
                    <h2 className="text-xl font-bold text-primary mb-1">{plan.name}</h2>
                    <p className="text-xs text-muted-cv">{plan.description}</p>
                    <div className="flex items-end gap-1 mt-4">
                      {price === 0 ? (
                        <span className="text-4xl font-bold text-primary">Free</span>
                      ) : (
                        <>
                          <span className="text-4xl font-bold text-primary">${price}</span>
                          <span className="text-secondary mb-1 text-sm">{period}</span>
                        </>
                      )}
                    </div>
                    {billing === 'yearly' && price > 0 && (
                      <p className="text-xs text-muted-cv mt-1">
                        ${(plan.monthlyPrice * 12).toFixed(0)} if billed monthly
                      </p>
                    )}
                  </div>

                  {/* CTA */}
                  <Link
                    to={plan.ctaHref}
                    className={`btn-lg w-full justify-center mb-6 ${
                      plan.popular ? 'btn-primary' : 'btn-secondary'
                    }`}
                    style={plan.popular ? { backgroundColor: plan.color } : {}}
                  >
                    {plan.cta}
                    <ArrowRight size={16} />
                  </Link>

                  {/* Features */}
                  <ul className="space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f.text} className="flex items-start gap-2.5">
                        {f.included ? (
                          <Check size={14} style={{ color: plan.color, flexShrink: 0, marginTop: 2 }} />
                        ) : (
                          <X size={14} style={{ color: 'var(--text-disabled)', flexShrink: 0, marginTop: 2 }} />
                        )}
                        <span className={`text-xs leading-relaxed ${f.included ? 'text-secondary' : 'text-disabled'}`}>
                          {f.text}
                          {f.note && (
                            <span className="text-muted-cv ml-1">({f.note})</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* Trust strip */}
        <div
          className="flex flex-wrap items-center justify-center gap-8 py-8 px-6 rounded-2xl border mb-16"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        >
          {[
            { icon: <Shield size={18} />, text: '30-day money-back guarantee', color: '#22c55e' },
            { icon: <Zap size={18} />, text: 'Cancel anytime', color: '#5b6af8' },
            { icon: <Check size={18} />, text: 'No hidden fees', color: '#f59e0b' },
            { icon: <Shield size={18} />, text: 'Secure payments by Stripe', color: '#8b5cf6' },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-2.5">
              <span style={{ color: item.color }}>{item.icon}</span>
              <span className="text-sm font-medium text-secondary">{item.text}</span>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently asked questions</h2>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item, idx) => (
              <div
                key={idx}
                className="rounded-xl border overflow-hidden"
                style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                  aria-expanded={openFaq === idx}
                >
                  <span className="text-sm font-medium text-primary">{item.q}</span>
                  <HelpCircle
                    size={16}
                    className={`flex-shrink-0 ml-4 transition-transform duration-200 ${
                      openFaq === idx ? 'rotate-180' : ''
                    }`}
                    style={{ color: 'var(--text-muted)' }}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-4 border-t" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-sm text-secondary leading-relaxed pt-3">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
