import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
}

export interface Product {
  id: number;
  title: string;
  slug: string;
  short_description: string;
  description: string;
  price: string;
  currency: string;
  product_type_display: string;
  license_type_display: string;
  preview_url: string;
  file_formats: string[];
  dimensions: string;
  resolution: string;
  color_mode: string;
  is_featured: boolean;
  category: Category;
}

export interface ProductPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: Product[];
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);

  categories(): Observable<Category[]> {
    return this.http.get<Category[]>('/api/v1/catalog/categories/');
  }

  products(category = '', page = 1, search = ''): Observable<ProductPage> {
    let params = new HttpParams().set('page', page);
    if (category) params = params.set('category', category);
    if (search.trim()) params = params.set('search', search.trim());
    return this.http.get<ProductPage>('/api/v1/catalog/products/', { params });
  }

  collectionProducts(category: string, excludeSlug: string, page = 1, pageSize = 8): Observable<ProductPage> {
    const params = new HttpParams()
      .set('category', category)
      .set('exclude', excludeSlug)
      .set('page', page)
      .set('page_size', pageSize);
    return this.http.get<ProductPage>('/api/v1/catalog/products/', { params });
  }

  product(slug: string): Observable<Product> {
    return this.http.get<Product>(`/api/v1/catalog/products/${encodeURIComponent(slug)}/`);
  }
}

