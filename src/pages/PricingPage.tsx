import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Zap, Shield, ArrowRight, HelpCircle, X, Info, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { apiClient, PublicPremiumConfig, PaymentConfig } from '@/lib/api';
import { useAppStore } from '@/store/app.store';

interface PricingPlan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currencySymbol: string;
  popular?: boolean;
  color: string;
  features: { text: string; included: boolean; note?: string }[];
  cta: string;
  ctaHref?: string;
}

const FAQ_ITEMS = [
  {
    q: 'Can I use CONVET PULSE for free?',
    a: 'Yes! The Free tier gives you full access to all client-side offline conversion tools, PDF and image utilities, developer formats, and calculators — completely free with zero file uploads to servers.',
  },
  {
    q: 'What happens to my files after processing?',
    a: 'Files processed locally never leave your device. All conversions execute 100% inside your browser using client-side libraries. No file contents are uploaded, saved, or inspected on any server.',
  },
  {
    q: 'How does the Premium upgrade work?',
    a: 'Premium unlocks batch file processing, priority processing speed, larger file capacity, and advanced format support as configured by the system administrator.',
  },
  {
    q: 'What payment methods are supported?',
    a: 'We support secure payment processing powered by Razorpay (UPI, Credit/Debit cards, Net Banking, and Wallets) with server-side HMAC SHA256 cryptographic signature verification.',
  },
  {
    q: 'What file size limits apply?',
    a: 'Free tools operate with generous local client-side memory limits (up to 50MB+). Premium tier supports high-volume batches and extended file sizes up to 500MB+.',
  },
  {
    q: 'Is there a money-back guarantee?',
    a: 'Yes, all paid subscriptions include an unconditional 30-day money-back guarantee.',
  },
];

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, setUser, addNotification } = useAppStore();

  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [premiumConfig, setPremiumConfig] = useState<PublicPremiumConfig | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [, setLoading] = useState(true);

  // Checkout states
  const [checkoutStatus, setCheckoutStatus] = useState<
    'idle' | 'creating' | 'open' | 'verifying' | 'success' | 'error'
  >('idle');
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiClient.getPublicPremiumConfig().then((cfg) => {
        if (cfg) setPremiumConfig(cfg);
      }),
      apiClient.getPaymentConfig().then((pcfg) => {
        if (pcfg) setPaymentConfig(pcfg);
      }),
    ]).finally(() => setLoading(false));
  }, []);

  const isPremiumEnabled = premiumConfig?.enabled ?? true;
  const priceAmount = premiumConfig?.price?.amount ?? 199;
  const currencyCode = premiumConfig?.price?.currency || 'INR';
  const currencySymbol = currencyCode === 'INR' ? '₹' : currencyCode === 'EUR' ? '€' : currencyCode === 'GBP' ? '£' : '$';
  const priceLabel = premiumConfig?.price?.label || `${currencySymbol}${priceAmount}/month`;

  const yearlyDiscountPrice = Math.round(priceAmount * 10); // 10 months for 12 months

  const isUserPremium = user?.plan === 'premium';

  const handleSubscribeClick = async (planId: string) => {
    if (planId === 'free') {
      navigate('/tools');
      return;
    }
    if (planId === 'business') {
      navigate('/help#getting-started');
      return;
    }

    // Must be logged in to subscribe
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent('/pricing?plan=premium')}`);
      return;
    }

    if (isUserPremium) {
      setCheckoutStatus('success');
      setCheckoutMessage('You are already subscribed to Premium Pro! All premium features are unlocked.');
      return;
    }

    // Verify payment gateway is configured on backend
    if (!paymentConfig || !paymentConfig.enabled || !paymentConfig.keyId) {
      setCheckoutStatus('error');
      setCheckoutMessage(
        'Payment Gateway Notice: Razorpay payment gateway credentials are not yet configured on the production server. Please contact the administrator or check back soon.'
      );
      return;
    }

    setActivePlanId(planId);
    setCheckoutStatus('creating');
    setCheckoutMessage('Initializing secure order with Razorpay...');

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setCheckoutStatus('error');
        setCheckoutMessage('Unable to load Razorpay checkout script. Please check your network connection.');
        return;
      }

      // Create order via backend endpoint
      const orderRes = await apiClient.createPaymentOrder(user.id, user.email, planId);
      if (!orderRes.success || !orderRes.orderId) {
        setCheckoutStatus('error');
        setCheckoutMessage(orderRes.error || 'Failed to create payment order. Please try again.');
        return;
      }

      setCheckoutStatus('open');
      setCheckoutMessage('Checkout window opened. Please complete your payment in the Razorpay popup.');

      const RazorpayConstructor = (window as unknown as { Razorpay: new (opts: unknown) => { open: () => void } }).Razorpay;
      const rzp = new RazorpayConstructor({
        key: orderRes.keyId || paymentConfig.keyId,
        amount: orderRes.amount,
        currency: orderRes.currency,
        name: 'CONVET PULSE',
        description: 'Premium Pro Subscription',
        order_id: orderRes.orderId,
        prefill: {
          name: user.name || '',
          email: user.email || '',
        },
        theme: {
          color: '#5b6af8',
        },
        modal: {
          ondismiss: () => {
            setCheckoutStatus('idle');
            setCheckoutMessage(null);
          },
        },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          setCheckoutStatus('verifying');
          setCheckoutMessage('Cryptographically verifying payment signature with server...');

          try {
            const verifyRes = await apiClient.verifyPayment({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              userId: user.id,
            });

            if (verifyRes.success) {
              setCheckoutStatus('success');
              setCheckoutMessage('Payment successfully verified! Your account has been upgraded to Premium Pro.');
              setUser({ ...user, plan: 'premium' });
              addNotification({
                title: 'Premium Activated',
                desc: 'Your Premium Pro subscription has been verified successfully.',
                type: 'success',
              });
            } else {
              setCheckoutStatus('error');
              setCheckoutMessage(verifyRes.error || 'Payment signature verification failed. Please contact support.');
            }
          } catch (err: unknown) {
            setCheckoutStatus('error');
            setCheckoutMessage((err as Error)?.message || 'Verification request failed. Please contact support.');
          }
        },
      });

      rzp.open();
    } catch (err: unknown) {
      setCheckoutStatus('error');
      setCheckoutMessage((err as Error)?.message || 'An unexpected error occurred while initiating checkout.');
    }
  };

  const plans: PricingPlan[] = [
    {
      id: 'free',
      name: 'Free Starter',
      description: 'Ideal for everyday document and image conversion',
      monthlyPrice: 0,
      yearlyPrice: 0,
      currencySymbol,
      color: '#64748b',
      cta: 'Start Free Conversion',
      ctaHref: '/tools',
      features: [
        { text: 'Access to all 17 client-side tools', included: true },
        { text: 'PDF tools (Merge, Split, Rotate)', included: true },
        { text: 'Image tools (JPG, PNG, WebP)', included: true },
        { text: 'Data tools (CSV, JSON, Excel)', included: true },
        { text: 'QR Code Generator & Archives', included: true },
        { text: '100% Client-side privacy & zero file uploads', included: true },
        { text: 'Up to 25MB file size', included: true },
        { text: 'Batch conversion', included: false },
        { text: 'Priority processing speed', included: false },
        { text: 'High-volume file support', included: false },
        { text: 'Ad-free experience', included: false },
      ],
    },
    {
      id: 'premium',
      name: 'Premium Pro',
      description: 'For professionals requiring batch and high-capacity processing',
      monthlyPrice: priceAmount,
      yearlyPrice: yearlyDiscountPrice,
      currencySymbol,
      popular: true,
      color: '#5b6af8',
      cta: isUserPremium
        ? 'Active Plan'
        : isPremiumEnabled
        ? 'Subscribe to Premium'
        : 'Currently Included in Free',
      features: [
        { text: 'Everything in Free Starter', included: true },
        { text: 'High-volume files (up to 500MB)', included: true },
        { text: 'Batch multi-file conversion', included: Boolean(premiumConfig?.features?.batchConversion ?? true) },
        { text: 'Advanced format processors', included: Boolean(premiumConfig?.features?.advancedTools ?? true) },
        { text: 'Priority server queue processing', included: Boolean(premiumConfig?.features?.priorityProcessing ?? true) },
        { text: 'Unlimited daily conversions', included: Boolean(premiumConfig?.features?.unlimitedConversions ?? false), note: 'Subject to fair use' },
        { text: 'Ad-free workspace', included: Boolean(premiumConfig?.features?.noAds ?? true) },
        { text: 'Custom workflow pipeline builder', included: true },
      ],
    },
    {
      id: 'business',
      name: 'Enterprise / Team',
      description: 'Dedicated infrastructure for organizations with custom requirements',
      monthlyPrice: priceAmount * 4,
      yearlyPrice: yearlyDiscountPrice * 4,
      currencySymbol,
      color: '#7c3aed',
      cta: 'Contact Support',
      ctaHref: '/help#getting-started',
      features: [
        { text: 'All Premium Pro features', included: true },
        { text: 'Up to 2GB file size limit', included: true },
        { text: 'Dedicated processing capacity', included: true },
        { text: 'Team member collaboration', included: true },
        { text: 'API integration token', included: true },
        { text: 'Custom branding & SLA guarantee', included: true },
      ],
    },
  ];

  return (
    <div className="pt-20 pb-16 min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Header */}
      <div className="text-center py-12 px-6">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-6 text-sm"
          style={{ backgroundColor: 'var(--accent-subtle)', borderColor: 'var(--accent)', color: 'var(--accent)' }}
        >
          <Zap size={14} className="fill-current" />
          Simple, Transparent Pricing
        </div>
        <h1 className="text-4xl font-extrabold mb-4 tracking-tight">
          Choose the right plan for your file workflows
        </h1>
        <p className="text-secondary max-w-xl mx-auto text-sm leading-relaxed">
          Start free with 100% client-side privacy. Upgrade to Premium Pro for batch processing and extended capacity.
        </p>

        {/* Global status notice if premium is disabled */}
        {!isPremiumEnabled && (
          <div className="max-w-xl mx-auto mt-6 p-3 rounded-xl border bg-success-500/10 border-success-500/30 text-success-600 text-xs font-medium flex items-center justify-center gap-2">
            <CheckCircle2 size={16} />
            <span>All tools are currently 100% free with no restrictions!</span>
          </div>
        )}

        {/* Billing toggle */}
        {isPremiumEnabled && (
          <div className="flex items-center justify-center gap-3 mt-8">
            <span className={`text-sm font-medium ${billing === 'monthly' ? 'text-primary' : 'text-muted-cv'}`}>
              Monthly
            </span>
            <button
              type="button"
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
                Save 17%
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Plans grid */}
      <div className="container-narrow">
        {/* Checkout feedback banner */}
        {checkoutStatus !== 'idle' && checkoutMessage && (
          <div
            className={`max-w-2xl mx-auto mb-8 p-4 rounded-xl border flex items-start gap-3 text-sm leading-relaxed ${
              checkoutStatus === 'success'
                ? 'bg-success-500/10 border-success-500/30 text-success-600'
                : checkoutStatus === 'error'
                ? 'bg-red-500/10 border-red-500/30 text-red-600'
                : 'bg-accent/10 border-accent/30 text-primary'
            }`}
          >
            {checkoutStatus === 'success' ? (
              <CheckCircle2 size={20} className="flex-shrink-0 mt-0.5" />
            ) : checkoutStatus === 'error' ? (
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            ) : (
              <Loader2 size={20} className="flex-shrink-0 mt-0.5 animate-spin" />
            )}
            <div className="flex-1">
              <p className="font-semibold mb-0.5">
                {checkoutStatus === 'success'
                  ? 'Payment Confirmed'
                  : checkoutStatus === 'error'
                  ? 'Payment Notice'
                  : 'Processing'}
              </p>
              <p className="text-xs">{checkoutMessage}</p>
            </div>
            <button
              onClick={() => {
                setCheckoutStatus('idle');
                setCheckoutMessage(null);
              }}
              className="p-1 rounded hover:bg-black/10 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Honest Demonstration Notice */}
        <div
          className="max-w-2xl mx-auto mb-10 p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed"
          style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}
        >
          <Info size={18} className="text-accent flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-primary mb-0.5">Payment Integration & Verification Status</p>
            <p className="text-secondary">
              All 17 conversion tools in CONVET PULSE are <strong>100% free and functional</strong> in your browser with zero file uploads.
              Premium subscriptions are handled through an authenticated Razorpay checkout with cryptographically verified HMAC signatures.
              Active rate: {priceLabel}.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {plans.map((plan) => {
            const price = billing === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
            const period = billing === 'yearly' ? '/year' : '/month';
            const isHighlighted = plan.popular || searchParams.get('plan') === plan.id;

            return (
              <div
                key={plan.id}
                className="relative flex flex-col rounded-2xl border overflow-hidden transition-all duration-200"
                style={{
                  backgroundColor: 'var(--card)',
                  borderColor: isHighlighted ? plan.color : 'var(--border)',
                  boxShadow: isHighlighted ? `0 0 0 1px ${plan.color}, 0 8px 30px rgba(0,0,0,0.06)` : 'var(--shadow-sm)',
                }}
              >
                {plan.popular && (
                  <div
                    className="py-1.5 text-center text-xs font-semibold text-white tracking-wider uppercase"
                    style={{ backgroundColor: plan.color }}
                  >
                    Recommended
                  </div>
                )}

                <div className="p-6 flex-1 flex flex-col justify-between">
                  {/* Plan header */}
                  <div className="mb-6">
                    <h2 className="text-xl font-bold text-primary mb-1">{plan.name}</h2>
                    <p className="text-xs text-muted-cv leading-relaxed min-h-[32px]">{plan.description}</p>
                    <div className="flex items-end gap-1 mt-4">
                      {price === 0 ? (
                        <span className="text-4xl font-extrabold text-primary">Free</span>
                      ) : (
                        <>
                          <span className="text-4xl font-extrabold text-primary font-num">
                            {currencySymbol}{price}
                          </span>
                          <span className="text-secondary mb-1 text-sm font-medium">{period}</span>
                        </>
                      )}
                    </div>
                    {billing === 'yearly' && price > 0 && (
                      <p className="text-2xs text-muted-cv mt-1">
                        Billed annually (includes 2 months free)
                      </p>
                    )}
                  </div>

                  {/* CTA Button */}
                  {plan.id === 'free' ? (
                    <Link
                      to={plan.ctaHref || '/tools'}
                      className="btn-lg w-full justify-center mb-6 text-xs font-semibold gap-2 btn-secondary"
                    >
                      {plan.cta}
                      <ArrowRight size={14} />
                    </Link>
                  ) : plan.id === 'business' ? (
                    <Link
                      to={plan.ctaHref || '/help'}
                      className="btn-lg w-full justify-center mb-6 text-xs font-semibold gap-2 btn-secondary"
                    >
                      {plan.cta}
                      <ArrowRight size={14} />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled={isUserPremium || (checkoutStatus === 'creating' && activePlanId === plan.id)}
                      onClick={() => handleSubscribeClick(plan.id)}
                      className={`btn-lg w-full justify-center mb-6 text-xs font-semibold gap-2 ${
                        isUserPremium
                          ? 'bg-success-600 text-white cursor-default'
                          : plan.popular
                          ? 'btn-primary'
                          : 'btn-secondary'
                      }`}
                      style={plan.popular && !isUserPremium ? { backgroundColor: plan.color } : {}}
                    >
                      {checkoutStatus === 'creating' && activePlanId === plan.id ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Preparing Checkout...</span>
                        </>
                      ) : (
                        <>
                          <span>{plan.cta}</span>
                          {!isUserPremium && <ArrowRight size={14} />}
                        </>
                      )}
                    </button>
                  )}

                  {/* Features */}
                  <ul className="space-y-2.5 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
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
            { icon: <Shield size={18} />, text: '100% Client-Side Privacy', color: '#22c55e' },
            { icon: <Zap size={18} />, text: 'Zero File Tracking', color: '#5b6af8' },
            { icon: <Check size={18} />, text: 'Offline PWA Support', color: '#f59e0b' },
            { icon: <Shield size={18} />, text: 'HMAC Cryptographic Verification', color: '#8b5cf6' },
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
                  type="button"
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
