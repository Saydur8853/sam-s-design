import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface StudioDashboard {
  products: number;
  published_products: number;
  active_projects: number;
  new_projects: number;
  unread_messages: number;
  paid_orders: number;
  recent_projects: Array<{ id: string; title: string; status: string; customer__email: string; updated_at: string; message_count: number }>;
}

export interface StudioProduct {
  id: number;
  title: string;
  slug: string;
  short_description: string;
  description: string;
  price: string;
  currency: string;
  product_type: string;
  license_type: string;
  preview_url: string;
  file_formats: string[];
  dimensions: string;
  resolution: string;
  color_mode: string;
  is_featured: boolean;
  is_active: boolean;
  category_id: number;
  category_name: string;
  download_files: Array<{ id: number; display_name: string; mime_type: string; file_size: number; is_active: boolean }>;
}

export interface StudioProductPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: StudioProduct[];
}

@Injectable({ providedIn: 'root' })
export class StudioService {
  private readonly http = inject(HttpClient);
  dashboard(): Observable<StudioDashboard> { return this.http.get<StudioDashboard>('/api/v1/studio/dashboard/'); }
  products(): Observable<StudioProduct[]> { return this.http.get<StudioProduct[]>('/api/v1/catalog/studio/products/'); }
  productsPage(page = 1, search = '', categoryId = ''): Observable<StudioProductPage> {
    let params = new HttpParams().set('page', page).set('page_size', 9);
    if (search.trim()) params = params.set('search', search.trim());
    if (categoryId) params = params.set('category', categoryId);
    return this.http.get<StudioProductPage>('/api/v1/catalog/studio/products/', { params });
  }
  createProduct(payload: FormData): Observable<StudioProduct> { return this.http.post<StudioProduct>('/api/v1/catalog/studio/products/', payload); }
  updateProduct(id: number, payload: FormData): Observable<StudioProduct> { return this.http.patch<StudioProduct>(`/api/v1/catalog/studio/products/${id}/`, payload); }
}
