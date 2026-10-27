import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize, interval, switchMap } from 'rxjs';
import { Category, CatalogService } from '../core/catalog.service';
import { CustomRequest, CustomWorkService, MessageAttachment, PortalMessage } from '../core/custom-work.service';
import { StudioDashboard, StudioProduct, StudioService } from '../core/studio.service';

type StudioView = 'dashboard' | 'products' | 'inbox';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, CurrencyPipe],
  template: `
    <section class="studio-shell">
      <aside class="studio-sidebar">
        <div><span class="eyebrow">Designer workspace</span><h1>Studio.</h1><p>Manage artwork, projects and customer conversations.</p></div>
        <nav aria-label="Studio navigation">
          <button type="button" [class.active]="view() === 'dashboard'" (click)="open('dashboard')"><span>01</span> Overview</button>
          <button type="button" [class.active]="view() === 'products'" (click)="open('products')"><span>02</span> Products</button>
          <button type="button" [class.active]="view() === 'inbox'" (click)="open('inbox')"><span>03</span> Inbox @if (dashboard()?.unread_messages) { <b>{{ dashboard()?.unread_messages }}</b> }</button>
        </nav>
      </aside>

      <div class="studio-content">
        @if (notice()) { <p class="studio-notice" role="status">{{ notice() }}</p> }
        @if (view() === 'dashboard') {
          <header class="studio-heading">
            <div><span>Overview</span><h2>Good work starts<br>with a clear desk.</h2></div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <button class="button secondary" type="button" [disabled]="downloadingBackup()" (click)="downloadDbBackup()">
                {{ downloadingBackup() ? 'Preparing backup…' : 'Download DB Backup ↓' }}
              </button>
              <button class="button primary" type="button" (click)="startProduct()">+ Add artwork</button>
            </div>
          </header>
          @if (dashboard(); as stats) {
            <div class="studio-stats">
              <article><span>Published artwork</span><strong>{{ stats.published_products }}</strong><small>{{ stats.products }} total</small></article>
              <article class="lime"><span>Unread messages</span><strong>{{ stats.unread_messages }}</strong><small>{{ stats.new_projects }} new projects</small></article>
              <article><span>Active projects</span><strong>{{ stats.active_projects }}</strong><small>Needs your attention</small></article>
              <article><span>Paid orders</span><strong>{{ stats.paid_orders }}</strong><small>All time</small></article>
            </div>
            <section class="studio-panel"><div class="panel-title"><div><span>Latest activity</span><h3>Recent projects</h3></div><button type="button" (click)="open('inbox')">Open inbox →</button></div>
              <div class="project-table">
                @for (project of stats.recent_projects; track project.id) { <button type="button" (click)="openConversation(project.id)"><span><strong>{{ project.title }}</strong><small>{{ project.customer__email }}</small></span><b>{{ statusLabel(project.status) }}</b><time>{{ project.updated_at | date:'MMM d, h:mm a' }}</time><i>{{ project.message_count }} messages</i></button> }
                @empty { <p class="studio-empty">No custom projects yet.</p> }
              </div>
            </section>
          } @else { <p class="studio-loading">Loading your studio…</p> }
        }

        @if (view() === 'products') {
          <header class="studio-heading compact"><div><span>Artwork library</span><h2>Products.</h2></div><button class="button primary" type="button" (click)="startProduct()">+ Add artwork</button></header>
          @if (showProductForm()) {
            <form class="studio-product-form" [formGroup]="productForm" (ngSubmit)="saveProduct()">
              <div class="panel-title"><div><span>{{ editingProduct() ? 'Edit product' : 'New product' }}</span><h3>{{ editingProduct()?.title || 'Publish new artwork' }}</h3></div><button type="button" (click)="closeProductForm()">Close ×</button></div>
              <div class="studio-form-grid">
                <label>Title<input formControlName="title" maxlength="180"></label>
                <label>Category<select formControlName="category_id">@for (category of categories(); track category.id) { <option [value]="category.id">{{ category.name }}</option> }</select></label>
                <label class="wide">Short description<input formControlName="short_description" maxlength="240"></label>
                <label class="wide">Full description<textarea formControlName="description" rows="4"></textarea></label>
                <label>Price<input type="number" min="0" step="0.01" formControlName="price"></label>
                <label>Currency<select formControlName="currency"><option>USD</option><option>BDT</option></select></label>
                <label>Product type<select formControlName="product_type"><option value="POSTER">Poster</option><option value="TEMPLATE">Editable template</option><option value="SOCIAL_PACK">Social media pack</option><option value="PRINT_ART">Print-ready artwork</option></select></label>
                <label>License<select formControlName="license_type"><option value="PERSONAL">Personal</option><option value="COMMERCIAL">Commercial</option><option value="EXTENDED">Extended commercial</option></select></label>
                <label>Dimensions<input formControlName="dimensions" placeholder="1080 × 1350 px"></label><label>Resolution<input formControlName="resolution" placeholder="300 DPI"></label>
                <label>File formats<input formControlName="file_formats" placeholder="PSD, AI, PNG"></label><label>Color mode<input formControlName="color_mode" placeholder="RGB / CMYK"></label>
                <label class="file-field wide">
                  Main artwork file
                  <small>{{ editingProduct() ? 'Optional when editing · Auto-generates preview & watermark' : 'Upload once (JPG, PNG, WebP, ZIP, PSD, AI, PDF) — preview & watermark are generated automatically' }}</small>
                  <input type="file" accept=".jpg,.jpeg,.png,.webp,.svg,.zip,.pdf,.psd,.ai,.eps" (change)="selectSource($event)">
                </label>
                @if (needsCoverImage()) {
                  <label class="file-field wide">
                    Cover preview image <small>Required for PSD / AI / EPS / PDF project files (JPG, PNG or WebP)</small>
                    <input type="file" accept="image/jpeg,image/png,image/webp" (change)="selectPreview($event)">
                  </label>
                }
                <label class="check-field"><input type="checkbox" formControlName="is_featured"> Featured artwork</label><label class="check-field"><input type="checkbox" formControlName="is_active"> Published</label>
              </div>
              @if (formError()) { <p class="form-error">{{ formError() }}</p> }
              <button class="button primary" type="submit" [disabled]="productForm.invalid || savingProduct()">{{ savingProduct() ? 'Saving…' : (editingProduct() ? 'Save changes' : 'Publish artwork') }}</button>
            </form>
          }
          <div class="collection-controls" style="padding-inline:0; position:static; margin-bottom:24px;">
            <div class="catalog-toolbar" aria-label="Studio product category filter">
              <button type="button" [class.selected]="!studioCategoryFilter()" (click)="selectStudioCategory('')">All ({{ studioTotalCount() }})</button>
              @for (category of categories(); track category.id) {
                <button type="button" [class.selected]="studioCategoryFilter() === String(category.id)" (click)="selectStudioCategory(String(category.id))">{{ category.name }}</button>
              }
            </div>
            <div class="catalog-search">
              <label for="studio-product-search">Search products</label>
              <div>
                <span aria-hidden="true">⌕</span>
                <input id="studio-product-search" type="text" [formControl]="studioSearchControl" placeholder="Search studio products" autocomplete="off">
                @if (studioSearchControl.value) { <button type="button" (click)="studioSearchControl.setValue('')" aria-label="Clear">×</button> }
              </div>
            </div>
          </div>

          <div class="studio-product-grid">
            @for (product of products(); track product.id) { <article><div class="studio-product-preview"><img [src]="product.preview_url" [alt]="product.title"><span [class.draft]="!product.is_active">{{ product.is_active ? 'Published' : 'Draft' }}</span></div><div><small>{{ product.category_name }}</small><h3>{{ product.title }}</h3><p>{{ product.price | currency:product.currency }}</p><div><button type="button" (click)="editProduct(product)">Edit</button><button type="button" (click)="toggleProduct(product)">{{ product.is_active ? 'Unpublish' : 'Publish' }}</button></div></div></article> }
            @empty { <p class="studio-empty">No artwork found. Add your first product.</p> }
          </div>

          <div #studioScrollSentinel class="infinite-scroll-sentinel" aria-live="polite">
            @if (loadingMoreProducts()) {
              <div class="infinite-scroll-loader">
                <span class="scroll-spinner" aria-hidden="true"></span>
                <span>Loading more studio products…</span>
              </div>
            }
          </div>
        }

        @if (view() === 'inbox') {
          <header class="studio-heading compact"><div><span>Client communication</span><h2>Inbox.</h2></div></header>
          <div class="studio-inbox">
            <aside class="studio-threads"><div class="studio-thread-filter"><input type="search" placeholder="Search conversations" (input)="filterThreads($event)"></div>
              @for (request of filteredRequests(); track request.id) { <button type="button" [class.active]="activeRequest()?.id === request.id" (click)="selectRequest(request)">@if (request.unread_count) { <i>{{ request.unread_count }}</i> }<span><strong>{{ request.title }}</strong><small>{{ request.customer_email }}</small></span><p>{{ request.last_message || 'Project started' }}</p><time>{{ request.updated_at | date:'MMM d' }}</time></button> }
              @empty { <p class="studio-empty">No conversations found.</p> }
            </aside>
            <section class="studio-conversation">
              @if (activeRequest(); as request) {
                <header>
                  <div><small>{{ request.customer_email }}</small><h3>{{ request.title }}</h3></div>
                  <div class="conversation-header-actions">
                    <label>Status<select [value]="request.status" (change)="changeStatus($event)">@for (status of statuses; track status.value) { <option [value]="status.value">{{ status.label }}</option> }</select></label>
                    <button type="button" class="chat-icon-btn danger" (click)="deleteConversation(request)" title="Delete conversation" aria-label="Delete conversation"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
                  </div>
                </header>
                <div class="studio-message-stream" id="studio-message-stream">
                  @for (message of messages(); track message.id) { <article [class.mine]="message.is_mine">@if (message.body) { <p>{{ message.body }}</p> }@if (message.attachments.length) { <div class="message-attachments">@for (file of message.attachments; track file.id) { @if (file.mime_type.startsWith('image/') && previewUrls()[file.id]; as url) { <button class="image-attachment" type="button" (click)="openImage(file)"><img [src]="url" alt="Attached image"></button> } @else { <button class="attachment-card" type="button" (click)="work.downloadAttachment(file)"><span>↓</span><span><strong>Attached file</strong><small>{{ formatSize(file.file_size) }}</small></span></button> } }</div> }<div class="message-footer"><time>{{ message.created_at | date:'MMM d, h:mm a' }}</time><button type="button" class="message-delete-btn" (click)="deleteMessage(message, $event)" title="Delete message" aria-label="Delete message">×</button></div></article> }
                </div>
                <form class="studio-composer" [formGroup]="messageForm" (ngSubmit)="sendMessage()"><textarea formControlName="body" rows="3" maxlength="4000" placeholder="Reply to customer…" (keydown.enter)="handleEnter($event)"></textarea>@if (selectedFiles().length) { <div class="selected-files">@for (file of selectedFiles(); track file.name + file.size; let index = $index) { <span>{{ file.type.startsWith('image/') ? 'Image' : 'File' }} · <small>{{ formatSize(file.size) }}</small><button type="button" (click)="removeFile(index)">×</button></span> }</div> }<div><label class="attach-button">＋ Attach<input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,.zip,.docx,.pptx,.ai,.psd" (change)="chooseFiles($event)"></label><button class="button primary" type="submit" [disabled]="sending() || (!messageForm.controls.body.value.trim() && !selectedFiles().length)">Send ↑</button></div></form>
              } @else { <div class="conversation-empty"><span>✦</span><h2>Select a conversation</h2><p>Customer messages and project files will appear here.</p></div> }
            </section>
          </div>
        }
      </div>
    </section>
  `
})
export class StudioComponent implements OnInit {
  private readonly studio = inject(StudioService); readonly work = inject(CustomWorkService); private readonly catalog = inject(CatalogService); private readonly fb = inject(FormBuilder); private readonly destroyRef = inject(DestroyRef);
  readonly view = signal<StudioView>('dashboard'); readonly dashboard = signal<StudioDashboard | null>(null); readonly products = signal<StudioProduct[]>([]); readonly categories = signal<Category[]>([]);
  readonly String = String;
  readonly studioCategoryFilter = signal('');
  readonly studioSearchControl = new FormControl('', { nonNullable: true });
  readonly studioTotalCount = signal(0);
  readonly hasMoreProducts = signal(false);
  readonly loadingMoreProducts = signal(false);
  private studioPage = 1;
  private studioObserver: IntersectionObserver | null = null;

  @ViewChild('studioScrollSentinel')
  set studioSentinelRef(el: ElementRef<HTMLElement> | undefined) {
    this.studioObserver?.disconnect();
    if (el?.nativeElement && typeof IntersectionObserver !== 'undefined') {
      this.studioObserver = new IntersectionObserver(
        entries => {
          if (entries.some(entry => entry.isIntersecting)) {
            this.loadMoreStudioProducts();
          }
        },
        { rootMargin: '0px 0px 320px 0px', threshold: 0.01 }
      );
      this.studioObserver.observe(el.nativeElement);
    }
  }
  readonly requests = signal<CustomRequest[]>([]); readonly filteredRequests = signal<CustomRequest[]>([]); readonly activeRequest = signal<CustomRequest | null>(null); readonly messages = signal<PortalMessage[]>([]);
  readonly showProductForm = signal(false); readonly editingProduct = signal<StudioProduct | null>(null); readonly savingProduct = signal(false); readonly sending = signal(false); readonly notice = signal(''); readonly formError = signal(''); readonly selectedFiles = signal<File[]>([]); readonly previewUrls = signal<Record<number, string>>({});
  readonly needsCoverImage = signal(false);
  readonly downloadingBackup = signal(false);
  private previewFile: File | null = null; private sourceFile: File | null = null; private readonly previewObjects = new Map<number, string>();
  readonly statuses = [{ value: 'SUBMITTED', label: 'Submitted' }, { value: 'UNDER_REVIEW', label: 'Under review' }, { value: 'NEEDS_INFORMATION', label: 'Needs information' }, { value: 'QUOTED', label: 'Quoted' }, { value: 'IN_PROGRESS', label: 'In progress' }, { value: 'COMPLETED', label: 'Completed' }, { value: 'CANCELLED', label: 'Cancelled' }];
  readonly productForm = this.fb.nonNullable.group({ title: ['', Validators.required], category_id: [0, Validators.min(1)], short_description: ['', Validators.required], description: ['', Validators.required], price: ['0.00', Validators.required], currency: ['USD', Validators.required], product_type: ['POSTER', Validators.required], license_type: ['COMMERCIAL', Validators.required], dimensions: [''], resolution: [''], file_formats: [''], color_mode: [''], is_featured: [false], is_active: [true] });
  readonly messageForm = this.fb.nonNullable.group({ body: [''] });

  ngOnInit(): void {
    this.loadAll();
    this.studioSearchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.loadStudioProducts(true));
    interval(10000).pipe(takeUntilDestroyed(this.destroyRef), switchMap(() => this.work.requests())).subscribe(requests => { this.requests.set(requests); this.filteredRequests.set(requests); });
    this.destroyRef.onDestroy(() => {
      this.studioObserver?.disconnect();
      this.previewObjects.forEach(url => URL.revokeObjectURL(url));
    });
  }

  @HostListener('window:scroll')
  onStudioScroll(): void {
    if (this.view() !== 'products' || !this.hasMoreProducts() || this.loadingMoreProducts()) return;
    const sentinel = document.querySelector('.infinite-scroll-sentinel');
    if (sentinel && sentinel.getBoundingClientRect().top <= window.innerHeight + 320) {
      this.loadMoreStudioProducts();
    }
  }

  open(view: StudioView): void { this.view.set(view); if (view === 'inbox' && !this.activeRequest() && this.requests()[0]) this.selectRequest(this.requests()[0]); }

  downloadDbBackup(): void {
    if (this.downloadingBackup()) return;
    this.downloadingBackup.set(true);
    this.studio.downloadDatabaseBackup().pipe(finalize(() => this.downloadingBackup.set(false))).subscribe({
      next: blob => {
        const now = new Date();
        const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `sameulshajid-postgres-backup-${stamp}.zip`;
        anchor.click();
        URL.revokeObjectURL(url);
        this.flash('Database backup downloaded to your PC.');
      },
      error: () => this.flash('Database backup could not be downloaded.')
    });
  }
  openConversation(id: string): void { this.open('inbox'); const request = this.requests().find(item => item.id === id); if (request) this.selectRequest(request); }
  statusLabel(value: string): string { return this.statuses.find(status => status.value === value)?.label || value; }
  private loadAll(): void { this.studio.dashboard().subscribe(value => this.dashboard.set(value)); this.loadStudioProducts(true); this.catalog.categories().subscribe(value => this.categories.set(value)); this.work.requests().subscribe(value => { this.requests.set(value); this.filteredRequests.set(value); }); }

  selectStudioCategory(catId: string): void {
    this.studioCategoryFilter.set(catId);
    this.loadStudioProducts(true);
  }

  loadMoreStudioProducts(): void {
    if (!this.hasMoreProducts() || this.loadingMoreProducts()) return;
    this.studioPage += 1;
    this.loadingMoreProducts.set(true);
    this.loadStudioProducts(false);
  }

  private loadStudioProducts(reset = true): void {
    if (reset) {
      this.studioPage = 1;
      this.products.set([]);
    }
    this.studio.productsPage(this.studioPage, this.studioSearchControl.value, this.studioCategoryFilter())
      .pipe(finalize(() => this.loadingMoreProducts.set(false)))
      .subscribe(page => {
        this.products.update(current => reset ? page.results : [...current, ...page.results]);
        this.studioTotalCount.set(page.count);
        this.hasMoreProducts.set(Boolean(page.next));
      });
  }
  startProduct(): void { this.view.set('products'); this.editingProduct.set(null); this.previewFile = null; this.sourceFile = null; this.needsCoverImage.set(false); this.productForm.reset({ title: '', category_id: this.categories()[0]?.id || 0, short_description: '', description: '', price: '0.00', currency: 'USD', product_type: 'POSTER', license_type: 'COMMERCIAL', dimensions: '', resolution: '', file_formats: '', color_mode: '', is_featured: false, is_active: true }); this.showProductForm.set(true); }
  editProduct(product: StudioProduct): void { this.editingProduct.set(product); this.previewFile = null; this.sourceFile = null; this.needsCoverImage.set(false); this.productForm.reset({ title: product.title, category_id: product.category_id, short_description: product.short_description, description: product.description, price: product.price, currency: product.currency, product_type: product.product_type, license_type: product.license_type, dimensions: product.dimensions, resolution: product.resolution, file_formats: product.file_formats.join(', '), color_mode: product.color_mode, is_featured: product.is_featured, is_active: product.is_active }); this.showProductForm.set(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  closeProductForm(): void { this.showProductForm.set(false); this.editingProduct.set(null); }
  selectPreview(event: Event): void { this.previewFile = (event.target as HTMLInputElement).files?.[0] || null; }
  selectSource(event: Event): void {
    this.sourceFile = (event.target as HTMLInputElement).files?.[0] || null;
    if (!this.sourceFile) {
      this.needsCoverImage.set(false);
      return;
    }
    const ext = this.sourceFile.name.split('.').pop()?.toLowerCase() || '';
    this.needsCoverImage.set(['psd', 'ai', 'eps', 'pdf'].includes(ext));
    if (!this.productForm.controls.file_formats.value.trim() && ext) {
      this.productForm.controls.file_formats.setValue(ext.toUpperCase());
    }
  }
  saveProduct(): void {
    if (this.productForm.invalid || (!this.editingProduct() && !this.sourceFile && !this.previewFile)) {
      this.formError.set('Complete the required fields and upload your artwork file.');
      return;
    }
    if (this.needsCoverImage() && !this.previewFile && !this.editingProduct()) {
      this.formError.set('Please select a JPG/PNG cover preview image for this PSD/AI/PDF file.');
      return;
    }
    const value = this.productForm.getRawValue();
    const payload = new FormData();
    Object.entries(value).forEach(([key, item]) => payload.append(key, key === 'file_formats' ? JSON.stringify(String(item).split(',').map(part => part.trim()).filter(Boolean)) : String(item)));
    if (this.previewFile) payload.append('preview_file', this.previewFile);
    if (this.sourceFile) payload.append('source_file', this.sourceFile);
    this.savingProduct.set(true);
    this.formError.set('');
    const current = this.editingProduct();
    const request = current ? this.studio.updateProduct(current.id, payload) : this.studio.createProduct(payload);
    request.subscribe({
      next: saved => {
        this.products.update(items => current ? items.map(item => item.id === saved.id ? saved : item) : [saved, ...items]);
        this.savingProduct.set(false);
        this.closeProductForm();
        this.flash(current ? 'Product updated.' : 'Artwork published with auto-generated preview.');
        this.refreshDashboard();
      },
      error: response => {
        this.savingProduct.set(false);
        this.formError.set(this.readError(response.error));
      }
    });
  }
  toggleProduct(product: StudioProduct): void { const payload = new FormData(); payload.append('is_active', String(!product.is_active)); this.studio.updateProduct(product.id, payload).subscribe(saved => { this.products.update(items => items.map(item => item.id === saved.id ? saved : item)); this.refreshDashboard(); }); }
  filterThreads(event: Event): void { const value = (event.target as HTMLInputElement).value.toLowerCase().trim(); this.filteredRequests.set(this.requests().filter(item => !value || `${item.title} ${item.customer_email} ${item.last_message}`.toLowerCase().includes(value))); }
  selectRequest(request: CustomRequest): void { this.activeRequest.set({ ...request, unread_count: 0 }); this.work.messages(request.id).subscribe(messages => { this.messages.set(messages); this.loadPreviews(messages); this.scrollMessages(); this.requests.update(items => items.map(item => item.id === request.id ? { ...item, unread_count: 0 } : item)); }); }
  deleteConversation(request: CustomRequest): void {
    this.work.deleteRequest(request.id).subscribe(() => {
      const remaining = this.requests().filter(item => item.id !== request.id);
      this.requests.set(remaining);
      this.filteredRequests.update(items => items.filter(item => item.id !== request.id));
      if (this.activeRequest()?.id === request.id) {
        this.messages.set([]);
        if (remaining[0]) this.selectRequest(remaining[0]);
        else this.activeRequest.set(null);
      }
      this.flash('Conversation deleted.');
      this.refreshDashboard();
    });
  }
  deleteMessage(message: PortalMessage, event?: Event): void {
    event?.stopPropagation();
    const active = this.activeRequest();
    if (!active) return;
    const previous = this.messages();
    this.messages.update(items => items.filter(item => item.id !== message.id));
    this.work.deleteMessage(active.id, message.id).subscribe({
      error: () => this.messages.set(previous)
    });
  }
  changeStatus(event: Event): void { const active = this.activeRequest(); if (!active) return; const status = (event.target as HTMLSelectElement).value; this.work.updateStatus(active.id, status).subscribe(result => { const updated = { ...active, status: result.status, status_display: result.status_display }; this.activeRequest.set(updated); this.requests.update(items => items.map(item => item.id === active.id ? updated : item)); this.flash(`Project marked ${result.status_display.toLowerCase()}.`); this.refreshDashboard(); }); }
  sendMessage(): void { const active = this.activeRequest(); const body = this.messageForm.controls.body.value.trim(); if (!active || (!body && !this.selectedFiles().length)) return; this.sending.set(true); this.work.sendMessage(active.id, body, this.selectedFiles()).subscribe({ next: message => { this.messages.update(items => [...items, message]); this.loadPreviews([message]); this.messageForm.reset(); this.selectedFiles.set([]); this.sending.set(false); this.scrollMessages(); }, error: () => { this.sending.set(false); this.flash('Message could not be sent.'); } }); }
  handleEnter(event: Event): void { const keyboard = event as KeyboardEvent; if (keyboard.shiftKey || keyboard.isComposing) return; keyboard.preventDefault(); this.sendMessage(); }
  chooseFiles(event: Event): void { const input = event.target as HTMLInputElement; this.selectedFiles.set([...this.selectedFiles(), ...Array.from(input.files || [])].slice(0, 5)); input.value = ''; }
  removeFile(index: number): void { this.selectedFiles.update(files => files.filter((_, current) => current !== index)); }
  formatSize(bytes: number): string { return bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`; }
  openImage(file: MessageAttachment): void { const url = this.previewObjects.get(file.id); if (url) window.open(url, '_blank', 'noopener,noreferrer'); }
  private loadPreviews(messages: PortalMessage[]): void { for (const message of messages) for (const file of message.attachments) if (file.mime_type.startsWith('image/') && !this.previewObjects.has(file.id)) this.work.attachmentBlob(file).subscribe(blob => { const url = URL.createObjectURL(blob); this.previewObjects.set(file.id, url); this.previewUrls.update(items => ({ ...items, [file.id]: url })); }); }
  private scrollMessages(): void { setTimeout(() => { const element = document.getElementById('studio-message-stream'); if (element) element.scrollTop = element.scrollHeight; }); }
  private refreshDashboard(): void { this.studio.dashboard().subscribe(value => this.dashboard.set(value)); }
  private flash(message: string): void { this.notice.set(message); setTimeout(() => this.notice.set(''), 3000); }
  private readError(value: unknown): string { if (!value || typeof value !== 'object') return 'The product could not be saved.'; const first = Object.values(value as Record<string, unknown>)[0]; return Array.isArray(first) ? String(first[0]) : typeof first === 'object' ? JSON.stringify(first) : String(first); }
}
