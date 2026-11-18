import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomWorkService } from '../core/custom-work.service';
import { SeoService } from '../core/seo.service';

type LegalTab = 'about' | 'privacy' | 'terms' | 'refunds' | 'contact';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="legal-page">
      <header class="legal-hero">
        <div>
          <span class="eyebrow">Studio Policies & Verification</span>
          <h1>Transparent practices,<br><em>built on trust.</em></h1>
        </div>
        <p>
          sameulshajid.art is an independent digital graphic design studio and marketplace operated by Sameul Shajid.
          Below you will find our studio credentials, licensing rules, privacy commitments, and customer support policies.
        </p>
      </header>

      <nav class="legal-tabs" aria-label="Studio policies navigation">
        <button type="button" [class.active]="activeTab() === 'about'" (click)="selectTab('about')">About Studio</button>
        <button type="button" [class.active]="activeTab() === 'privacy'" (click)="selectTab('privacy')">Privacy Policy</button>
        <button type="button" [class.active]="activeTab() === 'terms'" (click)="selectTab('terms')">Terms & Licensing</button>
        <button type="button" [class.active]="activeTab() === 'refunds'" (click)="selectTab('refunds')">Delivery & Refunds</button>
        <button type="button" [class.active]="activeTab() === 'contact'" (click)="selectTab('contact')">Contact & Support</button>
      </nav>

      <div class="legal-grid">
        <aside class="legal-card">
          <span class="legal-badge">Verified Studio</span>
          <h2>sameulshajid.art</h2>
          <p>Independent graphic design studio specializing in posters, print-ready artwork, brand templates, and custom visual identity.</p>
          <dl class="legal-facts">
            <div><dt>Founder & Lead Designer</dt><dd>Sameul Shajid</dd></div>
            <div><dt>Website</dt><dd><a href="https://sameulshajid.art">https://sameulshajid.art</a></dd></div>
            <div><dt>Support Email</dt><dd><a href="mailto:support@sameulshajid.art">support&#64;sameulshajid.art</a></dd></div>
            <div><dt>Payment Security</dt><dd>Encrypted checkout via Stripe</dd></div>
            <div><dt>Fulfillment</dt><dd>Instant digital download & private client portal</dd></div>
          </dl>
          <div class="legal-card-actions">
            <a class="button secondary full" routerLink="/" fragment="shop">Browse Catalog</a>
            <button class="button primary full" type="button" (click)="customWork.openChat()">Message Designer</button>
          </div>
        </aside>

        <article class="legal-article">
          @switch (activeTab()) {
            @case ('about') {
              <section id="about">
                <span class="section-number">01 / STUDIO OVERVIEW</span>
                <h2>About sameulshajid.art</h2>
                <p>
                  <strong>sameulshajid.art</strong> (also known as <em>Sami’s Design</em>) is an independent graphic design studio founded by
                  <strong>Sameul Shajid</strong>. We create original digital posters, editorial templates, social media design systems, and
                  print-ready visual assets for brands, creators, events, and collectors worldwide.
                </p>
                <h3>What We Offer</h3>
                <ul>
                  <li><strong>Ready-Made Digital Artwork:</strong> High-resolution, production-ready files (AI, PSD, PDF, INDD, FIG, PNG, SVG, TIFF) inspected for 300 DPI print and crisp digital display.</li>
                  <li><strong>Custom Graphic Design:</strong> Tailored design commissions managed directly through our private project portal with transparent quotes and milestone reviews.</li>
                  <li><strong>Protected Originals:</strong> Public catalog previews are watermarked to protect intellectual property, while verified buyers receive unwatermarked master files immediately upon checkout.</li>
                </ul>
                <h3>Authenticity & Anti-Spam Commitment</h3>
                <p>
                  Every link and pin shared from <code>sameulshajid.art</code> leads directly to the corresponding original design or studio page.
                  We never use deceptive redirects, pop-up ads, affiliate cloaking, or third-party ad trackers.
                </p>
              </section>
            }

            @case ('privacy') {
              <section id="privacy">
                <span class="section-number">02 / PRIVACY POLICY</span>
                <h2>Privacy Policy</h2>
                <p><small>Last updated: November 2026</small></p>
                <p>
                  At <strong>sameulshajid.art</strong>, we respect your privacy and collect only the minimum personal information necessary to
                  deliver your purchased design files, manage custom design projects, and secure your account.
                </p>
                <h3>Information We Collect</h3>
                <ul>
                  <li><strong>Account Details:</strong> Your name, email address, and optional profile photo when you register or sign in via Google OAuth.</li>
                  <li><strong>Order & Transaction Metadata:</strong> Purchased items, order totals, and payment status. Full credit card or payment details are processed securely by Stripe and are never stored on our servers.</li>
                  <li><strong>Project Messages:</strong> Briefs, messages, and reference files you voluntarily upload when requesting custom graphic design work.</li>
                </ul>
                <h3>How We Use Your Information</h3>
                <ul>
                  <li>To authenticate your account and provide permanent access to your purchased digital downloads.</li>
                  <li>To send transactional emails (such as email verification codes, order receipts, and notifications when the designer replies to your project thread).</li>
                  <li>To prevent fraud, unauthorized hotlinking, and automated scraping of studio artwork.</li>
                </ul>
                <h3>Cookies & Third-Party Sharing</h3>
                <p>
                  We use essential first-party authentication tokens and security cookies required for sign-in and checkout. We do <strong>not</strong>
                  sell, rent, or trade your personal data to advertisers or data brokers. You may update or permanently delete your account at any time
                  from your <a routerLink="/profile">Account Settings</a> page.
                </p>
              </section>
            }

            @case ('terms') {
              <section id="terms">
                <span class="section-number">03 / TERMS OF SERVICE & LICENSING</span>
                <h2>Terms of Service & License Agreement</h2>
                <p><small>Last updated: November 2026</small></p>
                <p>
                  By accessing <strong>sameulshajid.art</strong> or purchasing any digital product or custom design service, you agree to the following terms:
                </p>
                <h3>1. Intellectual Property & Ownership</h3>
                <p>
                  All artwork, previews, typography layouts, and source files displayed on this website remain the copyrighted intellectual property of
                  <strong>Sameul Shajid (sameulshajid.art)</strong> unless explicitly transferred under a signed custom work agreement.
                </p>
                <h3>2. License Grants</h3>
                <ul>
                  <li><strong>Personal License:</strong> Permits use of the downloaded artwork for non-commercial personal prints, personal social media, or portfolio display.</li>
                  <li><strong>Commercial License:</strong> Permits use of the design in one (1) commercial end-product, client campaign, event promotion, or brand identity.</li>
                  <li><strong>Extended Commercial License:</strong> Permits unlimited commercial print runs, merchandise usage, and multi-channel brand deployment.</li>
                </ul>
                <h3>3. Prohibited Uses</h3>
                <p>
                  You may <strong>not</strong> resell, redistribute, sublicense, share public download links, or upload the standalone source files to stock marketplaces,
                  print-on-demand platforms as unmodified templates, or AI training datasets.
                </p>
              </section>
            }

            @case ('refunds') {
              <section id="refunds">
                <span class="section-number">04 / DELIVERY & REFUND POLICY</span>
                <h2>Digital Delivery & Refund Policy</h2>
                <h3>Instant Digital Delivery</h3>
                <p>
                  Once your payment is verified at checkout, your unwatermarked master files are unlocked immediately in your account order history and download page.
                </p>
                <h3>Refund Eligibility</h3>
                <p>
                  Because digital design files are delivered as instant, non-returnable master assets, completed downloads are generally non-refundable once the archive has been accessed. However, we stand behind the quality of our studio work and provide full resolution or refunds in the following cases:
                </p>
                <ul>
                  <li><strong>Corrupted or Defective Files:</strong> If any file in your download package is damaged, missing layers, or does not match the listed technical specifications, contact us and we will provide a corrected file or a 100% refund.</li>
                  <li><strong>Duplicate Purchases:</strong> Accidental duplicate orders of the same design are refunded in full upon request.</li>
                  <li><strong>Custom Design Projects:</strong> Custom work quotes are agreed upon before production starts. If a custom request is cancelled before design delivery begins, any deposit is eligible for refund.</li>
                </ul>
              </section>
            }

            @case ('contact') {
              <section id="contact">
                <span class="section-number">05 / CONTACT & SUPPORT</span>
                <h2>Get in Touch</h2>
                <p>
                  Have a question about file formats, commercial licensing, custom design commissions, or an existing order? Reach out directly and Sameul Shajid will respond promptly.
                </p>
                <div class="contact-cards">
                  <div>
                    <strong>Direct Studio Chat</strong>
                    <p>Start a real-time conversation with the designer right from your browser.</p>
                    <button class="button primary" type="button" (click)="customWork.openChat()">Open Studio Chat <span>→</span></button>
                  </div>
                  <div>
                    <strong>Email Support</strong>
                    <p>For order inquiries, licensing questions, or press & partnership requests:</p>
                    <a class="button secondary" href="mailto:support@sameulshajid.art">support&#64;sameulshajid.art</a>
                  </div>
                </div>
              </section>
            }
          }
        </article>
      </div>
    </section>
  `,
})
export class LegalComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly seo = inject(SeoService);
  readonly customWork = inject(CustomWorkService);

  readonly activeTab = signal<LegalTab>('about');

  ngOnInit(): void {
    this.route.data.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(data => {
      const routeSection = data['section'] as LegalTab | undefined;
      if (routeSection) {
        this.applyTab(routeSection);
      }
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const tab = params.get('tab') as LegalTab | null;
      if (tab && ['about', 'privacy', 'terms', 'refunds', 'contact'].includes(tab)) {
        this.applyTab(tab);
      }
    });
  }

  selectTab(tab: LegalTab): void {
    this.applyTab(tab);
  }

  private applyTab(tab: LegalTab): void {
    this.activeTab.set(tab);
    const metaByTab: Record<LegalTab, { title: string; description: string; path: string }> = {
      about: {
        title: 'About Studio — sameulshajid.art Independent Graphic Design Studio',
        description:
          'Learn about Sameul Shajid and the sameulshajid.art graphic design studio offering original posters, print-ready artwork, and custom visual design.',
        path: '/about',
      },
      privacy: {
        title: 'Privacy Policy — sameulshajid.art',
        description:
          'Read the sameulshajid.art Privacy Policy covering account security, encrypted payment processing, and customer data protection.',
        path: '/privacy',
      },
      terms: {
        title: 'Terms of Service & Licensing — sameulshajid.art',
        description:
          'Commercial and personal artwork licensing terms, intellectual property rights, and usage guidelines for sameulshajid.art.',
        path: '/terms',
      },
      refunds: {
        title: 'Digital Delivery & Refund Policy — sameulshajid.art',
        description:
          'Instant digital download details, quality guarantee, and refund eligibility for purchases on sameulshajid.art.',
        path: '/refunds',
      },
      contact: {
        title: 'Contact & Studio Support — sameulshajid.art',
        description:
          'Contact independent graphic designer Sameul Shajid for custom design commissions, licensing inquiries, or order support.',
        path: '/contact',
      },
    };
    const meta = metaByTab[tab];
    this.seo.update({
      title: meta.title,
      description: meta.description,
      path: meta.path,
      type: 'website',
    });
    this.seo.setJsonLd('product-json-ld', null);
  }
}
