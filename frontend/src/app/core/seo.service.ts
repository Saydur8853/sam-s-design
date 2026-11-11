import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export interface PageSeoConfig {
  title: string;
  description: string;
  path?: string;
  image?: string;
  type?: 'website' | 'product' | 'article';
  robots?: string;
  priceAmount?: string;
  priceCurrency?: string;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  private readonly siteOrigin = 'https://sameulshajid.art';
  private readonly defaultImage = `${this.siteOrigin}/brand/samis-design-logo.jpg`;

  update(config: PageSeoConfig): void {
    const cleanPath = config.path ? (config.path.startsWith('/') ? config.path : `/${config.path}`) : '/';
    const canonicalUrl = `${this.siteOrigin}${cleanPath}`;
    const imageUrl = this.resolveAbsoluteUrl(config.image) || this.defaultImage;
    const ogType = config.type || 'website';
    const robots = config.robots || 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

    this.title.setTitle(config.title);
    this.meta.updateTag({ name: 'description', content: config.description });
    this.meta.updateTag({ name: 'robots', content: robots });

    this.meta.updateTag({ property: 'og:type', content: ogType });
    this.meta.updateTag({ property: 'og:site_name', content: 'sameulshajid.art' });
    this.meta.updateTag({ property: 'og:title', content: config.title });
    this.meta.updateTag({ property: 'og:description', content: config.description });
    this.meta.updateTag({ property: 'og:url', content: canonicalUrl });
    this.meta.updateTag({ property: 'og:image', content: imageUrl });
    this.meta.updateTag({ property: 'og:image:secure_url', content: imageUrl });
    this.meta.updateTag({ property: 'og:image:alt', content: config.title });

    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: config.title });
    this.meta.updateTag({ name: 'twitter:description', content: config.description });
    this.meta.updateTag({ name: 'twitter:image', content: imageUrl });

    if (config.priceAmount && config.priceCurrency) {
      this.meta.updateTag({ property: 'product:price:amount', content: config.priceAmount });
      this.meta.updateTag({ property: 'product:price:currency', content: config.priceCurrency });
      this.meta.updateTag({ property: 'og:availability', content: 'instock' });
    } else {
      this.meta.removeTag("property='product:price:amount'");
      this.meta.removeTag("property='product:price:currency'");
      this.meta.removeTag("property='og:availability'");
    }

    this.setCanonical(canonicalUrl);
  }

  setJsonLd(id: string, data: Record<string, unknown> | null): void {
    const existing = this.document.getElementById(id);
    if (!data) {
      existing?.remove();
      return;
    }

    const script = (existing as HTMLScriptElement | null) ?? this.document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    if (!existing) {
      this.document.head.appendChild(script);
    }
  }

  resolveAbsoluteUrl(url?: string): string {
    if (!url) return this.defaultImage;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${this.siteOrigin}${url.startsWith('/') ? url : `/${url}`}`;
  }

  private setCanonical(url: string): void {
    let link = this.document.querySelector<HTMLLinkElement>("link[rel='canonical']");
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
